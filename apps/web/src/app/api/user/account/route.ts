import { clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { requireDbUser } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";
import { getSupabase } from "@/lib/supabase";

/**
 * Permanently deletes the signed-in user's account.
 *
 * Three systems hold state and all have to be cleared: Stripe holds the
 * subscription, Supabase holds the app data, Clerk holds the identity. Deleting
 * only some leaves a card being charged for a deleted account, orphaned rows, or
 * an account that can still sign in.
 *
 * ORDER MATTERS — billing first, app data second, Clerk last:
 *
 *   - Billing goes first because it is the one that costs the user money. If it
 *     fails, nothing else has been touched and they can simply retry. Done the
 *     other way round, a Stripe failure after the User row is gone would leave
 *     a live subscription with no record of which customer it belongs to.
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

  // 1. Billing. Deleting the Stripe customer cancels any subscription at once
  //    (no further charges) and removes stored cards; Stripe keeps the past
  //    invoices and payments, which are financial records rather than ours to
  //    erase. It does not refund the unused part of the period.
  if (user.stripeCustomerId) {
    try {
      await getStripe().customers.del(user.stripeCustomerId);
    } catch (error) {
      // Already gone (deleted in the dashboard, or by an earlier attempt that
      // failed later on) is the outcome we wanted.
      const code = (error as { code?: string }).code;
      if (code !== "resource_missing") {
        console.error("Failed to delete Stripe customer:", error);
        return NextResponse.json(
          {
            error:
              "Could not cancel your subscription, so nothing was removed. Please try again.",
          },
          { status: 500 },
        );
      }
    }
  }

  // 2. App data. Cascades to Child and Prediction.
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

  // 3. Identity. The data is already gone at this point, so a failure here is
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
