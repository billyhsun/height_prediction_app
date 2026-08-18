import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client.
 *
 * This talks to PostgREST over HTTPS rather than opening a Postgres TCP
 * connection, which is what makes it work on Vercel: the direct database host
 * is IPv6-only and Vercel's functions are IPv4-only.
 *
 * It authenticates with the SECRET key, which bypasses row-level security. That
 * is safe only because every caller is a server-side route handler that scopes
 * its queries by the signed-in user's id. Never import this from a client
 * component, and never rename the env var to NEXT_PUBLIC_* — that would inline
 * the key into the browser bundle and hand every visitor full table access.
 */
let cached: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  }
  if (!secretKey) {
    throw new Error("SUPABASE_SECRET_KEY is not set");
  }

  cached = createClient(url, secretKey, {
    auth: {
      // We use Clerk, not Supabase Auth. Without this the client tries to
      // persist and refresh a session that will never exist.
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return cached;
}
