import { clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { requireDbUser } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

/**
 * Permanently deletes the signed-in user's account.
 *
 * Two systems hold state and both have to be cleared: Supabase holds the app
 * data, Clerk holds the identity. Deleting only one leaves either orphaned rows
 * or an account that can still sign in.
 *
 * ORDER MATTERS — app data first, Clerk second:
 *
 *   - If Clerk went first and the database delete then failed, the rows would be
 *     orphaned and the user could no longer authenticate to retry. That needs
 *     manual intervention to fix.
 *   - This way round, a failure after the data is gone is recoverable: the user
 *     can retry, and signing in again just creates a fresh empty User row.
 *
 * One `DELETE` on "User" is enough for the data. Both `Child.userId` and
 * `Prediction.userId` are declared `ON DELETE CASCADE`, so children (including
 * soft-deleted ones, which are ordinary rows with `deletedAt` set) and every
 * saved prediction go with it.
 *
 * This is a hard delete with no retention. Keeping predictions as training data
 * would need a lawful basis to do so, and the opt-in consent flag that
 * docs/design.md §11 requires does not exist yet. Retention can be added later
 * as an additive change once consent is actually being collected.
 */
export async function DELETE() {
  const { user, errorResponse } = await requireDbUser();
  if (errorResponse) return errorResponse;

  // 1. App data. Cascades to Child and Prediction.
  try {
    const { error } = await getSupabase()
      .from("User")
      .delete()
      .eq("id", user.id);

    if (error) throw new Error(error.message);
  } catch (error) {
    console.error("Failed to delete account data:", error);
    return NextResponse.json(
      { error: "Failed to delete your data. Nothing was removed." },
      { status: 500 },
    );
  }

  // 2. Identity. The data is already gone at this point, so a failure here is
  //    reported distinctly — retrying is safe and will succeed.
  try {
    const client = await clerkClient();
    await client.users.deleteUser(user.clerkId);
  } catch (error) {
    console.error(
      `Deleted data for user ${user.id} but failed to delete Clerk user ${user.clerkId}:`,
      error,
    );
    return NextResponse.json(
      {
        error:
          "Your data was deleted but your sign-in could not be removed. Please try again.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
