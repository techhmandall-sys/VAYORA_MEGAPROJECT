import { describe, expect, it } from 'vitest';

import { clockFace, owedNow } from './live';

const TIERS = [
  { atLeastHoursBefore: 48, owedShare: 0 },
  { atLeastHoursBefore: 24, owedShare: 0.25 },
  { atLeastHoursBefore: 6, owedShare: 0.5 },
];

describe('owedNow', () => {
  it('gives the tier a cancellation falls in now and what comes after it', () => {
    expect(owedNow(TIERS, 72)).toEqual({ share: 0, nextShare: 0.25, hoursUntilNext: 24 });
    expect(owedNow(TIERS, 30)).toEqual({ share: 0.25, nextShare: 0.5, hoursUntilNext: 6 });
  });

  it('counts exactly on a tier\'s edge as in it, as the server does', () => {
    expect(owedNow(TIERS, 48).share).toBe(0);
    expect(owedNow(TIERS, 24).share).toBe(0.25);
  });

  it('says the whole fare is owed after the last tier, and that the last tier rises to it', () => {
    expect(owedNow(TIERS, 7)).toEqual({ share: 0.5, nextShare: 1, hoursUntilNext: 1 });
    expect(owedNow(TIERS, 5)).toEqual({ share: 1, nextShare: null, hoursUntilNext: null });
  });
});

describe('clockFace', () => {
  it('shows minutes and seconds, rounding up so it never shows 0:00 too soon', () => {
    expect(clockFace(272_000)).toBe('4:32');
    expect(clockFace(60_000)).toBe('1:00');
    expect(clockFace(400)).toBe('0:01');
  });

  it('stops at zero', () => {
    expect(clockFace(0)).toBe('0:00');
    expect(clockFace(-5000)).toBe('0:00');
  });
});
