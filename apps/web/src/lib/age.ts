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

/**
 * `locale` is passed explicitly rather than relying on the runtime default so
 * the rendered date follows the chosen UI language, not the browser's or the
 * server's. Chinese renders as "2018年5月4日", English as "May 4, 2018".
 */
export function formatDateOfBirth(
  dateOfBirth: Date | string,
  locale?: string,
): string {
  const dob = typeof dateOfBirth === "string" ? new Date(dateOfBirth) : dateOfBirth;
  return dob.toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
