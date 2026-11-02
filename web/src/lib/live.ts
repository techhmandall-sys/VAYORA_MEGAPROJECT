// What keeps a screen current without a reload: how often each thing is read again, and a clock
// for what counts down. react-query stops its timers while the tab is hidden, so a phone in a
// pocket asks for nothing.
//
// Never read /rides/search on a timer. Each search writes search_issued and candidates_returned
// to the event log, and a screen refreshing itself would bend completed rides per 100 searches,
// the project's primary metric. /rides/availability gives the same seat count and records nothing.

import { useEffect, useState } from 'react';

export const LIVE_MS = {
  /** The cheapest read there is, and what tells every other list that something happened. */
  unread: 15_000,
  /** Bookings, a driver's rides, an administrator's figures. */
  lists: 30_000,
  /** Seats left on the results on screen. */
  seats: 20_000,
} as const;

/** The time now, updated this often, for whatever counts down or says how long ago. */
export function useNow(everyMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), everyMs);
    return () => window.clearInterval(timer);
  }, [everyMs]);
  return now;
}

/** Whether the browser believes it is connected, kept current. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine !== false);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine !== false);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online;
}

/** Minutes and seconds, for a short countdown such as a seat hold. */
export function clockFace(milliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** The share of the fare owed on cancelling now, and when it next rises, by the tiers a booking is cancelled under. */
export function owedNow(
  tiers: readonly { atLeastHoursBefore: number; owedShare: number }[],
  hoursBefore: number,
): { share: number; nextShare: number | null; hoursUntilNext: number | null } {
  // Earliest first, as the server walks them.
  const index = tiers.findIndex((tier) => hoursBefore >= tier.atLeastHoursBefore);
  if (index === -1) return { share: 1, nextShare: null, hoursUntilNext: null };
  return {
    share: tiers[index].owedShare,
    nextShare: tiers[index + 1]?.owedShare ?? 1,
    hoursUntilNext: hoursBefore - tiers[index].atLeastHoursBefore,
  };
}
