# Vercel deployment checklist

If you see **404 NOT_FOUND** on your Vercel URL, the most common cause is the **Root Directory** not being set to `apps/web`.

## Required Vercel project settings

Open your project in Vercel → **Settings → General**:

| Setting | Value |
|---------|--------|
| **Root Directory** | `apps/web` |
| **Framework Preset** | Next.js |
| **Build Command** | `npm run vercel-build` (from `apps/web/vercel.json`) |
| **Output Directory** | *(leave default — Next.js auto)* |
| **Install Command** | `npm install` *(default)* |
| **Node.js Version** | 20.x or 22.x |

### Root Directory (most important)

```
height_prediction_app/          ← repo root (do NOT use as Root Directory)
├── apps/
│   └── web/                    ← set Root Directory to: apps/web
│       ├── package.json
│       ├── next.config.ts
│       ├── vercel.json
│       ├── api/                  ← Python serverless functions
│       └── src/app/              ← Next.js pages (/, /results)
```

If Root Directory is blank or `.`, Vercel builds from the repo root where there is no Next.js app → **404 on every route**.

## Environment variables

**Settings → Environment Variables** (Production, Preview, Development):

| Variable | Required | Example |
|----------|----------|---------|
| `OPENAI_API_KEY` | For LLM predictions | `sk-...` |
| `OPENAI_MODEL` | Optional | `gpt-5.4-mini` |

**Do not set** `API_URL` on Vercel. That is only for local dev with a separate FastAPI server.

## Git settings

**Settings → Git**:

- Repository: `billyhsun/height_prediction_app`
- Production branch: `main`
- Vercel account linked to **billyhsun** GitHub

## After changing Root Directory

1. Save settings
2. Go to **Deployments** → latest deployment → **⋯ → Redeploy**
3. Wait for build to finish (check **Build Logs** for errors)

## Verify a successful deploy

Build logs should show:

```
> npm run vercel-build
> npm run copy-models && next build
✓ Compiled successfully
```

Then test:

- `https://your-app.vercel.app/` → form page (200)
- `https://your-app.vercel.app/results` → results page (200)

## Common build failures

| Error | Fix |
|-------|-----|
| `copy-models: cp: ... No such file` | Root Directory must be `apps/web` so `../../packages/...` resolves correctly |
| `sklearn` / Python function too large | Hobby plan 50MB limit; may need Pro or external API host |
| `Failed to build scikit-learn==1.0.2` | Fixed: `runtime.txt` pins Python 3.12; requirements use sklearn 1.5.2 wheels |
| `OPENAI_API_KEY is not configured` | Add env var in Vercel, redeploy |
| Deployment blocked (author) | Repo must be public or use billyhsun account; commit as `billyhsun` |

## Local parity check

```bash
cd apps/web
npm run vercel-build
npm run start
# open http://localhost:3000
```

Or:

```bash
cd apps/web
npx vercel dev
```
