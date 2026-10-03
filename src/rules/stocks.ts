// Stock price calculation and trading rules

/**
 * Stock price formula:
 * price = round(40 * 3^((overallRating - 1000) / 400) * eventMultiplier)
 * minimum 2.
 * Reference: 800=23, 900=30, 1000=40, 1100=53, 1200=69, 1300=91, 1400=120
 */
export function stockPrice(overallRating: number, eventMultiplier = 1.0): number {
  const raw = 40 * Math.pow(3, (overallRating - 1000) / 400) * eventMultiplier;
  return Math.max(2, Math.round(raw));
}

/** 5% sell fee, rounded up */
export function sellFee(totalValue: number): number {
  return Math.ceil(totalValue * 0.05);
}

/** Sell proceeds after fee */
export function sellProceeds(shares: number, pricePerShare: number): number {
  const gross = shares * pricePerShare;
  return gross - sellFee(gross);
}

/**
 * Position limit check: a buy is blocked if that member's shares would
 * become more than 40% of the buyer's net worth.
 * Returns true if the buy is allowed.
 */
export function positionLimitAllowed(params: {
  existingShares: number;
  buyShares: number;
  pricePerShare: number;
  buyerNetWorth: number;
}): boolean {
  const { existingShares, buyShares, pricePerShare, buyerNetWorth } = params;
  const newHoldingValue = (existingShares + buyShares) * pricePerShare;
  return newHoldingValue <= buyerNetWorth * 0.4;
}

/**
 * Weekly dividend per holding: 2% of shares * price, rounded down.
 * Only if the subject played at least one match/puzzle in the past week.
 */
export function weeklyDividend(shares: number, pricePerShare: number): number {
  return Math.floor(shares * pricePerShare * 0.02);
}

/**
 * Trading lock: cannot buy shares of someone you have a scheduled
 * match against, or played in the last 24 hours.
 */
export function tradingLocked(params: {
  buyerId: string;
  subjectId: string;
  scheduledMatchPlayerIds: string[][]; // pairs of player IDs
  recentMatchPlayerIds: string[][];    // pairs played in last 24h
}): boolean {
  const { buyerId, subjectId, scheduledMatchPlayerIds, recentMatchPlayerIds } = params;

  for (const pair of scheduledMatchPlayerIds) {
    if (pair.includes(buyerId) && pair.includes(subjectId)) return true;
  }
  for (const pair of recentMatchPlayerIds) {
    if (pair.includes(buyerId) && pair.includes(subjectId)) return true;
  }
  return false;
}
