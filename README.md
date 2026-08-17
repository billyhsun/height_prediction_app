# Height Prediction App

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

- **ML (SVR)** — always runs from child measurements (same model as lab-surveys)
- **LLM** — runs when both parent heights are provided; uses OpenAI (`gpt-5.4-mini` by default, set via `OPENAI_MODEL`)

## Docs

- [System design](docs/design.md) — full architecture and roadmap
- [Auth & profiles setup](docs/auth-setup.md) — Clerk, Postgres, guest vs signed-in

## Disclaimer

Informational estimates only. Not medical advice.

## Deploy to Vercel

The web app includes Python serverless functions so everything runs on Vercel (no separate API host needed).

### 1. Import project in Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import `height_prediction_app` from GitHub
2. Set **Root Directory** to `apps/web` ← **required; wrong root causes 404**
3. Framework preset: **Next.js** (auto-detected)

See **[Vercel deployment checklist](docs/vercel-deployment.md)** if you get 404 or build errors.

### 2. Environment variables

In Vercel → Project → Settings → Environment Variables:

| Variable | Required | Notes |
|----------|----------|-------|
| `OPENAI_API_KEY` | For LLM predictions | From OpenAI dashboard |
| `OPENAI_MODEL` | Optional | Default: `gpt-5.4-mini` |

Do **not** set `API_URL` on Vercel.

### 3. Deploy

Click Deploy. The build runs `copy-models` (copies SVR `.bin` files) then `next build`.

Your app will be live at `https://your-project.vercel.app`.

### Local development

**Option A — separate FastAPI (current workflow):**
```bash
./apps/api/run.sh          # terminal 1
cd apps/web && cp .env.local.example .env.local && npm run dev   # terminal 2
```

**Option B — Vercel dev (matches production):**
```bash
cd apps/web
npx vercel dev
```
