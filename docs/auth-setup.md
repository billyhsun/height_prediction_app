# Auth & user profiles setup

Logged-in users can save predictions to a personal history. Guests can still run predictions without saving.

## 1. Clerk (authentication)

1. Create an app at [clerk.com](https://clerk.com)
2. Enable **Email** sign-in (and social providers if you want)
3. Copy keys into Vercel env vars (and local `.env.local`):

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `CLERK_SECRET_KEY` | Clerk secret key |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` |

## 2. Postgres (saved predictions)

Use **Vercel Postgres**, **Neon**, or **Supabase**.

1. Create a database
2. Copy the **Postgres connection string** (not the Supabase REST/API URL) to `POSTGRES_URL`
   - Supabase: **Project Settings → Database → Connection string → URI** (port `5432` or pooler `6543`)
   - If using Supabase pooler (port 6543), append `?pgbouncer=true`
3. Run migrations:

```bash
cd apps/web
cp .env.local.example .env.local
# fill in POSTGRES_URL and Clerk keys
npm install
npm run db:sync
```

On Vercel, add `POSTGRES_URL` in project env vars. The build runs `prisma generate` automatically via `vercel-build`.

Run schema migrations separately (not during the Vercel build):

## 3. Behavior

| Mode | Predict | Save to DB | History page |
|------|---------|------------|--------------|
| Guest | Yes | No | N/A (redirects to sign-in) |
| Signed in | Yes | Yes | `/history` |

## 4. API routes (Next.js)

| Route | Auth | Purpose |
|-------|------|---------|
| `GET /api/user/predictions` | Required | List saved predictions |
| `POST /api/user/predictions` | Required | Save a prediction |
| `GET /api/user/predictions/[id]` | Required | Load one saved prediction |
| `DELETE /api/user/predictions/[id]` | Required | Delete a saved prediction |

ML/LLM prediction endpoints (`/api/v1/predict`) remain public for guest mode.

## 5. Local development

```bash
# Terminal 1 — optional if not using Vercel Python functions locally
./apps/api/run.sh

# Terminal 2
cd apps/web
cp .env.local.example .env.local
npm install
npx prisma db push
npm run dev
```

Without `API_URL`, use `npx vercel dev` to run Python functions locally, or set `API_URL=http://localhost:8000` to use FastAPI.
