import { getSupabase } from "@/lib/supabase";
import { sanitizeEthnicities } from "@/lib/ethnicities";

/**
 * Collection of predictions run without an account.
 *
 * Gated on ENABLE_GUEST_DATA_COLLECTION so it can be switched off without a code
 * change if the compliance position changes.
 *
 * Two properties of that flag are deliberate:
 *
 *   - It is NOT prefixed NEXT_PUBLIC_, so it never reaches the browser and
 *     cannot be flipped by a client.
 *   - It FAILS CLOSED. Only the exact string "true" enables collection, so a
 *     missing, misspelled, or empty value collects nothing. For a switch whose
 *     whole purpose is compliance, the safe state has to be the default.
 */
export function isGuestCollectionEnabled(): boolean {
  return process.env.ENABLE_GUEST_DATA_COLLECTION === "true";
}

export type GuestPredictionRecord = {
  sex: number;
  heightCm: number;
  weightKg: number;
  currentAgeYears: number;
  targetAgeYears: number;
  motherHeightCm: number | null;
  fatherHeightCm: number | null;
  ethnicities: string[];
  predHeightCm: number;
  predWeightKg: number;
  predBmi: number;
  modelVersion: string;
  llmPredHeightCm: number | null;
  llmModel: string | null;
};

/**
 * Writes one guest prediction. No-op when the flag is off.
 *
 * Records only the model's inputs and outputs. It does not record — and the
 * table has no column for — a user id, IP address, user agent, or session
 * identifier. Nothing here can be traced to a person or joined across requests.
 *
 * That is also the cost: with no stable key, two predictions for the same child
 * cannot be linked, so this yields cross-sectional snapshots rather than the
 * before/after pairs that supervised training of "future height" needs.
 *
 * Never throws. A failure to collect analytics must not fail a user's
 * prediction, so errors are logged and swallowed. Returns whether the row was
 * actually written, so callers can report honestly instead of assuming success.
 */
export async function recordGuestPrediction(
  record: GuestPredictionRecord,
): Promise<boolean> {
  if (!isGuestCollectionEnabled()) return false;

  try {
    const { error } = await getSupabase()
      .from("GuestPrediction")
      .insert({
        ...record,
        ethnicities: sanitizeEthnicities(record.ethnicities),
      });

    if (error) throw new Error(error.message);
    return true;
  } catch (error) {
    console.error("Failed to record guest prediction:", error);
    return false;
  }
}
