export type AgeYearsMonths = { years: number; months: number };

export const MONTHS_PER_YEAR = 12;

/** Whole months, the unit both entry modes agree on. See `ageYearsFromMonths`. */
function totalMonths(age: AgeYearsMonths): number {
  return age.years * MONTHS_PER_YEAR + age.months;
}

type CalendarDate = { year: number; month: number; day: number };

/**
 * Calendar components, deliberately without going through Date for strings.
 *
 * `new Date("2019-05-04")` is parsed as UTC midnight, so reading local
 * components back off it lands on May 3rd anywhere west of Greenwich. Every
 * date of birth in this app travels as "YYYY-MM-DD" — a DATE column, a date
 * input's value — so it is split as text and never acquires a time zone at all.
 * A Date argument is read in local time, which is the only sensible reading of
 * one a caller constructed themselves.
 */
function toCalendarDate(value: Date | string): CalendarDate {
  if (typeof value !== "string") {
    return {
      year: value.getFullYear(),
      month: value.getMonth() + 1,
      day: value.getDate(),
    };
  }
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return { year, month, day };
}

/**
 * Age as whole years and leftover whole months, the way a parent states it.
 *
 * Counts calendar months rather than dividing elapsed milliseconds, so a child
 * born on the 20th turns "3 years 1 month" on the 20th of the following month
 * regardless of how many days that month happened to have.
 *
 * A date in the future clamps to zero instead of going negative: the form
 * rejects one with a message, and nothing downstream benefits from a negative
 * age reaching it in the meantime.
 */
export function ageBreakdownFromDateOfBirth(
  dateOfBirth: Date | string,
  asOf: Date = new Date(),
): AgeYearsMonths {
  const born = toCalendarDate(dateOfBirth);
  const today = toCalendarDate(asOf);

  let months =
    (today.year - born.year) * MONTHS_PER_YEAR + (today.month - born.month);
  // The day of the month has not come round yet, so the last month is not whole.
  if (today.day < born.day) months -= 1;
  if (months < 0) months = 0;

  return ageYearsMonthsFromMonths(months);
}

export function ageYearsMonthsFromMonths(months: number): AgeYearsMonths {
  const whole = Math.max(0, Math.round(months));
  return {
    years: Math.floor(whole / MONTHS_PER_YEAR),
    months: whole % MONTHS_PER_YEAR,
  };
}

/** Decimal years, which is what the prediction API takes. */
export function ageYearsFromMonths(months: number): number {
  return months / MONTHS_PER_YEAR;
}

export function ageYearsFromYearsMonths(age: AgeYearsMonths): number {
  return ageYearsFromMonths(totalMonths(age));
}

/**
 * Splits decimal years back into years and months.
 *
 * Needed because `current_age_years` is what travels in the URL and in every
 * stored prediction, so the split fields have to be seeded from it.
 */
export function ageBreakdownFromYears(years: number): AgeYearsMonths {
  return ageYearsMonthsFromMonths(years * MONTHS_PER_YEAR);
}

/**
 * Age in decimal years from a date of birth.
 *
 * Quantised to whole months, via the calendar breakdown, so that entering a date
 * and entering the equivalent years-and-months produce the identical number.
 * Without that the two entry modes would disagree by up to a few days' worth of
 * a year and a user switching between them would watch the prediction shift for
 * no visible reason. The cost is at most half a month of resolution, against a
 * model whose horizon is measured in years — and it is far finer than the
 * nearest-half-year rounding this replaces.
 */
export function ageYearsFromDateOfBirth(
  dateOfBirth: Date | string,
  asOf: Date = new Date(),
): number {
  return ageYearsFromYearsMonths(ageBreakdownFromDateOfBirth(dateOfBirth, asOf));
}

/** Today as "YYYY-MM-DD" in local time, for a date input's `max`. */
export function todayIsoDate(asOf: Date = new Date()): string {
  const month = String(asOf.getMonth() + 1).padStart(2, "0");
  const day = String(asOf.getDate()).padStart(2, "0");
  return `${asOf.getFullYear()}-${month}-${day}`;
}

/**
 * True for a real calendar date in "YYYY-MM-DD" form that is not in the future.
 *
 * The round-trip through Date.UTC is what rejects the dates that pass a regex
 * but do not exist — 2025-02-30 normalises to March 2nd, so the components come
 * back different from the ones that went in.
 */
export function isValidDateOfBirth(
  value: string,
  asOf: Date = new Date(),
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const { year, month, day } = toCalendarDate(value);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() + 1 !== month ||
    parsed.getUTCDate() !== day
  ) {
    return false;
  }

  return value <= todayIsoDate(asOf);
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
  const { year, month, day } = toCalendarDate(dateOfBirth);
  // Built in UTC and rendered in UTC, so the components survive formatting
  // unchanged. Passing the raw string to Date would reintroduce the off-by-one
  // day that toCalendarDate exists to avoid.
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
