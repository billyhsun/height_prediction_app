# Retraining the child growth model

Status: planned. Triggered by the outage described in §1, but the version fix is
the smallest part of the work — §3 is the reason to do it properly rather than
just rebuild the same estimator against a newer library.

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
