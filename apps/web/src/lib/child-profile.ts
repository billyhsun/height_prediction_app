import { sanitizeEthnicities } from "@/lib/ethnicities";

export type ChildRow = {
  id: string;
  userId: string;
  displayName: string;
  sex: number;
  dateOfBirth: string;
  motherHeightCm: number | null;
  fatherHeightCm: number | null;
  ethnicities: string[] | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

/**
 * PostgREST returns `timestamp without time zone` columns with no offset
 * (e.g. "2026-08-17T21:15:21.68"). Those values were written as UTC, so we tag
 * them as UTC before parsing — otherwise the runtime interprets them in the
 * server's local zone and every timestamp silently shifts.
 */
export function toIsoString(value: string): string {
  const hasZone = /([Zz]|[+-]\d{2}:?\d{2})$/.test(value);
  const parsed = new Date(hasZone ? value : `${value}Z`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

export function toChildProfile(child: ChildRow) {
  return {
    id: child.id,
    displayName: child.displayName,
    sex: child.sex,
    // Already "YYYY-MM-DD" from a DATE column; slice guards against a full
    // timestamp if the column type ever changes.
    dateOfBirth: child.dateOfBirth.slice(0, 10),
    motherHeightCm: child.motherHeightCm,
    fatherHeightCm: child.fatherHeightCm,
    ethnicities: sanitizeEthnicities(child.ethnicities ?? []),
    createdAt: toIsoString(child.createdAt),
    updatedAt: toIsoString(child.updatedAt),
  };
}
