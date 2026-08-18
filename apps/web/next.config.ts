import type { NextConfig } from "next";

/**
 * No API rewrite.
 *
 * There used to be a `/api/:path*` rewrite to a separate FastAPI server. It was
 * removed for two reasons:
 *
 *  1. Prediction requests now go through route handlers under
 *     `src/app/api/v1/`, which call the Google Cloud backend server-side. There
 *     is nothing left for a rewrite to forward.
 *
 *  2. It was actively breaking dynamic routes. A `rewrites()` that returns an
 *     array is applied as `afterFiles` — after static and non-dynamic routes,
 *     but BEFORE dynamic ones. An external destination always resolves, so with
 *     the rewrite active, `/api/user/children/[id]` was proxied away instead of
 *     reaching its handler: `/api/user/children` returned 401 as expected while
 *     `/api/user/children/abc` returned 500. That silently broke editing and
 *     deleting a child in any environment where the rewrite was configured.
 *
 * If a future rewrite is needed for `/api/*`, scope it to an exact path rather
 * than a wildcard that overlaps the app's own API routes.
 */
const nextConfig: NextConfig = {};

export default nextConfig;
