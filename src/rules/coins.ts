// Coin earning rules

export interface CoinTransaction {
  type: string;
  amount: number;
  reason: string;
}

/** +20 for playing a confirmed match, +10 extra for winning. Max 3 matches/day earn coins. */
export function matchCoins(result: 'win' | 'loss' | 'draw', matchNumberToday: number): number {
  if (matchNumberToday > 3) return 0;
  const base = 20;
  const winBonus = result === 'win' ? 10 : 0;
  return base + winBonus;
}

/** +5 for posting a daily puzzle (once per puzzle per day) */
export const PUZZLE_POST_COINS = 5;

/** +10 for winning a puzzle's daily leaderboard. Ties split rounded down. */
export function puzzleLeaderboardCoins(winners: number): number {
  return Math.floor(10 / winners);
}

/** +50 weekly check-in (first open of the league per week) */
export const WEEKLY_CHECKIN_COINS = 50;

/** Monthly award: +60 */
export const MONTHLY_AWARD_COINS = 60;

/** Achievement coins map */
export const ACHIEVEMENT_COINS: Record<string, number> = {
  first_blood: 20,
  hot_streak: 40,
  giant_slayer: 50,
  comeback_kid: 40,
  bounty_hunter: 20,
  called_it: 40,
  oracle: 50,
  diamond_hands: 40,
  puzzle_machine: 40,
  wordle_wizard: 25,
  one_in_a_krillion: 50,
  ironman: 50,
};

/** Coins never go below 0 */
export function clampCoins(coins: number): number {
  return Math.max(0, coins);
}

/** Net worth = coins + sum(shares * price per share) */
export function netWorth(coins: number, holdings: Array<{ shares: number; price: number }>): number {
  const stockValue = holdings.reduce((s, h) => s + h.shares * h.price, 0);
  return coins + stockValue;
}

/** Bankruptcy relief: once per week, member with net worth < 40 can claim 100 coins */
export const BANKRUPTCY_THRESHOLD = 40;
export const BANKRUPTCY_RELIEF = 100;

export function eligibleForBankruptcy(nw: number): boolean {
  return nw < BANKRUPTCY_THRESHOLD;
}

/** Bounty growth: starts at 25, grows 5/week, max 75 */
export function bountyAmount(weeksAtTop: number): number {
  return Math.min(25 + weeksAtTop * 5, 75);
}

export const BOUNTY_START = 25;
export const BOUNTY_GROWTH = 5;
export const BOUNTY_MAX = 75;
