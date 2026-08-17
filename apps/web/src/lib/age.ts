/** Age in years from date of birth, rounded to nearest 0.5 (matches form step). */
export function ageYearsFromDateOfBirth(
  dateOfBirth: Date | string,
  asOf: Date = new Date(),
): number {
  const dob = typeof dateOfBirth === "string" ? new Date(dateOfBirth) : dateOfBirth;
  const msPerYear = 365.25 * 24 * 60 * 60 * 1000;
  const age = (asOf.getTime() - dob.getTime()) / msPerYear;
  return Math.round(age * 2) / 2;
}

export function formatDateOfBirth(dateOfBirth: Date | string): string {
  const dob = typeof dateOfBirth === "string" ? new Date(dateOfBirth) : dateOfBirth;
  return dob.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
