// Match picks / betting rules

/**
 * Pick payout multiplier.
 * p = expected score of picked player from ratings.
 * multiplier = clamp(0.95 / p, 1.1, 5.0), locked when pick is made.
 */
export function pickMultiplier(expectedScore: number): number {
  const raw = 0.95 / expectedScore;
  return Math.min(5.0, Math.max(1.1, raw));
}

/**
 * Max stake for a picker: min(50, 20% of their coins).
 * Min stake: 5.
 */
export function maxStake(coins: number): number {
  return Math.min(50, Math.floor(coins * 0.2));
}

export function minStake(): number {
  return 5;
}

/** Payout for a winning pick, rounded down */
export function pickPayout(stake: number, multiplier: number): number {
  return Math.floor(stake * multiplier);
}

/**
 * Should picks be refunded?
 * - Draw: refund everyone.
 * - Match not logged within 48h of scheduled time: refund everyone.
 */
export function shouldRefundPick(params: {
  matchResult: 'win' | 'loss' | 'draw' | 'unplayed';
  scheduledAt: string;
  nowIso: string;
}): boolean {
  if (params.matchResult === 'draw') return true;
  if (params.matchResult === 'unplayed') {
    const hoursElapsed =
      (new Date(params.nowIso).getTime() - new Date(params.scheduledAt).getTime()) / 3600000;
    return hoursElapsed >= 48;
  }
  return false;
}
