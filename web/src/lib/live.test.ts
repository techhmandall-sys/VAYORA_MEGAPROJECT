import { describe, expect, it } from 'vitest';

import { clockFace, refundNow } from './live';

const TIERS = [
  { atLeastHoursBefore: 48, fareShare: 1 },
  { atLeastHoursBefore: 24, fareShare: 0.75 },
  { atLeastHoursBefore: 6, fareShare: 0.5 },
];

describe('refundNow', () => {
  it('gives the tier a cancellation falls in now and what comes after it', () => {
    expect(refundNow(TIERS, 72)).toEqual({ share: 1, nextShare: 0.75, hoursUntilNext: 24 });
    expect(refundNow(TIERS, 30)).toEqual({ share: 0.75, nextShare: 0.5, hoursUntilNext: 6 });
  });

  it('counts exactly on a tier\'s edge as in it, as the server does', () => {
    expect(refundNow(TIERS, 48).share).toBe(1);
    expect(refundNow(TIERS, 24).share).toBe(0.75);
  });

  it('says nothing comes back after the last tier, and that the last tier falls to nothing', () => {
    expect(refundNow(TIERS, 7)).toEqual({ share: 0.5, nextShare: 0, hoursUntilNext: 1 });
    expect(refundNow(TIERS, 5)).toEqual({ share: 0, nextShare: null, hoursUntilNext: null });
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
