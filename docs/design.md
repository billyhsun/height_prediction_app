# Child Growth Predictor — System Design

**Status:** Draft  
**Last updated:** 2026-08-10  
**Related:** [lab-surveys child BMI model](../../lab-surveys/backend/surveys/utils/child_bmi/child_bmi_survey.py)

---

## 1. Overview

Child Growth Predictor is a standalone consumer app for predicting children's future height, weight, and BMI. It ports the SVR models developed for the Kang Lee Lab **Child BMI** survey in `lab-surveys`, but is built as a separate product with user accounts, child profiles, measurement history, and a path toward LLM-augmented insights.

### Goals

1. **Accurate predictions** — Serve the existing sklearn SVR models with improved engineering (caching, float precision, versioning).
2. **Multi-user scale** — Self-serve accounts; each user manages one or more child profiles.
3. **Longitudinal tracking** — Log height, weight, and age over time; visualize growth and prediction history.
4. **Extensibility** — Schema and service boundaries that support retrained models and LLM layers without breaking v1.

### Non-goals (v1)

- Clinical diagnosis or medical advice
- WHO/CDC growth percentile charts (unless reference data is added later)
- Wearable or EHR integrations
- Replacing SVR numeric predictions with an LLM

---

## 2. Relationship to lab-surveys

| Aspect | lab-surveys | Child Growth Predictor |
|--------|-------------|------------------------|
| Purpose | Multi-survey research / demo platform | Single-purpose growth tracker |
| Auth | Auth0; accounts manually provisioned | Self-serve signup |
| Data | Generic `Response` JSON blobs | Child-centric relational schema |
| History | Optional, survey-level; DB save disabled by default | Core feature: measurement time series |
| Deploy | Tied to survey catalog releases | Independent repo and release cycle |

**Integration model:** Copy model artifacts (`.bin` files) and prediction logic into this repo. Do **not** depend on lab-surveys at runtime.

---

## 3. Existing model (v1 baseline)

Source: `lab-surveys/backend/surveys/utils/child_bmi/child_bmi_survey.py`

### Approach

Three independent **Support Vector Regression (SVR)** models (scikit-learn 1.0.2, RBF kernel):

| Model file | Target |
|------------|--------|
| `childbmi_model_height.bin` | Predicted height (cm) |
| `childbmi_model_weight.bin` | Predicted weight (kg) |
| `childbmi_model_bmi.bin` | Predicted BMI (kg/m²) |

Reference: Yasin, Y., Sun, Y.H., and Lee, K. (2022). *A machine learning approach for predicting children's future BMI.* Canadian Developmental Psychology Conference.

### Feature vector (6 features, shared by all three models)

| Feature | Source |
|---------|--------|
| `Sex` | Child profile (1 = male, 2 = female) |
| `Height` | Current measurement (cm) |
| `Weight` | Current measurement (kg) |
| `Current age` | Derived from DOB + measurement date (years) |
| `Age to predict` | User-selected target age (years) |
| `BMI` | Computed: `weight_kg / (height_cm / 100)²` |

### Outputs

- `pred_height` (cm)
- `pred_weight` (kg)
- `pred_bmi` (kg/m²)

### Known limitations (address in new app)

| Issue | Mitigation in new app |
|-------|----------------------|
| Single snapshot only; no longitudinal features | Store measurement history; design v2 features (velocity, etc.) |
| `convert_values_to_list()` casts to `int` | Preserve float precision in prediction package |
| Models loaded from disk per request | Load once at startup; optional Redis cache for multi-worker |
| Height, weight, BMI predicted independently | Document constraint; consider post-processing or joint model in v2 |
| sklearn 1.0.2 version lock | Pin in Docker; version-tag all predictions |
| No parent height / genetics | Optional field on `Child` for future models |

---

## 4. System architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Web Client (Next.js)                     │
│  Dashboard · Child profiles · Measurements · Charts · Auth   │
└─────────────────────────────┬───────────────────────────────┘
                              │ HTTPS / REST
┌─────────────────────────────▼───────────────────────────────┐
│                      API (FastAPI)                           │
│  Auth middleware · Children · Measurements · Predictions     │
└──────┬──────────────────┬──────────────────┬──────────────┘
       │                  │                  │
       ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐
│  PostgreSQL  │  │  Prediction  │  │  LLM Service (v3+)   │
│  Users       │  │  Package     │  │  Explanations only   │
│  Children    │  │  SVR v1      │  │  initially           │
│  Measurements│  │  Registry    │  └──────────────────────┘
│  Predictions │  └──────────────┘
└──────────────┘
```

### Tech stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Frontend | **Next.js** (React, TypeScript) | Product-grade routing, auth integration, SSR where useful |
| Backend | **FastAPI** (Python 3.11+) | Async, OpenAPI-native, good fit for ML serving |
| Database | **PostgreSQL** (Supabase or Neon) | Relational model for profiles and time series |
| Auth | **Clerk** or **Auth0** | Self-serve signup (unlike lab-surveys manual provisioning) |
| ML (v1) | scikit-learn 1.0.2 in-process | Matches existing pickled models |
| Charts | Recharts (or similar) | Familiar from lab-surveys frontend |
| Hosting | Vercel (web) + Railway/Fly/Render (API) | Independent scaling |

### Repository layout

```
height_prediction_app/
├── apps/
│   ├── web/                    # Next.js frontend
│   └── api/                    # FastAPI backend
├── packages/
│   └── prediction/             # Shared ML library
│       ├── models/svr-v1/      # .bin model files
│       ├── engine.py           # PredictionEngine implementation
│       └── tests/
├── docs/
│   ├── design.md               # This document
│   └── api.md                  # OpenAPI / endpoint reference (Phase 1)
├── docker-compose.yml
└── README.md
```

---

## 5. Data model

### Entity relationship

```
User 1──* Child 1──* Measurement
                 └──* Prediction
```

### Tables

#### `users`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | Internal ID |
| `auth_provider_id` | VARCHAR UNIQUE | e.g. Auth0 `sub` or Clerk user ID |
| `email` | VARCHAR | From auth provider |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

#### `children`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `user_id` | UUID FK → users | Owner |
| `display_name` | VARCHAR | e.g. "Alex" |
| `sex` | SMALLINT | 1 = male, 2 = female (matches model) |
| `date_of_birth` | DATE | Used to compute age at measurement |
| `parent_height_cm` | FLOAT NULL | Optional; unused in v1 model |
| `deleted_at` | TIMESTAMPTZ NULL | Soft delete |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

#### `measurements`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `child_id` | UUID FK → children | |
| `measured_at` | DATE | When measurement was taken |
| `age_years` | FLOAT | Snapshot at measurement time |
| `height_cm` | FLOAT | |
| `weight_kg` | FLOAT | |
| `bmi` | FLOAT | Computed, stored for query/chart speed |
| `source` | VARCHAR | `manual`, `import`, `clinic` |
| `notes` | TEXT NULL | Optional parent note |
| `created_at` | TIMESTAMPTZ | |

**Index:** `(child_id, measured_at DESC)`

#### `predictions`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `child_id` | UUID FK → children | |
| `measurement_id` | UUID FK → measurements | Snapshot used for prediction |
| `target_age_years` | FLOAT | e.g. 18.0 |
| `pred_height_cm` | FLOAT | |
| `pred_weight_kg` | FLOAT | |
| `pred_bmi` | FLOAT | |
| `model_version` | VARCHAR | e.g. `svr-v1` |
| `model_inputs` | JSONB | Full feature dict for audit/repro |
| `created_at` | TIMESTAMPTZ | Immutable record |

#### `llm_insights` (Phase 3+)

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `prediction_id` | UUID FK → predictions | |
| `prompt_version` | VARCHAR | e.g. `explain-v1` |
| `content` | TEXT | Generated narrative |
| `model` | VARCHAR | e.g. `gpt-4o-mini` |
| `created_at` | TIMESTAMPTZ | |

### Multi-tenancy

Every query on `children`, `measurements`, and `predictions` MUST filter by the authenticated user's `user_id`. Integration tests should assert no cross-user data access.

---

## 6. API design

Base path: `/api/v1`

Authentication: `Authorization: Bearer <JWT>` on all endpoints except health and optional anonymous predict.

### Health

```
GET /health
```

### Children

```
GET    /children
POST   /children
GET    /children/{child_id}
PATCH  /children/{child_id}
DELETE /children/{child_id}          # soft delete
```

**POST /children** body:

```json
{
  "display_name": "Alex",
  "sex": 1,
  "date_of_birth": "2019-03-15",
  "parent_height_cm": 175.0
}
```

### Measurements

```
GET    /children/{child_id}/measurements
POST   /children/{child_id}/measurements
GET    /children/{child_id}/measurements/{measurement_id}
PATCH  /children/{child_id}/measurements/{measurement_id}
DELETE /children/{child_id}/measurements/{measurement_id}
```

**POST** body:

```json
{
  "measured_at": "2026-08-10",
  "height_cm": 110.5,
  "weight_kg": 20.3,
  "source": "manual",
  "notes": "Annual checkup"
}
```

Server computes `age_years` from `date_of_birth` + `measured_at`, and `bmi` from height/weight.

### Predictions

```
POST   /children/{child_id}/predict
GET    /children/{child_id}/predictions
GET    /children/{child_id}/predictions/{prediction_id}
```

**POST /predict** body:

```json
{
  "target_age_years": 18,
  "measurement_id": "uuid-optional-defaults-to-latest"
}
```

**Response:**

```json
{
  "id": "uuid",
  "child_id": "uuid",
  "measurement_id": "uuid",
  "target_age_years": 18,
  "pred_height_cm": 175.2,
  "pred_weight_kg": 68.4,
  "pred_bmi": 22.3,
  "model_version": "svr-v1",
  "model_inputs": { "Sex": 1, "Height": 110.5, "...": "..." },
  "created_at": "2026-08-10T20:00:00Z"
}
```

### Growth chart (convenience)

```
GET /children/{child_id}/growth-summary
```

Returns measurements plus latest predictions per target age for chart rendering.

### Anonymous predict (optional, Phase 0–1)

```
POST /predict/anonymous
```

Same inputs as lab-surveys for parity testing; no persistence. Prompt signup to save results.

---

## 7. Prediction service

### Interface

```python
class PredictionEngine(Protocol):
    version: str

    def predict(self, inputs: PredictionInputs) -> PredictionOutputs:
        ...
```

### v1 implementation (`SVREngine`)

1. Validate inputs (ranges, required fields).
2. Compute BMI if not provided.
3. Build feature DataFrame with float dtypes (no integer truncation).
4. Run three SVR models.
5. Return `PredictionOutputs` with version tag.

Models loaded once in application lifespan:

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.prediction_engine = load_engine("svr-v1")
    yield
```

### Model artifact layout

```
packages/prediction/models/svr-v1/
├── childbmi_model_height.bin
├── childbmi_model_weight.bin
└── childbmi_model_bmi.bin
```

### Input validation (suggested ranges)

| Field | Min | Max |
|-------|-----|-----|
| Current age (years) | 0 | 18 |
| Target age (years) | Current age + 0.1 | 25 |
| Height (cm) | 40 | 220 |
| Weight (kg) | 2 | 150 |
| Sex | 1 | 2 |

---

## 8. Frontend features

### Pages

| Route | Purpose |
|-------|---------|
| `/` | Landing; optional anonymous quick predict |
| `/login`, `/signup` | Auth (Clerk/Auth0 components) |
| `/dashboard` | List of children |
| `/children/new` | Create child profile |
| `/children/[id]` | Child detail: latest prediction, chart, actions |
| `/children/[id]/measurements` | Measurement history |
| `/children/[id]/measurements/new` | Log measurement |
| `/children/[id]/predict` | Run / view predictions |

### Growth chart

- **X-axis:** age (years) or calendar date (toggle)
- **Y-axis:** height (cm); toggle weight / BMI
- **Series:** actual measurements (solid points); predictions at target age (distinct markers)
- **Interaction:** tap measurement → see prediction that used that snapshot

### Prediction comparison

When a new measurement is logged, show delta vs previous prediction at the same target age (e.g. "Predicted adult height updated from 172 cm to 175 cm").

---

## 9. LLM integration (future)

LLMs augment structured predictions; they do not replace SVR numbers in early phases.

### Phased LLM use

| Phase | Capability | Risk |
|-------|------------|------|
| 3a | Explain SVR results in plain language | Low |
| 3b | Q&A grounded on child's stored data | Medium |
| 3c | Ensemble / refine numeric predictions | High — needs validation |
| 4 | Full LLM predictor | Highest — clinical review |

### Architecture

```
PredictionContext
  ├── child metadata
  ├── measurement history[]
  ├── svr_prediction (always present)
  └── optional user question

        ↓
  PromptBuilder (versioned templates)
        ↓
  LLMProvider adapter (OpenAI, Anthropic, …)
        ↓
  OutputGuard (disclaimer, no diagnosis, length limits)
        ↓
  llm_insights row (linked to prediction_id)
```

### Principles

- Store prompt version and model name on every LLM output.
- Never overwrite `pred_*` fields from SVR without a new `model_version`.
- Always show medical disclaimer on LLM-generated text.
- v2 ML can add longitudinal features (height velocity, measurement count) using the same `measurements` table.

---

## 10. Authentication

### v1

- Self-serve email/password or social login via Clerk or Auth0.
- On first API request, upsert `users` row from JWT claims (`sub`, `email`).
- All child data scoped to `user_id`.

### v2 (optional)

- **Family sharing:** `child_collaborators` table (invited email, role `viewer` | `editor`).
- **Pediatrician share link:** time-limited read-only token for a child's growth summary.

---

## 11. Security & privacy

- HTTPS everywhere; JWT validation on every protected route.
- Soft-delete children; retain predictions only if required — define retention policy before launch.
- No training on user data without explicit opt-in consent.
- If targeting users under 13 (US): COPPA review before collecting child PII.
- Rate limiting on `/predict` and anonymous endpoints.
- Audit log for admin actions (future).

---

## 12. Deployment

### Environments

| Env | Purpose |
|-----|---------|
| `local` | Docker Compose: API + Postgres + web |
| `staging` | Pre-production; separate DB |
| `production` | Vercel + API host + managed Postgres |

### Environment variables (API)

```
DATABASE_URL=
AUTH_ISSUER=
AUTH_AUDIENCE=
AUTH_JWKS_URL=
MODEL_VERSION=svr-v1
MODEL_PATH=packages/prediction/models/svr-v1
CORS_ORIGINS=https://app.example.com
```

### CI

- Lint + typecheck (web, api)
- Unit tests for `packages/prediction`
- API integration tests with test DB
- Schema migrations via Alembic

---

## 13. Implementation phases

### Phase 0 — Foundation (≈1 week)

- [ ] Repo scaffold (`apps/`, `packages/`, Docker Compose)
- [ ] Copy `.bin` models into `packages/prediction/models/svr-v1/`
- [ ] Port prediction logic; unit tests against known lab-surveys outputs
- [ ] `POST /predict/anonymous` smoke endpoint
- [ ] CI pipeline

**Acceptance:** Prediction matches lab-surveys for same inputs (within float tolerance).

### Phase 1 — MVP (≈2–3 weeks)

- [ ] Auth integration (Clerk or Auth0)
- [ ] DB schema + migrations (`users`, `children`, `measurements`, `predictions`)
- [ ] CRUD APIs for children and measurements
- [ ] `POST /children/{id}/predict` with persistence
- [ ] Dashboard + child detail + log measurement + results UI
- [ ] Deploy staging

**Acceptance:** User can sign up, add a child, log a measurement, run prediction, see result.

### Phase 2 — History & polish (≈2 weeks)

- [ ] Growth chart with measurements and predictions
- [ ] Prediction history list + compare view
- [ ] Export child data (CSV)
- [ ] Model load at startup; float precision fix verified
- [ ] Error states, loading, empty states

**Acceptance:** Longitudinal use case works across multiple visits.

### Phase 3 — Smarter predictions (ongoing)

- [ ] Retrain model with velocity / history features (`svr-v2`)
- [ ] LLM "explain my results" (read-only narrative)
- [ ] A/B or shadow mode for new model versions

### Phase 4 — Scale & compliance

- [ ] Rate limiting, monitoring, alerting
- [ ] Privacy policy + consent flows
- [ ] Optional family sharing

---

## 14. Open decisions

| Decision | Recommendation | Notes |
|----------|----------------|-------|
| Auth provider | Clerk | Simpler DX; Auth0 if reusing lab-surveys org |
| Default target age | 18 years | Adult height; allow user override |
| Anonymous predict | Yes, with signup CTA | Lowers funnel friction |
| Backend | FastAPI | Django OK if team prefers ORM familiarity |
| Repo visibility | Private until launch | |

---

## 15. Success criteria

- p95 prediction latency &lt; 200 ms (in-process SVR)
- 100% of predictions stored with `model_version` and `model_inputs`
- Zero cross-user data leaks in auth integration tests
- User can log measurement and see updated prediction in ≤ 3 clicks from dashboard

---

## Appendix A — lab-surveys reference paths

| Resource | Path |
|----------|------|
| Prediction logic | `lab-surveys/backend/surveys/utils/child_bmi/child_bmi_survey.py` |
| Model files | `lab-surveys/backend/surveys/static/survey_files/child_bmi/*.bin` |
| Survey definition | `lab-surveys/backend/surveys/static/survey_files/child_bmi/child_bmi.json` |
| BMI helper | `lab-surveys/backend/surveys/utils/helpers.py` |

## Appendix B — Example prediction flow

```
1. User logs measurement (height, weight, date) for child
2. API computes age_years from DOB + measured_at
3. User requests prediction at target_age = 18
4. API loads latest measurement (or specified measurement_id)
5. SVREngine.predict() → pred_height, pred_weight, pred_bmi
6. Row inserted into predictions with model_inputs JSON
7. Frontend shows results + updates growth chart
```
