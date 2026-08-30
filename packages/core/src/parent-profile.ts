import { GenericRequestError } from "./request-error";
import { apiFetch } from "./http";

/**
 * Parent measurements held against the account.
 *
 * These describe the parents, not a child: they are the same for every child of
 * one family and an adult's height does not change, so asking for them once at
 * registration is better than asking on every prediction. Each field is
 * independently optional — the whole thing is skippable.
 */
export type ParentDefaults = {
  motherHeightCm: number | null;
  fatherHeightCm: number | null;
  motherWeightKg: number | null;
  fatherWeightKg: number | null;
};

export const EMPTY_PARENT_DEFAULTS: ParentDefaults = {
  motherHeightCm: null,
  fatherHeightCm: null,
  motherWeightKg: null,
  fatherWeightKg: null,
};

/**
 * Plausible adult ranges, used by both the client and the route handler.
 *
 * Deliberately wide: the point is to catch a unit mix-up or a typo (a height in
 * metres, a weight in pounds), not to police real bodies. The shortest and
 * tallest adults on record sit inside these bounds.
 */
export const PARENT_LIMITS = {
  heightCm: { min: 100, max: 250 },
  weightKg: { min: 30, max: 300 },
} as const;

export function isValidParentHeight(cm: number): boolean {
  return (
    Number.isFinite(cm) &&
    cm >= PARENT_LIMITS.heightCm.min &&
    cm <= PARENT_LIMITS.heightCm.max
  );
}

export function isValidParentWeight(kg: number): boolean {
  return (
    Number.isFinite(kg) &&
    kg >= PARENT_LIMITS.weightKg.min &&
    kg <= PARENT_LIMITS.weightKg.max
  );
}

/** Subset of a child carrying its own parent overrides. */
type ParentOverrides = {
  motherHeightCm: number | null;
  fatherHeightCm: number | null;
};

/**
 * Resolves which parent heights apply, child first.
 *
 * A child's own values win when set, because the per-child fields exist
 * precisely for the families the account default does not describe. Falling
 * back per field rather than per pair is intentional: a child recorded with only
 * one parent's height should still pick up the other from the account.
 */
export function resolveParentHeights(
  child: ParentOverrides | null | undefined,
  account: ParentDefaults | null | undefined,
): { motherHeightCm: number | null; fatherHeightCm: number | null } {
  return {
    motherHeightCm: child?.motherHeightCm ?? account?.motherHeightCm ?? null,
    fatherHeightCm: child?.fatherHeightCm ?? account?.fatherHeightCm ?? null,
  };
}

/** True when the account has nothing recorded, i.e. onboarding was skipped. */
export function isParentDefaultsEmpty(defaults: ParentDefaults): boolean {
  return (
    defaults.motherHeightCm === null &&
    defaults.fatherHeightCm === null &&
    defaults.motherWeightKg === null &&
    defaults.fatherWeightKg === null
  );
}

/**
 * Signed-out callers get empty defaults rather than an error: the prediction
 * form is usable as a guest, and a 401 here is an expected state, not a fault.
 */
export async function fetchParentDefaults(): Promise<ParentDefaults> {
  const res = await apiFetch("/api/user/profile");
  if (res.status === 401) return EMPTY_PARENT_DEFAULTS;
  if (!res.ok) {
    throw new GenericRequestError("GET /user/profile failed", res.status);
  }
  return res.json();
}

export async function saveParentDefaults(
  input: Partial<ParentDefaults>,
): Promise<ParentDefaults> {
  const res = await apiFetch("/api/user/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (err.error) throw new Error(err.error);
    throw new GenericRequestError("PATCH /user/profile failed", res.status);
  }
  return res.json();
}
