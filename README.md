# Child Height Predictor

Basic v0: form → API → SVR prediction + optional LLM prediction with parent heights.

App logo: `apps/web/public/logo.png` (growth chart + child silhouette).

## Quick start

### 1. API

```bash
cp apps/api/.env.example apps/api/.env
# Add your OPENAI_API_KEY to apps/api/.env for LLM predictions

chmod +x apps/api/run.sh
./apps/api/run.sh
```

API runs at http://localhost:8000. Try `GET /health` or `POST /api/v1/predict`.

### 2. Web (use this in your browser)

```bash
cd apps/web
npm run dev
```

Open **http://localhost:3000** — not port 8000. Port 8000 is the API only.

The web app proxies `/api/*` to the API via `next.config.ts`, so you don't need `.env.local` for local dev.

## Project structure

```
apps/
  api/          FastAPI prediction endpoint
  web/          Next.js form + results
packages/
  prediction/   SVR engine + model files
```

## API example

```bash
curl -X POST http://localhost:8000/api/v1/predict \
  -H "Content-Type: application/json" \
  -d '{"sex":1,"height_cm":110,"weight_kg":20,"current_age_years":5,"target_age_years":18}'

curl -X POST http://localhost:8000/api/v1/predict/llm \
  -H "Content-Type: application/json" \
  -d '{"sex":1,"height_cm":110,"weight_kg":20,"current_age_years":5,"target_age_years":18,"mother_height_cm":165,"father_height_cm":178}'
```

## Predictions

- **ML (SVR)** — always runs from child measurements; served by the Google Cloud backend
- **LLM** — runs in this app when both parent heights are provided; uses OpenAI (`gpt-5.4-mini` by default, via `OPENAI_MODEL`)

## Docs

- [System design](docs/design.md) — full architecture and roadmap
- [Prediction backend](docs/prediction-api.md) — the ML endpoint contract and auth
- [Auth & profiles setup](docs/auth-setup.md) — Clerk, Postgres, guest vs signed-in

## Disclaimer

Informational estimates only. Not medical advice.

## Deploy to Vercel

The web app is pure Next.js — no Python is deployed to Vercel. The **ML model** runs on the Google Cloud backend (`lab-surveys-backend`), reached through route handlers under `src/app/api/v1/`. The **LLM layer** runs in this app, since that backend serves the ML model only.

### 1. Import project in Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import `height_prediction_app` from GitHub
2. Set **Root Directory** to `apps/web` ← **required; wrong root causes 404**
3. Framework preset: **Next.js** (auto-detected)

See **[Vercel deployment checklist](docs/vercel-deployment.md)** if you get 404 or build errors.

### 2. Environment variables

In Vercel → Project → Settings → Environment Variables:

| Variable | Required | Notes |
|----------|----------|-------|
| `PREDICTION_API_URL` | Yes | Base URL of the ML backend on Cloud Run (lab-surveys-backend) |
| `PREDICTION_API_TOKEN` | Only if the backend is private | See [prediction backend](docs/prediction-api.md) |
| `PREDICTION_MODEL_VERSION` | Optional | Recorded on every prediction. Default `svr-v1` |
| `OPENAI_API_KEY` | For LLM predictions | The LLM layer runs here, not on the ML backend |
| `OPENAI_MODEL` | Optional | Default `gpt-5.4-mini` |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SECRET_KEY` | Yes | Server-only. Never prefix with `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | From Clerk dashboard |
| `CLERK_SECRET_KEY` | Yes | From Clerk dashboard |

Do **not** set a `/api/*` rewrite on Vercel. It would be applied before dynamic routes and would hijack `/api/user/children/[id]`.

### 3. Deploy

Click Deploy. The build is just `next build`.

Your app will be live at `https://your-project.vercel.app`.

### Local development

Point `PREDICTION_API_URL` at either the deployed backend or a local FastAPI:

```bash
./apps/api/run.sh          # terminal 1 — serves http://localhost:8000
cd apps/web && npm run dev # terminal 2 — set PREDICTION_API_URL=http://localhost:8000
```

To develop against the deployed backend instead, set `PREDICTION_API_URL` to the Cloud Run URL and skip terminal 1.
