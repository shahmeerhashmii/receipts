import { describe, it, expect } from 'vitest';
import {
  stockPrice,
  sellFee,
  sellProceeds,
  positionLimitAllowed,
  weeklyDividend,
  tradingLocked,
} from '../stocks';

describe('stockPrice', () => {
  const refs: [number, number][] = [
    [800, 23],
    [900, 30],
    [1000, 40],
    [1100, 53],
    [1200, 69],
    [1300, 91],
    [1400, 120],
  ];
  for (const [rating, expected] of refs) {
    it(`rating ${rating} => price ${expected}`, () => {
      expect(stockPrice(rating)).toBe(expected);
    });
  }

  it('minimum price is 2 for very low ratings', () => {
    // At rating 100: 40 * 3^((100-1000)/400) = 40 * 3^(-2.25) ~= 3.2, rounds to 3
    // The minimum 2 is a floor, test with a negative scenario
    const price = stockPrice(100);
    expect(price).toBeGreaterThanOrEqual(2);
    // Test that the minimum is enforced
    expect(stockPrice(-9999)).toBe(2);
  });

  it('applies event multiplier', () => {
    expect(stockPrice(1000, 1.15)).toBeGreaterThan(40);
  });
});

describe('sellFee', () => {
  it('5% rounded up', () => {
    expect(sellFee(100)).toBe(5);
    expect(sellFee(101)).toBe(6); // ceil(5.05) = 6
    expect(sellFee(10)).toBe(1);  // ceil(0.5) = 1
  });
});

describe('sellProceeds', () => {
  it('gross minus 5% fee', () => {
    const gross = 5 * 40; // 200
    const fee = Math.ceil(200 * 0.05); // 10
    expect(sellProceeds(5, 40)).toBe(200 - fee);
  });
});

describe('positionLimitAllowed', () => {
  it('blocks when holding exceeds 40% of net worth', () => {
    expect(positionLimitAllowed({
      existingShares: 8,
      buyShares: 2,
      pricePerShare: 40,
      buyerNetWorth: 1000,
    })).toBe(true); // 10 * 40 = 400 = 40% of 1000, exactly at limit

    expect(positionLimitAllowed({
      existingShares: 8,
      buyShares: 3,
      pricePerShare: 40,
      buyerNetWorth: 1000,
    })).toBe(false); // 11 * 40 = 440 > 400
  });
});

describe('weeklyDividend', () => {
  it('2% of share value, rounded down', () => {
    expect(weeklyDividend(10, 40)).toBe(8); // 0.02 * 400 = 8
    expect(weeklyDividend(1, 40)).toBe(0);  // 0.02 * 40 = 0.8 -> 0
    expect(weeklyDividend(5, 50)).toBe(5);  // 0.02 * 250 = 5
  });
});

describe('tradingLocked', () => {
  it('locked if scheduled match exists between buyer and subject', () => {
    expect(tradingLocked({
      buyerId: 'alice',
      subjectId: 'bob',
      scheduledMatchPlayerIds: [['alice', 'bob']],
      recentMatchPlayerIds: [],
    })).toBe(true);
  });

  it('locked if played within 24h', () => {
    expect(tradingLocked({
      buyerId: 'alice',
      subjectId: 'bob',
      scheduledMatchPlayerIds: [],
      recentMatchPlayerIds: [['alice', 'bob']],
    })).toBe(true);
  });

  it('not locked for unrelated pairs', () => {
    expect(tradingLocked({
      buyerId: 'alice',
      subjectId: 'charlie',
      scheduledMatchPlayerIds: [['alice', 'bob']],
      recentMatchPlayerIds: [],
    })).toBe(false);
  });
});
