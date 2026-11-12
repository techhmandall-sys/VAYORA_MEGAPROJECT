// Times in India's time zone whatever the phone's is, worked out by hand so that every phone shows
// the same thing. Money in rupees, with Latin digits in every language, as the web app does.

const IST_MINUTES = 330;
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A moment shifted so that its UTC fields read as India's clock. */
const inIndia = (iso: string): Date => new Date(new Date(iso).getTime() + IST_MINUTES * 60_000);

export function formatTime(iso: string): string {
  const d = inIndia(iso);
  const hours = d.getUTCHours();
  return `${hours % 12 || 12}:${String(d.getUTCMinutes()).padStart(2, '0')} ${hours < 12 ? 'am' : 'pm'}`;
}

export function formatDay(iso: string): string {
  const d = inIndia(iso);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export const formatDateTime = (iso: string): string => `${formatDay(iso)}, ${formatTime(iso)}`;

/** Today's date in India, as YYYY-MM-DD. */
export function todayInIndia(now: number = Date.now()): string {
  return new Date(now + IST_MINUTES * 60_000).toISOString().slice(0, 10);
}

export function addDays(day: string, days: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** A YYYY-MM-DD day as "Wed 12 Nov". */
export function formatDayOf(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return `${DAYS[date.getUTCDay()]} ${d} ${MONTHS[m - 1]}`;
}

/** A day and a clock time in India, as the instant the server expects. */
export function indiaToIso(day: string, hour: number, minute: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, hour, minute) - IST_MINUTES * 60_000).toISOString();
}

export function rupees(amount: number): string {
  return `₹${Number.isInteger(amount) ? amount : amount.toFixed(2)}`;
}

export function minutesBetween(fromIso: string, toIso: string): number {
  return Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 60_000);
}
