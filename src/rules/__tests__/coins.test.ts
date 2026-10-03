import { describe, it, expect } from 'vitest';
import {
  matchCoins,
  puzzleLeaderboardCoins,
  netWorth,
  eligibleForBankruptcy,
  bountyAmount,
  PUZZLE_POST_COINS,
  WEEKLY_CHECKIN_COINS,
  MONTHLY_AWARD_COINS,
  BANKRUPTCY_THRESHOLD,
  BANKRUPTCY_RELIEF,
  BOUNTY_START,
  BOUNTY_MAX,
} from '../coins';

describe('matchCoins', () => {
  it('+20 for a loss on first 3 matches', () => {
    expect(matchCoins('loss', 1)).toBe(20);
    expect(matchCoins('loss', 3)).toBe(20);
  });

  it('+30 for a win on first 3 matches', () => {
    expect(matchCoins('win', 1)).toBe(30);
  });

  it('0 coins after 3rd match in a day', () => {
    expect(matchCoins('win', 4)).toBe(0);
    expect(matchCoins('loss', 5)).toBe(0);
  });

  it('+20 for draw', () => {
    expect(matchCoins('draw', 1)).toBe(20);
  });
});

describe('puzzleLeaderboardCoins', () => {
  it('10 for sole winner', () => {
    expect(puzzleLeaderboardCoins(1)).toBe(10);
  });

  it('5 for 2-way tie', () => {
    expect(puzzleLeaderboardCoins(2)).toBe(5);
  });

  it('3 for 3-way tie (floor)', () => {
    expect(puzzleLeaderboardCoins(3)).toBe(3);
  });
});

describe('netWorth', () => {
  it('coins + stock values', () => {
    expect(netWorth(100, [{ shares: 5, price: 40 }, { shares: 2, price: 50 }])).toBe(100 + 200 + 100);
  });

  it('just coins with no holdings', () => {
    expect(netWorth(400, [])).toBe(400);
  });
});

describe('eligibleForBankruptcy', () => {
  it(`eligible when net worth < ${BANKRUPTCY_THRESHOLD}`, () => {
    expect(eligibleForBankruptcy(39)).toBe(true);
    expect(eligibleForBankruptcy(40)).toBe(false);
    expect(eligibleForBankruptcy(0)).toBe(true);
  });
});

describe('bountyAmount', () => {
  it(`starts at ${BOUNTY_START}`, () => {
    expect(bountyAmount(0)).toBe(25);
  });

  it('grows 5 per week', () => {
    expect(bountyAmount(1)).toBe(30);
    expect(bountyAmount(2)).toBe(35);
  });

  it(`caps at ${BOUNTY_MAX}`, () => {
    expect(bountyAmount(100)).toBe(75);
    expect(bountyAmount(10)).toBe(75);
  });
});

describe('constants', () => {
  it('puzzle post coins = 5', () => expect(PUZZLE_POST_COINS).toBe(5));
  it('weekly checkin = 50', () => expect(WEEKLY_CHECKIN_COINS).toBe(50));
  it('monthly award = 60', () => expect(MONTHLY_AWARD_COINS).toBe(60));
  it('bankruptcy relief = 100', () => expect(BANKRUPTCY_RELIEF).toBe(100));
});
