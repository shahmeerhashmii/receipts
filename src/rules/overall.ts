// Overall rating calculation

export interface GameRatingEntry {
  gameId: string;
  rating: number;
  recentMatchCount: number; // last 60 days
  allTimeMatchCount: number;
}

/**
 * Overall weighted rating.
 * Weight = min(recent60DayCount, 10). If all 0, use allTime with same cap.
 * Member with no games = 1000.
 */
export function overallRating(games: GameRatingEntry[]): number {
  if (games.length === 0) return 1000;

  let useRecent = games.some((g) => g.recentMatchCount > 0);
  const counts = games.map((g) =>
    Math.min(useRecent ? g.recentMatchCount : g.allTimeMatchCount, 10)
  );

  const totalWeight = counts.reduce((s, c) => s + c, 0);
  if (totalWeight === 0) return 1000;

  const weightedSum = games.reduce((s, g, i) => s + g.rating * counts[i], 0);
  return Math.round(weightedSum / totalWeight);
}
