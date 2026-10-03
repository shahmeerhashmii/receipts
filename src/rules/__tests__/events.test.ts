import { describe, it, expect } from 'vitest';
import {
  eventEffect,
  fadedEffect,
  eventMultiplier,
  votesNeededToPass,
  eventPasses,
} from '../events';

describe('eventEffect', () => {
  it('big_w = +0.15', () => expect(eventEffect('big_w')).toBe(0.15));
  it('small_w = +0.05', () => expect(eventEffect('small_w')).toBe(0.05));
  it('small_l = -0.05', () => expect(eventEffect('small_l')).toBe(-0.05));
  it('big_l = -0.15', () => expect(eventEffect('big_l')).toBe(-0.15));
});

describe('fadedEffect', () => {
  it('full effect on day 0', () => {
    const e = fadedEffect({ size: 'big_w', resolvedAt: '2024-01-01T00:00:00Z' }, '2024-01-01T00:00:00Z');
    expect(e).toBeCloseTo(0.15);
  });

  it('half effect on day 14', () => {
    const e = fadedEffect({ size: 'big_w', resolvedAt: '2024-01-01T00:00:00Z' }, '2024-01-15T00:00:00Z');
    expect(e).toBeCloseTo(0.075, 2);
  });

  it('zero effect after 28 days', () => {
    const e = fadedEffect({ size: 'big_w', resolvedAt: '2024-01-01T00:00:00Z' }, '2024-01-29T00:00:00Z');
    expect(e).toBe(0);
  });
});

describe('eventMultiplier', () => {
  it('1.0 with no effects', () => {
    expect(eventMultiplier([], '2024-01-01T00:00:00Z')).toBe(1.0);
  });

  it('clamps at 2.0 on max positive', () => {
    const effects = Array(10).fill({ size: 'big_w', resolvedAt: '2024-01-01T00:00:00Z' });
    const result = eventMultiplier(effects, '2024-01-01T00:00:00Z');
    expect(result).toBe(2.0);
  });

  it('clamps at 0.5 on max negative', () => {
    const effects = Array(10).fill({ size: 'big_l', resolvedAt: '2024-01-01T00:00:00Z' });
    const result = eventMultiplier(effects, '2024-01-01T00:00:00Z');
    expect(result).toBe(0.5);
  });
});

describe('votesNeededToPass', () => {
  it('5 members: 2 votes needed (4 eligible, ceil(4/2) = 2)', () => {
    expect(votesNeededToPass(5)).toBe(2);
  });
  it('6 members: 3 votes needed', () => {
    expect(votesNeededToPass(6)).toBe(3);
  });
  it('3 members: 1 vote needed', () => {
    expect(votesNeededToPass(3)).toBe(1);
  });
});

describe('eventPasses', () => {
  it('passes when votes meet threshold', () => {
    expect(eventPasses(3, 6)).toBe(true);
    expect(eventPasses(2, 5)).toBe(true);
  });
  it('fails when votes below threshold', () => {
    expect(eventPasses(1, 5)).toBe(false);
    expect(eventPasses(2, 6)).toBe(false);
  });
});
