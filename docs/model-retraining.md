# Retraining the child growth model

Status: **the model is retrained and the backend is updated. Only the deploy is
outstanding.** Written before that was established; §§1–3 are kept because they
record how the outage was diagnosed and why the retrain was worth doing, and §7
records where it actually landed.

## 1. What forced this

Every prediction has been failing in production with HTTP 502 and the upstream's
generic message, "There was an error while calculating the survey results".

What was established by probing the backend directly:

| Observation | Conclusion |
|---|---|
| `GET /` and `GET /surveys/catalog` return 200 in ~250 ms | The service is up; the URL has not changed |
| `child_bmi` still listed with `submit: {survey: "child_bmi"}` | Our route id and payload shape are correct |
| An unknown survey name returns 400 "This survey type is invalid" | `child_bmi` is recognised and routed |
| Valid documented data and `data: {}` fail *identically* | It fails before reading any input |
| Failure takes 0.24 s — the same as a *successful* `sample_survey` call | It is not running a model and failing; it never loads one |
| `sample_survey` (needs no model) returns 200 | Routing and the results pipeline are fine |

That points at the model artifacts failing to load, before inputs matter — the
signature of a pickle written by one version of scikit-learn or numpy and read
by another.

The v1 artifacts in this repo carry their provenance in the pickle bytes:

```
packages/prediction/models/svr-v1/childbmi_model_{bmi,height,weight}.bin
  pickled by scikit-learn : 1.0.2
  requires                : sklearn.svm._classes.SVR
  numpy refs              : numpy.core.multiarray   (numpy 1.x)
  pickle protocol         : 3
```

matching the `scikit-learn==1.0.2` pin in `apps/api/run.sh`. **The deployed
backend serves svr-v2, whose artifacts are not in this repo** — run the same
check on those to get the number that decides pin-vs-retrain. It reads bytes, so
it needs neither library installed and never executes the pickle:

```bash
python3 - <<'PY' /path/to/svr-v2/*.bin
import re, sys, pathlib
for p in map(pathlib.Path, sys.argv[1:]):
    raw = p.read_bytes()
    skl = {re.search(rb"(\d+\.\d+(?:\.\d+)?)", raw[m.end():m.end()+40]).group(1).decode()
           for m in re.finditer(rb"_sklearn_version", raw)
           if re.search(rb"(\d+\.\d+(?:\.\d+)?)", raw[m.end():m.end()+40])}
    print(f"{p.name}: sklearn={sorted(skl) or '?'} numpy={'2.x' if b'numpy._core' in raw else '1.x'}")
PY
```

Compare against what the Cloud Run image installs (`pip show scikit-learn numpy`
inside the container).

## 2. Restore service first

Retraining is days; pinning is minutes, and it confirms the diagnosis before
anyone spends the days. Pin the serving image to the versions that wrote the
deployed artifacts, redeploy, and check with:

```bash
npm run health --workspace web -- https://<deployment>
```

Do this even though §3 supersedes it. A model in production that answers badly
is a known quantity; one that answers not at all is an outage.

## 3. Why retrain rather than rebuild

`docs/prediction-api.md` §2a records that the current model is not merely stale,
it is close to non-functional, and the causes are in the training setup rather
than in serving:

- **No feature standardization.** `SVR(kernel="rbf", C=1.0, gamma="scale")` with
  `_gamma = 0.000144` and no scaler. RBF kernels are scale-sensitive, so Height
  (40–220) dominates the distance metric while Sex (1–2) and age (0–18) are
  effectively ignored. Changing sex moves the prediction **0.03 cm**, against a
  real difference of roughly 13 cm.
- **`C = 1.0` pins predictions near the intercept** (`intercept_ = 150.72`).
  Across deliberately extreme inputs the entire output range is 151.6–170.0 cm,
  against a real adult range of roughly 150–195 cm.
- **Not monotonic.** A 17-year-old already 180 cm is predicted to reach 163.66 cm
  at 18 — shorter than they are now, and shorter than a 150 cm 17-year-old.
- **No short prediction horizons in the training baselines** (median age 2, no
  horizon under ~7 years). This is why `MAX_MODEL_CURRENT_AGE` is capped at 15 in
  `packages/core/src/model-domain.ts`: above it the model predicts negative
  growth. The cap is a guard around a defect, not a product decision.

A rebuild against a newer library reproduces all of this. A retrain can fix it.

## 4. Scope

1. **Recover the training data and script.** Reference paths in `docs/design.md`
   Appendix A (`lab-surveys/backend/surveys/utils/child_bmi/`). *Unknown: whether
   the original training set and script are still available. Establish this
   first — it determines whether this is a retrain or a rebuild from scratch.*
2. **Pipeline, not a bare estimator.** `Pipeline([StandardScaler(), SVR()])` so
   the scaler travels with the model and cannot be forgotten at serving time.
3. **Tune `C` and `gamma`** by cross-validation instead of taking defaults.
4. **Add short-horizon training pairs** so the ≤15 cap can be re-evaluated
   rather than inherited.
5. **Validate against behaviour, not just error.** Hold the checks that caught
   the current model: monotonic in current height, responsive to sex by roughly
   the right magnitude, never predicts a child shorter than they already are.
6. **Consider mid-parental height as a feature.** Currently only the LLM path
   uses parent heights; the SVR has no parental input at all.

## 5. Ship it so this cannot recur

- **Record the training environment beside the artifacts.** A bare `.bin` does
  not say what wrote it — the version above had to be read out of the pickle
  bytes. Write a `versions.json` next to the models at training time.
- **Prefer a version-independent export** (ONNX via `skl2onnx`) if the serving
  environment will drift again. It removes this failure class rather than
  re-pinning it.
- **Load the model at container start, not per request**, so a bad artifact
  fails the deploy instead of every user's submission.
- **Run `npm run health --workspace web` against the deployment after release**,
  and on a schedule. It catches exactly this outage in one line.
- **Fix `int()` → `float()` in the upstream's `convert_values_to_list()`**
  (`docs/prediction-api.md` §2b): the backend currently truncates every feature,
  so `Height 110.6, age 5.9` is served as `110, 5`. Retraining on floats while
  serving truncated integers would waste part of the gain.

## 6. Not blocked on any of this

The app degrades honestly in the meantime: a 5xx from the backend now shows a
localized "the prediction service is temporarily unavailable" rather than the
upstream's untranslated internal string, and the smoke suite refuses to run
against a backend that cannot predict.

## 7. Where this actually stands

Checked against the sibling repos on 2026-09-21. Most of this plan was already
done — what follows is what exists, not what is proposed.

### Retraining: done

`child_bmi_prediction` holds three trained versions beyond svr-v1:

| Version | Data | Rows | Height MAE | R² | scikit-learn |
|---|---|---:|---:|---:|---|
| svr-v2 | China panel | 1,830 | 5.41 cm | 0.743 | 1.4.2 |
| svr-v3 | pooled growth panel | 27,633 | 2.91 cm | 0.930 | 1.5.2 |
| **gbm-v1** | pooled growth panel | 27,493 | **2.77 cm** | **0.935** | **1.4.2** |

gbm-v1 is the one that matters: it matches the backend's `scikit-learn==1.4.2`
pin exactly, where svr-v3's 1.5.2 does not, and it is the only version that
carries conformal prediction intervals.

The §3 defects are fixed. Verified by running the backend's own
`verify_model.py` under a replica of the serving environment (scikit-learn
1.4.2, numpy 1.26.4), all ten checks passing:

- Sex moves the age-18 prediction **11.9 cm** (176.2 male / 164.3 female),
  against svr-v1's 0.03 cm.
- Monotonic in target age: 139 → 150 → 163 → 173 → 176 → 177.
- Responds to current height: 163.9 vs 189.3 cm.
- BMI is derived from the predicted pair, so the three cannot contradict.

### Backend: done and merged

`kang-lee-lab/lab-surveys` `origin/main` serves gbm-v1 — PR #109, plus
`52e881e` which adds the pre-deploy check. `child_bmi_survey.py` on main has
`MODEL_VERSION = "gbm-v1"` and `MODEL_SUBDIR = "gbm-v1"`, and the artifacts are
committed under `backend/surveys/static/survey_files/child_bmi/gbm-v1/`.

### Deploy: done. The image is the problem

**Correction.** An earlier revision of this section said the deploy had not
happened. That was wrong, and the test that settles it is cheap: the auth0 merge
at main's tip (`830412b`) added `/surveys/me` and
`/surveys/participants/me/responses`. Production answers both with **401**, not
404 — the routes exist. Production is running main, gbm-v1 and all.

It still fails because **the container it runs in cannot load the model.**

`Dockerfile.legacy`, which builds the `kangleelab-legacy` service, does not
install `backend/requirements.txt`. It installs
`backend/docker/legacy/requirements-legacy.txt`, and that file pins:

```
scikit-learn==1.0.2
```

gbm-v1 was trained on **1.4.2**. Loading its artifacts under 1.0.2 fails:

```
TypeError: __generator_ctor() takes from 0 to 1 positional arguments but 2 were given
```

Verified directly, in a virtualenv built to the legacy pin (scikit-learn 1.0.2,
numpy 1.23.0, pandas 1.4.3) against the artifacts as committed on main:

| artifact | sklearn 1.0.2 (production) | sklearn 1.4.2 |
|---|---|---|
| `child_bmi/gbm-v1/*` (all three) | **TypeError** | **loads** |
| `child_bmi/*.bin` (old svr) | loads | loads |
| `nafld/nafld_models_lr.bin` | loads | loads |
| `dass/*`, `mmpi/*` | needs xgboost | needs xgboost |

This accounts for every symptom: it throws at load, before any input is read,
which is why valid data and `data: {}` fail identically in 250 ms, and why
`sample_survey` — which loads no model — is fine.

### The fix, and what it actually took

Serving from the modern image, as chosen — but that alone was not enough, and
the reason is worth recording.

`kangleelab-modern` was already live and already running main, and child_bmi
failed there too. **Both** images pin `numpy==1.23.0`, and numpy's `Generator`
constructor gained a second argument in 1.24, so the artifact raises the same
`TypeError` regardless of which scikit-learn is present. Two pins were wrong,
not one; only the scikit-learn half was visible from the Dockerfile headers.

Measured against the artifacts as committed on main, scikit-learn 1.4.2 and
pandas 1.4.3 held constant:

| numpy | result |
|---|---|
| 1.23.0 | `TypeError: __generator_ctor()` |
| 1.24.4 | loads |
| 1.25.2 | loads |
| 1.26.4 | loads |

That the split itself is sound was confirmed separately: `dass_multiclass`,
which needs scikit-learn 1.4.2, returns 200 on the modern service and 500 on
the legacy one.

**Backend** — `kang-lee-lab/lab-surveys`, branch `child-bmi-modern-numpy`,
awaiting PR. Bumps `docker/modern/requirements-modern.txt` to `numpy==1.26.4`,
matching what `backend/requirements.txt` already asks for, and corrects both
Dockerfile headers to show which surveys each image serves.
`verify_model.py` passes all ten checks under the new combination, and the
`dass_multiclass` RandomForest loads unchanged under 1.23.0, 1.24.4 and 1.26.4,
so the bump costs the modern image's existing survey nothing. The legacy image
is untouched.

**Frontend** — `PREDICTION_API_URL` must move from `kangleelab-legacy` to
`kangleelab-modern`. Done here in `.env.local.example` and
`docs/prediction-api.md`; **the Vercel environment variable and any local
`.env.local` still need changing by hand.** Verify with:

```bash
npm run health --workspace web -- https://<deployment>
```

### The age cap is now a product decision, not a guard

`MAX_MODEL_CURRENT_AGE = 15` exists because svr-v1 predicted *negative* growth
above it. gbm-v1 does not. A 165 cm boy predicted to 18:

| Current age | 12 | 13 | 14 | 15 | 16 | 17 |
|---|---:|---:|---:|---:|---:|---:|
| Predicted at 18 | 188.3 | 183.5 | 177.3 | 173.2 | 170.0 | 168.5 |
| 80% interval | 183–194 | 179–188 | 173–182 | 169–177 | 166–174 | 166–171 |

Every value exceeds the child's current height, the sequence falls as the
remaining growth window shortens, and the interval narrows with the horizon.
The cap can be raised to 17 on the model's behaviour alone. Left unchanged
pending a decision, since it governs what the product will tell a parent about
a real child — and the model card notes the 13y+ training pairs come almost
entirely from 136 children measured in 1930s California.
