import { describe, it, expect } from 'vitest';
import { overallRating } from '../overall';

describe('overallRating', () => {
  it('returns 1000 for no games', () => {
    expect(overallRating([])).toBe(1000);
  });

  it('returns single game rating when only one game', () => {
    expect(overallRating([
      { gameId: 'fifa', rating: 1200, recentMatchCount: 5, allTimeMatchCount: 5 }
    ])).toBe(1200);
  });

  it('weights by recent match count, capped at 10', () => {
    const result = overallRating([
      { gameId: 'fifa', rating: 1200, recentMatchCount: 10, allTimeMatchCount: 20 },
      { gameId: 'gp_8ball', rating: 800, recentMatchCount: 10, allTimeMatchCount: 20 },
    ]);
    expect(result).toBe(1000); // equal weights, average of 1200 and 800
  });

  it('caps weight at 10', () => {
    const result = overallRating([
      { gameId: 'fifa', rating: 1200, recentMatchCount: 50, allTimeMatchCount: 50 },
      { gameId: 'gp_8ball', rating: 800, recentMatchCount: 10, allTimeMatchCount: 10 },
    ]);
    // Both capped at 10: equal weight
    expect(result).toBe(1000);
  });

  it('falls back to allTime if no recent matches', () => {
    const result = overallRating([
      { gameId: 'fifa', rating: 1100, recentMatchCount: 0, allTimeMatchCount: 5 },
    ]);
    expect(result).toBe(1100);
  });

  it('returns 1000 if no recent and no allTime matches', () => {
    const result = overallRating([
      { gameId: 'fifa', rating: 1100, recentMatchCount: 0, allTimeMatchCount: 0 },
    ]);
    expect(result).toBe(1000);
  });
});
