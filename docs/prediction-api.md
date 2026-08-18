# Prediction backend

**Status:** Current
**Last updated:** 2026-08-18

The SVR model runs on a Google Cloud backend (`lab-surveys-backend`), not inside
the Vercel deployment. The LLM layer stays in this app, because that backend
serves the ML model only.

---

## 1. Why it moved

The model previously ran as Python serverless functions in `apps/web/api/`. The
model artifacts were never the problem — all three `.bin` files total about
260 KB. The weight came from the dependency tree needed to *load* them:

| Dependency | Approx. unzipped |
|------------|------------------|
| `scikit-learn` | ~30 MB |
| `pandas` | ~40 MB |
| `numpy` | ~20 MB |
| `scipy` (transitive) | ~40–90 MB |

Vercel's limit is 250 MB unzipped per serverless function, so that tree was the
thing worth removing. Vercel now builds no Python at all: `requirements.txt`,
`runtime.txt`, the `functions` block in `vercel.json`, and the `copy-models`
build step are gone, and the LLM path — which only ever needed an HTTP call —
was ported to TypeScript rather than keeping a Python runtime alive for it.

**Tradeoffs accepted.** Prediction now depends on a second service and a network
hop where it used to be in-process:

- **Latency.** `docs/design.md` §15 targets p95 < 200 ms. That now depends on
  region pairing — co-locate the Vercel and Cloud Run regions — and on cold
  starts, which for a Django + scikit-learn container can run to several seconds.
  `--min-instances=1` fixes that but is not free.
- **Availability.** A prediction can now fail because the backend is down, which
  was not previously a failure mode. The route handler turns that into a `502`
  with a clear message rather than a generic `500`.

---

## 2. ⚠️ Model quality: measured, not assumed

Two problems were found by probing the live service and then reproducing them
against the same `.bin` files locally. The second is much more serious than the
first, and neither is caused by the move to HTTP.

### 2a. The model is barely sensitive to its inputs

Holding everything else fixed and varying one feature at a time, against the
live endpoint (local engine agrees to within 0.05 cm):

| Change | Predicted adult height | Δ |
|--------|-----------------------|---|
| baseline `1, 110cm, 20kg, age 5 → 18` | 161.94 | — |
| sex male → female | 161.97 | **+0.03** |
| current age 5 → 15 | 161.81 | **−0.13** |
| target age 18 → 21 | 162.36 | +0.42 |
| height 110 → 120 | 165.11 | +3.17 |
| weight 20 → 30 | 163.69 | +1.75 |

Sex moves the prediction by **0.03 cm**, where real adult height differs by
roughly 13 cm between sexes. A 5-year-old and a 15-year-old of identical size
differ by **0.13 cm**, when in reality a 15-year-old at 110 cm has severe growth
failure and should predict completely differently.

Worse, the model is not even monotonic. A 17-year-old who is *already* 180 cm is
predicted to reach **163.66 cm** at 18 — 16 cm shorter than they already are, and
shorter than a 150 cm 17-year-old, who gets 169.59 cm.

Across deliberately extreme inputs the whole output range is 151.6–170.0 cm,
against a real adult range of roughly 150–195 cm.

**Root cause,** from the pickled model: `SVR(kernel="rbf", C=1.0,
gamma="scale")` with `_gamma = 0.000144`, `intercept_ = 150.72`, and **no feature
standardization**. RBF kernels are scale-sensitive, so unscaled features let
Height (40–220) dominate the distance metric while Sex (1–2) and age (0–18) are
effectively ignored; `C=1.0` then keeps predictions pinned near the intercept.
The fix is retraining with a `StandardScaler` in the pipeline and tuning `C` and
`gamma` — not a serving change.

This is the single highest-priority item in the "improve the model" workstream,
ahead of adding mid-parental height.

### 2b. Upstream truncates every feature to an integer

`convert_values_to_list()` in `lab-surveys-backend/surveys/utils/helpers.py`:

```python
def convert_values_to_list(d):
    converted = {}
    for key in d:
        converted[key] = [int(d[key])]   # truncates
    return converted
```

This is the precision bug `docs/design.md` §3 lists as "address in new app";
`packages/prediction` fixed it locally by keeping floats. Confirmed live — these
three requests return byte-identical predictions:

| Sent | Model uses |
|------|-----------|
| `Height 110.6, Weight 20.4, Current age 5.5` | `110, 20, 5` |
| `Height 110.6, Weight 20.4, Current age 5.9` | `110, 20, 5` |
| `Height 110,   Weight 20,   Current age 5`   | `110, 20, 5` |

It matters for real input, since the form uses `step={0.5}` for age and
`step={0.1}` for height and weight. Fix is `int()` → `float()` upstream.

Note this does **not** explain 2a: `Sex` is already an integer, so truncation
cannot account for a 0.03 cm response to changing sex.

### What this means for the migration

Nothing here argues against serving from Google Cloud. The model behaves the same
way in-process — verified against the same `.bin` files — so the move costs only
the small additional loss from 2b. It does mean the accuracy work is a modelling
problem, not a deployment one.

## 3. Contract

The upstream is a Django *survey* platform, not a purpose-built prediction
service. `src/lib/prediction-api.ts` translates between our shape and its shape;
these are the differences worth knowing.

### Which endpoint serves the model

Confirmed from `GET /surveys/catalog` on the live service — `child_bmi` is served
by `lab-surveys-backend-all-other-surveys` despite the name:

```json
{ "route_id": "child_bmi", "survey_id": "childbmi",
  "submit": { "survey": "child_bmi" },
  "has_results": true, "is_machine_learning": true }
```

Note `submit.survey` is `child_bmi` (the route id), not `childbmi` (the survey
id). There is no dedicated prediction route: `POST /surveys/results` is the single
generic endpoint, dispatched on that `survey` field. `GET /surveys/` returns 500 —
that is an unrelated broken index view, not a health signal.

### Request

```
POST {PREDICTION_API_URL}/surveys/results
```

```json
{
  "survey": "child_bmi",
  "data": {
    "Sex": 1,
    "Height": 110,
    "Weight": 20,
    "Current age": 5,
    "Age to predict": 18
  },
  "duration": 0
}
```

- Keys are **title case with spaces**, not snake_case.
- `BMI` is deliberately **not** sent — the survey handler computes it from
  `Height` and `Weight` before running the models.
- `duration` is read unconditionally by the view, so omitting it causes a 500.
  We are not a timed survey, so zero is the honest value.
- The view is `@csrf_exempt`, so a server-to-server POST needs no CSRF token.
  CORS is irrelevant because the browser never calls it directly.

### Response

```json
{
  "pred_height": 175.2,
  "pred_weight": 68.4,
  "pred_bmi": 22.3,
  "age_to_predict": 18,
  "db_result": { "...": "..." },
  "results": "...",
  "metadata": { "...": "..." }
}
```

Mapped to `pred_height_cm` / `pred_weight_kg` / `pred_bmi`. The extra survey
fields are ignored.

**There is no `model_version` in the response.** Every stored prediction records
one, so it comes from `PREDICTION_MODEL_VERSION` on this side and must be updated
by hand when the backend's model changes. That is a weak link — the roadmap's
shadow-mode work should have the backend report its own version.

### Errors

Every internal failure collapses to:

```json
{ "message": "There was an error while calculating the survey results." }
```

with status 500 — no indication of *what* was invalid. Input validation
therefore happens in `validateInputs()` on our side, ported from
`PredictionInputs.validate()`, so a bad height still produces a specific 400
instead of an opaque server error.

---

## 4. Why proxy instead of calling from the browser

Requests go browser → Next.js route handler → Cloud Run:

- The upstream URL and any credential stay server-side, so the service can stay
  private rather than publicly invocable.
- The browser keeps calling same-origin `/api/v1/*`, so no CORS setup.
- Rate limiting and premium gating have somewhere to live. The LLM endpoint has a
  real per-request cost, making it the natural first place for both.

### Do not use a `rewrites()` proxy for this

A `rewrites()` returning an array is applied as `afterFiles`: after static and
non-dynamic routes, but **before dynamic ones**. An external destination always
resolves, so a wildcard `/api/:path*` rewrite silently captures
`/api/user/children/[id]` before its handler runs.

This was a live bug. With the old rewrite configured, `/api/user/children`
returned `401` as expected while `/api/user/children/abc` returned `500` —
quietly breaking edit and delete for a single child in any environment where
`API_URL` was set. If a rewrite is ever needed under `/api/*`, scope it to an
exact path.

---

## 5. Configuration

| Variable | Required | Notes |
|----------|----------|-------|
| `PREDICTION_API_URL` | Yes | Accepts the origin **or** a URL ending in `/surveys`; both resolve correctly. |
| `PREDICTION_API_TOKEN` | Only if private | Sent as `Authorization: Bearer`. Omit for a public backend. |
| `PREDICTION_MODEL_VERSION` | Optional | Recorded on every prediction. Default `svr-v1`. |
| `OPENAI_API_KEY` | For LLM predictions | The LLM runs here, not on the ML backend. |
| `OPENAI_MODEL` | Optional | Default `gpt-5.4-mini`. |

### Public backend — current state

Verified: an unauthenticated `POST /surveys/results` returns 200, so the service
is deployed `--allow-unauthenticated`. Leave `PREDICTION_API_TOKEN` unset.

Because it is publicly invocable, anyone who learns the URL can spend your CPU on
it. Rate limiting belongs on the backend as well as in the route handler.
Simplest, but anyone who learns the URL can invoke it, so rate limiting belongs
on the backend too.

### IAM-protected backend

If the service requires `roles/run.invoker`, a **static token will not work** —
Cloud Run wants a short-lived Google-signed OIDC identity token whose audience is
the service URL:

1. Create a service account with `roles/run.invoker` on the service.
2. Put its JSON key in a Vercel env var (for example `GCP_SA_KEY`).
3. Add `google-auth-library` and mint an ID token for the service URL as
   audience inside `predict()`, replacing the `PREDICTION_API_TOKEN` header.

Tokens last an hour, so cache until near expiry rather than minting per request.

A simpler middle option: keep the service public but require a long shared secret
via `PREDICTION_API_TOKEN` and reject requests without it in Django. Weaker than
IAM, much simpler, far better than an open endpoint.

---

## 6. Local development

```bash
# apps/web/.env.local
PREDICTION_API_URL=https://lab-surveys-backend-xxxxxxxx.a.run.app
OPENAI_API_KEY=sk-...
```

`npm run dev` then needs no local Python at all.

To run the whole stack locally instead, `apps/api` still exists as a FastAPI
wrapper around `packages/prediction` — but note it exposes
`POST /api/v1/predict`, **not** `/surveys/results`, so it is not a drop-in
substitute for `PREDICTION_API_URL` without adapting the client.

`packages/prediction` remains the source of truth for the model and its tests;
it is simply no longer bundled into the web deployment.
