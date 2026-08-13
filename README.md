# Height Prediction App

Basic v0: form → API → SVR prediction + optional LLM prediction with parent heights.

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

## Disclaimer

Informational estimates only. Not medical advice.
