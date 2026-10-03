// Elo / rating calculation rules

export interface EloParams {
  ratingA: number;
  ratingB: number;
  result: 'win' | 'loss' | 'draw'; // from A's perspective
  kA: number;
  kB: number;
  marginMultiplier?: number; // default 1.0
  handicapA?: number; // rating bonus for A when they have weaker team
  handicapB?: number; // rating bonus for B when they have weaker team
}

export interface EloResult {
  newRatingA: number;
  newRatingB: number;
  changeA: number;
  changeB: number;
}

/** Expected score for player A given ratings */
export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Compute K factor. First 10 matches = 40, then 24.
 * matchCount is the count BEFORE this match.
 */
export function kFactor(matchCount: number): number {
  return matchCount < 10 ? 40 : 24;
}

/**
 * FIFA star gap -> rating handicap (added to the weaker-team player's rating)
 */
export function fifaHandicap(starGap: number): number {
  const gap = Math.abs(starGap);
  if (gap < 0.75) return 0;       // 0 or 0.5
  if (gap < 1.25) return 30;      // 1
  if (gap < 1.75) return 55;      // 1.5
  if (gap < 2.25) return 85;      // 2
  if (gap < 2.75) return 115;     // 2.5
  return 150;                      // 3+
}

/**
 * FIFA margin multiplier from goal difference.
 * Only applied when a score is entered. Draws always 1.0.
 */
export function marginMultiplier(scoreA: number, scoreB: number): number {
  if (scoreA === scoreB) return 1.0;
  const diff = Math.abs(scoreA - scoreB);
  if (diff === 1) return 1.0;
  if (diff === 2) return 1.15;
  return 1.3; // 3+
}

/**
 * Main Elo computation.
 * Handicap is applied to the OPPONENT's effective rating:
 * - When A has the weaker team, handicapA is set. This raises B's effective rating,
 *   so A is a bigger underdog and earns more for winning.
 * - When B has the weaker team, handicapB is set. This raises A's effective rating.
 * The actual stored rating is what changes.
 */
export function computeElo(params: EloParams): EloResult {
  const {
    ratingA,
    ratingB,
    result,
    kA,
    kB,
    marginMultiplier: mm = 1.0,
    handicapA = 0, // A has weaker team: raise B's effective rating by this amount
    handicapB = 0, // B has weaker team: raise A's effective rating by this amount
  } = params;

  // When A has weaker team, add handicapA to B's effective rating
  // When B has weaker team, add handicapB to A's effective rating
  const effectiveA = ratingA + handicapB;
  const effectiveB = ratingB + handicapA;

  const eA = expectedScore(effectiveA, effectiveB);
  const eB = 1 - eA;

  const sA = result === 'win' ? 1 : result === 'draw' ? 0.5 : 0;
  const sB = 1 - sA;

  const changeA = Math.round(kA * (sA - eA) * mm);
  const changeB = Math.round(kB * (sB - eB) * mm);

  return {
    newRatingA: ratingA + changeA,
    newRatingB: ratingB + changeB,
    changeA,
    changeB,
  };
}

/**
 * Recalculate all ratings from scratch from a list of confirmed matches,
 * sorted by date ascending. Returns a map of memberId -> gameId -> {rating, matchCount}.
 */
export interface MatchForRecalc {
  id: string;
  player_a_id: string;
  player_b_id: string;
  game_id: string;
  result: 'win' | 'loss' | 'draw';
  score_a?: number;
  score_b?: number;
  stars_a?: number;
  stars_b?: number;
  confirmed_at?: string;
  logged_at?: string;
  status: string;
}

export function recalculateRatings(
  matches: MatchForRecalc[]
): Map<string, Map<string, { rating: number; matchCount: number; lastPlayedAt: string }>> {
  const ratings = new Map<string, Map<string, { rating: number; matchCount: number; lastPlayedAt: string }>>();

  const getOrInit = (memberId: string, gameId: string) => {
    if (!ratings.has(memberId)) ratings.set(memberId, new Map());
    const gameMap = ratings.get(memberId)!;
    if (!gameMap.has(gameId)) {
      gameMap.set(gameId, { rating: 1000, matchCount: 0, lastPlayedAt: '' });
    }
    return gameMap.get(gameId)!;
  };

  const sorted = [...matches]
    .filter((m) => m.status === 'confirmed')
    .sort((a, b) => (a.confirmed_at || '').localeCompare(b.confirmed_at || ''));

  for (const match of sorted) {
    const a = getOrInit(match.player_a_id, match.game_id);
    const b = getOrInit(match.player_b_id, match.game_id);

    const kA = kFactor(a.matchCount);
    const kB = kFactor(b.matchCount);

    // FIFA handicap
    let handicapA = 0;
    let handicapB = 0;
    if (match.stars_a !== undefined && match.stars_b !== undefined) {
      const starGap = match.stars_a - match.stars_b;
      if (starGap < 0) {
        // A has weaker team
        handicapA = fifaHandicap(starGap);
      } else if (starGap > 0) {
        // B has weaker team
        handicapB = fifaHandicap(starGap);
      }
    }

    // Margin multiplier
    let mm = 1.0;
    if (match.score_a !== undefined && match.score_b !== undefined) {
      mm = marginMultiplier(match.score_a, match.score_b);
    }

    const result = computeElo({
      ratingA: a.rating,
      ratingB: b.rating,
      result: match.result,
      kA,
      kB,
      marginMultiplier: mm,
      handicapA,
      handicapB,
    });

    a.rating = result.newRatingA;
    b.rating = result.newRatingB;
    a.matchCount++;
    b.matchCount++;
    a.lastPlayedAt = match.confirmed_at || match.logged_at || '';
    b.lastPlayedAt = match.confirmed_at || match.logged_at || '';
  }

  return ratings;
}

/**
 * Inactivity drift: after 30 days without a game, rating drifts 5 pts/week
 * toward 1000, max 50 total. Display only -- removed when they play again.
 */
export function inactivityAdjustment(rating: number, lastPlayedAt: string, nowIso: string): number {
  if (!lastPlayedAt) return 0;
  const daysSince = (new Date(nowIso).getTime() - new Date(lastPlayedAt).getTime()) / 86400000;
  if (daysSince <= 30) return 0;
  const weeksOver30 = Math.floor((daysSince - 30) / 7);
  if (weeksOver30 <= 0) return 0;
  const drift = Math.min(weeksOver30 * 5, 50);
  if (rating > 1000) return -Math.min(drift, rating - 1000);
  if (rating < 1000) return Math.min(drift, 1000 - rating);
  return 0;
}
