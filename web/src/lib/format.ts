// Dates, times, money and distances, in the language the reader chose. Times are shown
// in India's time zone whatever the browser's is.

const ZONE = 'Asia/Kolkata';

const LOCALES = { en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN' } as const;
type FormatLanguage = keyof typeof LOCALES;

let language: FormatLanguage = 'en';

/** Called by the language provider. Components re-render with it, so they pick this up. */
export function setFormatLanguage(next: FormatLanguage): void {
  language = next;
}

// Latin digits in every language: a fare or a time must read the same to a passenger
// and a driver who chose different languages.
const options = (extra: Intl.DateTimeFormatOptions): Intl.DateTimeFormatOptions => ({
  timeZone: ZONE,
  numberingSystem: 'latn',
  ...extra,
});

const cache = new Map<string, Intl.DateTimeFormat>();

function dateFormat(name: string, extra: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${language}:${name}`;
  let format = cache.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(LOCALES[language], options(extra));
    cache.set(key, format);
  }
  return format;
}

export const formatDateTime = (iso: string): string =>
  dateFormat('dateTime', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(
    new Date(iso),
  );

/** With the year, for a record such as a receipt. */
export const formatFullDateTime = (iso: string): string =>
  dateFormat('fullDateTime', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(
    new Date(iso),
  );

export const formatTime = (iso: string): string => dateFormat('time', { hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

/** A short day name on its own, for a compact card that has no room for the full date. */
export const formatWeekday = (iso: string): string => dateFormat('weekday', { weekday: 'short' }).format(new Date(iso));

export const formatDate = (iso: string): string =>
  dateFormat('date', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));

/** A day and a short month, for a chart's axis. */
export const formatDayMonth = (iso: string): string => dateFormat('dayMonth', { day: 'numeric', month: 'short' }).format(new Date(iso));

export const formatMonthYear = (iso: string): string => dateFormat('monthYear', { month: 'long', year: 'numeric' }).format(new Date(iso));

export const formatRupees = (amount: number): string =>
  new Intl.NumberFormat(LOCALES[language], {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
    numberingSystem: 'latn',
  }).format(amount);

/** To the paisa, as a receipt states it. */
export const formatExactRupees = (amount: number): string =>
  new Intl.NumberFormat(LOCALES[language], {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    numberingSystem: 'latn',
  }).format(amount);

export const formatPercent = (fraction: number): string =>
  new Intl.NumberFormat(LOCALES[language], { style: 'percent', maximumFractionDigits: 0, numberingSystem: 'latn' }).format(fraction);

export const formatOneDecimal = (value: number): string =>
  new Intl.NumberFormat(LOCALES[language], { minimumFractionDigits: 1, maximumFractionDigits: 1, numberingSystem: 'latn' }).format(value);

/** A distance as a number and a unit to translate: metres when short, else kilometres. */
export function distanceParts(metres: number): { value: string; unit: 'm' | 'km' } {
  return metres < 1000
    ? { value: String(Math.round(metres / 10) * 10), unit: 'm' }
    : { value: (metres / 1000).toFixed(1), unit: 'km' };
}

/** A duration as whole hours and the minutes left over. */
export function durationParts(minutes: number): { hours: number; minutes: number } {
  return { hours: Math.floor(minutes / 60), minutes: minutes % 60 };
}

/** Today's date in India, as the yyyy-mm-dd a date input wants. */
export function todayInIndia(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONE }).format(now);
}

/** When an unanswered request is closed: so long after it was made, or so long before boarding, whichever is sooner. */
export function answerBy(createdAt: string, boardingTime: string, terms: { answerWithinMinutes: number; closesMinutesBeforeBoarding: number }): string {
  const byAge = Date.parse(createdAt) + terms.answerWithinMinutes * 60_000;
  const byBoarding = Date.parse(boardingTime) - terms.closesMinutesBeforeBoarding * 60_000;
  return new Date(Math.min(byAge, byBoarding)).toISOString();
}
