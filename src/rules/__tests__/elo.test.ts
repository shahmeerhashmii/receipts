import { describe, it, expect } from 'vitest';
import {
  expectedScore,
  kFactor,
  fifaHandicap,
  marginMultiplier,
  computeElo,
  recalculateRatings,
  inactivityAdjustment,
} from '../elo';

describe('expectedScore', () => {
  it('returns 0.5 for equal ratings', () => {
    expect(expectedScore(1000, 1000)).toBeCloseTo(0.5);
  });
  it('favors higher rated player', () => {
    expect(expectedScore(1200, 1000)).toBeGreaterThan(0.5);
    expect(expectedScore(800, 1000)).toBeLessThan(0.5);
  });
});

describe('kFactor', () => {
  it('returns 40 for first 10 matches', () => {
    expect(kFactor(0)).toBe(40);
    expect(kFactor(9)).toBe(40);
  });
  it('returns 24 after 10 matches', () => {
    expect(kFactor(10)).toBe(24);
    expect(kFactor(100)).toBe(24);
  });
});

describe('fifaHandicap', () => {
  it('0 or 0.5 star gap = 0', () => {
    expect(fifaHandicap(0)).toBe(0);
    expect(fifaHandicap(0.5)).toBe(0);
  });
  it('1 star gap = 30', () => {
    expect(fifaHandicap(1)).toBe(30);
  });
  it('1.5 star gap = 55', () => {
    expect(fifaHandicap(1.5)).toBe(55);
  });
  it('2 star gap = 85', () => {
    expect(fifaHandicap(2)).toBe(85);
  });
  it('2.5 star gap = 115', () => {
    expect(fifaHandicap(2.5)).toBe(115);
  });
  it('3+ star gap = 150', () => {
    expect(fifaHandicap(3)).toBe(150);
    expect(fifaHandicap(5)).toBe(150);
  });
  it('works with negative gaps (absolute)', () => {
    expect(fifaHandicap(-2)).toBe(85);
  });
});

describe('marginMultiplier', () => {
  it('draw = 1.0', () => {
    expect(marginMultiplier(1, 1)).toBe(1.0);
    expect(marginMultiplier(2, 2)).toBe(1.0);
  });
  it('1 goal difference = 1.0', () => {
    expect(marginMultiplier(2, 1)).toBe(1.0);
    expect(marginMultiplier(1, 2)).toBe(1.0);
  });
  it('2 goal difference = 1.15', () => {
    expect(marginMultiplier(3, 1)).toBe(1.15);
    expect(marginMultiplier(1, 3)).toBe(1.15);
  });
  it('3+ goal difference = 1.3', () => {
    expect(marginMultiplier(4, 1)).toBe(1.3);
    expect(marginMultiplier(5, 1)).toBe(1.3);
    expect(marginMultiplier(6, 1)).toBe(1.3);
  });
});

describe('computeElo - FIFA spec checks', () => {
  // "both at 1000 and K 24, 2-1 even = +12"
  it('2-1 even teams = +12 for winner', () => {
    const result = computeElo({
      ratingA: 1000,
      ratingB: 1000,
      result: 'win',
      kA: 24,
      kB: 24,
      marginMultiplier: marginMultiplier(2, 1),
    });
    expect(result.changeA).toBe(12);
  });

  // "5-1 even = +16"
  it('5-1 even teams = +16 for winner', () => {
    const result = computeElo({
      ratingA: 1000,
      ratingB: 1000,
      result: 'win',
      kA: 24,
      kB: 24,
      marginMultiplier: marginMultiplier(5, 1),
    });
    expect(result.changeA).toBe(16);
  });

  // "2-1 one star weaker = +13"
  it('2-1 one star weaker = +13', () => {
    const handicap = fifaHandicap(1);
    const result = computeElo({
      ratingA: 1000,
      ratingB: 1000,
      result: 'win',
      kA: 24,
      kB: 24,
      marginMultiplier: marginMultiplier(2, 1),
      handicapA: handicap,
    });
    expect(result.changeA).toBe(13);
  });

  // "two stars weaker = +15"
  it('2-1 two stars weaker = +15', () => {
    const handicap = fifaHandicap(2);
    const result = computeElo({
      ratingA: 1000,
      ratingB: 1000,
      result: 'win',
      kA: 24,
      kB: 24,
      marginMultiplier: marginMultiplier(2, 1),
      handicapA: handicap,
    });
    expect(result.changeA).toBe(15);
  });

  // "three stars weaker = +17"
  it('2-1 three stars weaker = +17', () => {
    const handicap = fifaHandicap(3);
    const result = computeElo({
      ratingA: 1000,
      ratingB: 1000,
      result: 'win',
      kA: 24,
      kB: 24,
      marginMultiplier: marginMultiplier(2, 1),
      handicapA: handicap,
    });
    expect(result.changeA).toBe(17);
  });

  // "5-1 three stars weaker = +22"
  it('5-1 three stars weaker = +22', () => {
    const handicap = fifaHandicap(3);
    const result = computeElo({
      ratingA: 1000,
      ratingB: 1000,
      result: 'win',
      kA: 24,
      kB: 24,
      marginMultiplier: marginMultiplier(5, 1),
      handicapA: handicap,
    });
    expect(result.changeA).toBe(22);
  });
});

describe('recalculateRatings after void', () => {
  it('voiding a match recalculates correctly', () => {
    const matches = [
      {
        id: 'm1',
        player_a_id: 'a',
        player_b_id: 'b',
        game_id: 'fifa',
        result: 'win' as const,
        confirmed_at: '2024-01-01T12:00:00Z',
        status: 'confirmed',
      },
      {
        id: 'm2',
        player_a_id: 'a',
        player_b_id: 'b',
        game_id: 'fifa',
        result: 'win' as const,
        confirmed_at: '2024-01-02T12:00:00Z',
        status: 'voided', // voided -- should not count
      },
    ];
    const ratings = recalculateRatings(matches);
    const aRating = ratings.get('a')?.get('fifa')?.rating;
    const bRating = ratings.get('b')?.get('fifa')?.rating;
    // Only m1 counts: a won with K=40, even teams, no score
    // eA = 0.5, changeA = round(40 * (1 - 0.5)) = 20
    expect(aRating).toBe(1020);
    expect(bRating).toBe(980);
  });
});

describe('inactivityAdjustment', () => {
  it('no adjustment within 30 days', () => {
    expect(inactivityAdjustment(1100, '2024-01-01T00:00:00Z', '2024-01-20T00:00:00Z')).toBe(0);
  });
  it('drifts after 37 days (1 week over 30)', () => {
    const adj = inactivityAdjustment(1100, '2024-01-01T00:00:00Z', '2024-02-07T00:00:00Z');
    expect(adj).toBe(-5);
  });
  it('caps at -50', () => {
    const adj = inactivityAdjustment(1100, '2020-01-01T00:00:00Z', '2024-01-01T00:00:00Z');
    expect(adj).toBe(-50);
  });
  it('drifts upward for below-1000 rating', () => {
    const adj = inactivityAdjustment(900, '2024-01-01T00:00:00Z', '2024-02-07T00:00:00Z');
    expect(adj).toBe(5);
  });
});
