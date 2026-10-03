import { describe, it, expect } from 'vitest';
import {
  parsePuzzle,
  validatePuzzleDate,
  expectedPuzzleNumber,
  comparePuzzleScores,
  puzzleK,
  settlePuzzleDay,
  lowerWins,
} from '../puzzles';

describe('parsePuzzle - Wordle', () => {
  it('parses standard wordle', () => {
    const result = parsePuzzle('Wordle 1,567 3/6');
    expect(result).not.toBeNull();
    expect(result!.type).toBe('wordle');
    expect(result!.puzzleNumber).toBe(1567);
    expect(result!.score).toBe(3);
    expect(result!.hardMode).toBeFalsy();
  });

  it('parses hard mode wordle with asterisk', () => {
    const result = parsePuzzle('Wordle 1,567 3/6*');
    expect(result!.hardMode).toBe(true);
  });

  it('parses X/6 as score 7', () => {
    const result = parsePuzzle('Wordle 1,567 X/6');
    expect(result!.score).toBe(7);
  });

  it('returns null for invalid text', () => {
    expect(parsePuzzle('not a puzzle')).toBeNull();
  });
});

describe('parsePuzzle - Connections', () => {
  const text = `Connections\nPuzzle #123\n\n🟨🟨🟨🟨\n🟩🟩🟩🟩\n🟦🟦🟦🟦\n🟪🟪🟪🟪`;
  it('parses connections puzzle', () => {
    const result = parsePuzzle(text);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('connections');
    expect(result!.puzzleNumber).toBe(123);
    expect(result!.score).toBe(0); // 4 rows, solved cleanly
  });
});

describe('parsePuzzle - Krillion', () => {
  it('parses krillion', () => {
    const text = `Krillion #80\n260`;
    const result = parsePuzzle(text);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('krillion');
    expect(result!.puzzleNumber).toBe(80);
    expect(result!.score).toBe(260);
  });
});

describe('parsePuzzle - Ballpark', () => {
  it('parses ballpark', () => {
    const text = `Ballpark #5\n412/500`;
    const result = parsePuzzle(text);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('ballpark');
    expect(result!.puzzleNumber).toBe(5);
    expect(result!.score).toBe(412);
  });
});

describe('validatePuzzleDate', () => {
  it('Wordle #0 on 2021-06-19 is valid', () => {
    expect(validatePuzzleDate('wordle', 0, '2021-06-19')).toBe(true);
  });

  it('Wordle #1 on 2021-06-20 is valid', () => {
    expect(validatePuzzleDate('wordle', 1, '2021-06-20')).toBe(true);
  });

  it('allows 1 day either way', () => {
    expect(validatePuzzleDate('wordle', 1, '2021-06-19')).toBe(true); // day before
    expect(validatePuzzleDate('wordle', 1, '2021-06-21')).toBe(true); // day after
  });

  it('rejects far off puzzle numbers', () => {
    expect(validatePuzzleDate('wordle', 1000, '2021-06-19')).toBe(false);
  });

  it('Krillion #80 on 2026-10-03 is valid', () => {
    expect(validatePuzzleDate('krillion', 80, '2026-10-03')).toBe(true);
  });

  it('Ballpark #1 on 2026-10-05 is valid', () => {
    expect(validatePuzzleDate('ballpark', 1, '2026-10-05')).toBe(true);
  });

  it('Connections #1 on 2023-06-12 is valid', () => {
    expect(validatePuzzleDate('connections', 1, '2023-06-12')).toBe(true);
  });
});

describe('lowerWins', () => {
  it('wordle and connections lower wins', () => {
    expect(lowerWins('wordle')).toBe(true);
    expect(lowerWins('connections')).toBe(true);
  });
  it('krillion and ballpark higher wins', () => {
    expect(lowerWins('krillion')).toBe(false);
    expect(lowerWins('ballpark')).toBe(false);
  });
});

describe('comparePuzzleScores', () => {
  it('lower score wins for wordle', () => {
    expect(comparePuzzleScores({ score: 2 }, { score: 4 }, 'wordle')).toBe(1);
    expect(comparePuzzleScores({ score: 5 }, { score: 3 }, 'wordle')).toBe(-1);
  });

  it('higher score wins for krillion', () => {
    expect(comparePuzzleScores({ score: 500 }, { score: 200 }, 'krillion')).toBe(1);
  });

  it('draw when scores equal and no hard mode', () => {
    expect(comparePuzzleScores({ score: 3 }, { score: 3 }, 'wordle')).toBe(0);
  });

  it('hard mode breaks tie for wordle', () => {
    expect(comparePuzzleScores({ score: 3, hardMode: true }, { score: 3, hardMode: false }, 'wordle')).toBe(1);
    expect(comparePuzzleScores({ score: 3, hardMode: false }, { score: 3, hardMode: true }, 'wordle')).toBe(-1);
  });

  it('equal hard mode is draw', () => {
    expect(comparePuzzleScores({ score: 3, hardMode: true }, { score: 3, hardMode: true }, 'wordle')).toBe(0);
  });
});

describe('puzzleK', () => {
  it('0 for single player', () => {
    expect(puzzleK(1)).toBe(0);
  });
  it('16 / (n-1) for n players', () => {
    expect(puzzleK(2)).toBe(16);
    expect(puzzleK(3)).toBeCloseTo(8);
    expect(puzzleK(5)).toBe(4);
  });
});

describe('settlePuzzleDay - pairwise', () => {
  it('single player gets no rating change', () => {
    const results = settlePuzzleDay(
      [{ memberId: 'a', score: 3, currentRating: 1000, matchCount: 0 }],
      'wordle'
    );
    expect(results[0].ratingChange).toBe(0);
  });

  it('winner gains, loser loses', () => {
    const results = settlePuzzleDay(
      [
        { memberId: 'a', score: 2, currentRating: 1000, matchCount: 0 },
        { memberId: 'b', score: 4, currentRating: 1000, matchCount: 0 },
      ],
      'wordle'
    );
    const a = results.find((r) => r.memberId === 'a')!;
    const b = results.find((r) => r.memberId === 'b')!;
    expect(a.ratingChange).toBeGreaterThan(0);
    expect(b.ratingChange).toBeLessThan(0);
  });
});
