// Small conveniences kept in this browser: places chosen lately, and a route picked on the front
// page before signing in. A browser that keeps nothing simply offers neither.

import { placeNamed } from './places';

const RECENT = 'vayora.recent-places';
const WANTED = 'vayora.wanted-route';
const KEPT = 4;

export function recentPlaces(): string[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(RECENT) ?? '[]');
    return Array.isArray(stored) ? stored.filter((name): name is string => typeof name === 'string' && placeNamed(name) !== undefined).slice(0, KEPT) : [];
  } catch {
    return [];
  }
}

export function rememberPlace(name: string): void {
  try {
    localStorage.setItem(RECENT, JSON.stringify([name, ...recentPlaces().filter((known) => known !== name)].slice(0, KEPT)));
  } catch {
    // It simply will not be offered next time.
  }
}

export interface WantedRoute {
  from: string;
  to: string;
  /** YYYY-MM-DD, in India. */
  date?: string;
  seats?: number;
}

/** Keeps a search chosen on the front page for the search page, whichever way the visitor signs in. */
export function wantRoute(wanted: WantedRoute): void {
  try {
    sessionStorage.setItem(WANTED, JSON.stringify(wanted));
  } catch {
    // They will choose it again.
  }
}

/** Whether a search chosen on the front page is waiting, left where it is. */
export function hasWantedRoute(): boolean {
  try {
    return sessionStorage.getItem(WANTED) !== null;
  } catch {
    return false;
  }
}

/**
 * The search wanted, left in place: a render React throws away (a page still loading, say) must
 * not lose it, so it is forgotten separately, once the page is on screen. Null when there is none,
 * or it names a place no longer listed; a date already past, or seats out of range, are left out
 * rather than carried over.
 */
export function readWantedRoute(today: string): WantedRoute | null {
  try {
    const stored = JSON.parse(sessionStorage.getItem(WANTED) ?? 'null') as Partial<WantedRoute> | null;
    if (!stored?.from || !stored.to || !placeNamed(stored.from) || !placeNamed(stored.to)) return null;
    const date = typeof stored.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(stored.date) && stored.date >= today ? stored.date : undefined;
    const seats = Number.isInteger(stored.seats) && stored.seats! >= 1 && stored.seats! <= 8 ? stored.seats : undefined;
    return { from: stored.from, to: stored.to, date, seats };
  } catch {
    return null;
  }
}

/** The search wanted has been used: it is not offered again. */
export function forgetWantedRoute(): void {
  try {
    sessionStorage.removeItem(WANTED);
  } catch {
    // Nothing was kept.
  }
}
