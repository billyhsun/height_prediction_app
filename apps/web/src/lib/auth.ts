import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { getSupabase } from "@/lib/supabase";

export type DbUser = {
  id: string;
  clerkId: string;
  email: string | null;
};

type RequireDbUserResult =
  | { user: DbUser; errorResponse: null }
  | { user: null; errorResponse: NextResponse };

export async function getAuthUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}

export async function getOrCreateDbUser(): Promise<DbUser | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const clerkUser = await currentUser();
  const email =
    clerkUser?.emailAddresses.find(
      (entry) => entry.id === clerkUser.primaryEmailAddressId,
    )?.emailAddress ??
    clerkUser?.emailAddresses[0]?.emailAddress ??
    null;

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("User")
    .upsert({ clerkId: userId, email }, { onConflict: "clerkId" })
    .select("id, clerkId, email")
    .single();

  if (error) {
    // supabase-js reports query failures in `error` rather than throwing, so
    // this has to be raised explicitly for requireDbUser to catch it.
    throw new Error(`Supabase upsert on "User" failed: ${error.message}`);
  }

  return data as DbUser;
}

/**
 * Resolves the signed-in user's database record.
 *
 * `getOrCreateDbUser` writes to the database, so it fails when the database is
 * unreachable. Route handlers call it before their own try/catch, which would
 * otherwise surface that as an unhandled 500 with no JSON body. This wraps it so
 * callers can tell "not signed in" (401) apart from "database is down" (503).
 */
export async function requireDbUser(): Promise<RequireDbUserResult> {
  let user: DbUser | null;

  try {
    user = await getOrCreateDbUser();
  } catch (error) {
    console.error("Failed to resolve user record:", error);
    return {
      user: null,
      errorResponse: NextResponse.json(
        { error: "Service temporarily unavailable" },
        { status: 503 },
      ),
    };
  }

  if (!user) {
    return {
      user: null,
      errorResponse: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      ),
    };
  }

  return { user, errorResponse: null };
}
