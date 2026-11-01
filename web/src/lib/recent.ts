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

/** Keeps a route chosen on the front page for the search page, whichever way the visitor signs in. */
export function wantRoute(from: string, to: string): void {
  try {
    sessionStorage.setItem(WANTED, JSON.stringify({ from, to }));
  } catch {
    // They will choose it again.
  }
}

/** The route wanted, once. Null when there is none, or it names a place no longer listed. */
export function takeWantedRoute(): { from: string; to: string } | null {
  try {
    const stored = JSON.parse(sessionStorage.getItem(WANTED) ?? 'null') as { from?: string; to?: string } | null;
    sessionStorage.removeItem(WANTED);
    return stored?.from && stored.to && placeNamed(stored.from) && placeNamed(stored.to) ? { from: stored.from, to: stored.to } : null;
  } catch {
    return null;
  }
}
