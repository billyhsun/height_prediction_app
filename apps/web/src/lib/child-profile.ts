import { sanitizeEthnicities } from "@/lib/ethnicities";

export function toChildProfile(child: {
  id: string;
  displayName: string;
  sex: number;
  dateOfBirth: Date;
  motherHeightCm: number | null;
  fatherHeightCm: number | null;
  ethnicities: string[];
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: child.id,
    displayName: child.displayName,
    sex: child.sex,
    dateOfBirth: child.dateOfBirth.toISOString().slice(0, 10),
    motherHeightCm: child.motherHeightCm,
    fatherHeightCm: child.fatherHeightCm,
    ethnicities: sanitizeEthnicities(child.ethnicities),
    createdAt: child.createdAt.toISOString(),
    updatedAt: child.updatedAt.toISOString(),
  };
}
