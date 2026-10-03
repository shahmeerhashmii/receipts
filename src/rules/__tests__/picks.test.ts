import { describe, it, expect } from 'vitest';
import {
  pickMultiplier,
  maxStake,
  minStake,
  pickPayout,
  shouldRefundPick,
} from '../picks';

describe('pickMultiplier', () => {
  it('clamps to 1.1 for heavy favorite (p=0.9)', () => {
    expect(pickMultiplier(0.9)).toBeCloseTo(1.1, 1);
  });

  it('exactly 1.9 for even match (p=0.5)', () => {
    expect(pickMultiplier(0.5)).toBeCloseTo(1.9, 1);
  });

  it('clamps to 5.0 for heavy underdog (p=0.1)', () => {
    expect(pickMultiplier(0.1)).toBeCloseTo(5.0, 1);
  });

  it('within bounds for typical values', () => {
    const m = pickMultiplier(0.6);
    expect(m).toBeGreaterThanOrEqual(1.1);
    expect(m).toBeLessThanOrEqual(5.0);
  });
});

describe('maxStake', () => {
  it('min(50, 20% of coins)', () => {
    expect(maxStake(100)).toBe(20);
    expect(maxStake(300)).toBe(50); // 20% of 300 = 60, capped at 50
    expect(maxStake(50)).toBe(10);
  });
});

describe('minStake', () => {
  it('is 5', () => {
    expect(minStake()).toBe(5);
  });
});

describe('pickPayout', () => {
  it('floor of stake * multiplier', () => {
    expect(pickPayout(20, 1.9)).toBe(38);
    expect(pickPayout(10, 2.5)).toBe(25);
    expect(pickPayout(7, 1.9)).toBe(13); // floor(7 * 1.9) = floor(13.3) = 13
  });
});

describe('shouldRefundPick', () => {
  it('refunds on draw', () => {
    expect(shouldRefundPick({
      matchResult: 'draw',
      scheduledAt: '2024-01-01T12:00:00Z',
      nowIso: '2024-01-01T14:00:00Z',
    })).toBe(true);
  });

  it('refunds unplayed match after 48 hours', () => {
    expect(shouldRefundPick({
      matchResult: 'unplayed',
      scheduledAt: '2024-01-01T12:00:00Z',
      nowIso: '2024-01-03T13:00:00Z', // 49h later
    })).toBe(true);
  });

  it('does not refund unplayed match before 48 hours', () => {
    expect(shouldRefundPick({
      matchResult: 'unplayed',
      scheduledAt: '2024-01-01T12:00:00Z',
      nowIso: '2024-01-02T11:00:00Z', // 23h later
    })).toBe(false);
  });

  it('does not refund a win', () => {
    expect(shouldRefundPick({
      matchResult: 'win',
      scheduledAt: '2024-01-01T12:00:00Z',
      nowIso: '2024-01-01T14:00:00Z',
    })).toBe(false);
  });
});
