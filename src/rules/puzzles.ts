// Daily puzzle parsing and scoring rules

export type PuzzleType = 'wordle' | 'connections' | 'krillion' | 'ballpark';

/** Reference dates for puzzle number calculation */
const PUZZLE_REFS: Record<PuzzleType, { date: string; number: number }> = {
  wordle: { date: '2021-06-19', number: 0 },
  connections: { date: '2023-06-12', number: 1 },
  krillion: { date: '2026-10-03', number: 80 },
  ballpark: { date: '2026-10-05', number: 1 },
};

function daysDiff(dateA: string, dateB: string): number {
  const a = new Date(dateA + 'T00:00:00Z');
  const b = new Date(dateB + 'T00:00:00Z');
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/** Expected puzzle number for a given date */
export function expectedPuzzleNumber(type: PuzzleType, dateStr: string): number {
  const ref = PUZZLE_REFS[type];
  const days = daysDiff(ref.date, dateStr);
  return ref.number + days;
}

/** Validate puzzle number is within 1 day of today */
export function validatePuzzleDate(
  type: PuzzleType,
  puzzleNumber: number,
  todayStr: string
): boolean {
  const expected = expectedPuzzleNumber(type, todayStr);
  return Math.abs(puzzleNumber - expected) <= 1;
}

export interface ParsedPuzzle {
  type: PuzzleType;
  puzzleNumber: number;
  score: number; // lower=better for wordle/connections, higher=better for krillion/ballpark
  hardMode?: boolean; // wordle
  emojiGrid?: string;
  rawText: string;
}

/** Parse Wordle share text */
function parseWordle(text: string): ParsedPuzzle | null {
  // "Wordle 1,567 3/6" or "Wordle 1567 3/6*"
  const match = text.match(/Wordle\s+([\d,]+)\s+(\d|X)\/6(\*)?/i);
  if (!match) return null;
  const puzzleNumber = parseInt(match[1].replace(/,/g, ''), 10);
  const guessStr = match[2];
  const hardMode = match[3] === '*';
  const score = guessStr === 'X' ? 7 : parseInt(guessStr, 10);

  // Extract emoji grid (remaining lines after the header)
  const lines = text.split('\n');
  const gridLines = lines.slice(1).filter((l) => l.trim().length > 0 && /[\u{1F7E5}\u{1F7E8}\u{2B1B}\u{2B1C}\u{1F7E9}\u{2B1C}]/u.test(l));
  const emojiGrid = gridLines.join('\n');

  return { type: 'wordle', puzzleNumber, score, hardMode, emojiGrid, rawText: text };
}

/** Parse Connections share text */
function parseConnections(text: string): ParsedPuzzle | null {
  const match = text.match(/Connections\s+Puzzle\s+#(\d+)/i);
  if (!match) return null;
  const puzzleNumber = parseInt(match[1], 10);

  // Count emoji rows to determine mistakes
  const lines = text.split('\n');
  const emojiLines = lines.filter((l) => /[\u{1F7E5}\u{1F7E8}\u{1F7E6}\u{1F7E9}\u{1F7EA}\u{1F7EB}]/u.test(l));
  const rowCount = emojiLines.length;

  // Check if solved: if exactly 4 rows of same color on each (or any 4 successful rows)
  // Simplified: solved if row count <= 7, unsolved = 4 mistakes
  const solved = rowCount <= 7;
  const mistakes = solved ? Math.max(0, rowCount - 4) : 4;

  return {
    type: 'connections',
    puzzleNumber,
    score: mistakes,
    emojiGrid: emojiLines.join('\n'),
    rawText: text,
  };
}

/** Parse Krillion share text */
function parseKrillion(text: string): ParsedPuzzle | null {
  const match = text.match(/Krillion\s+#(\d+)/i);
  if (!match) return null;
  const puzzleNumber = parseInt(match[1], 10);

  // Score is on next line
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const headerIdx = lines.findIndex((l) => /Krillion\s+#\d+/i.test(l));
  if (headerIdx === -1 || headerIdx + 1 >= lines.length) return null;
  const scoreLine = lines[headerIdx + 1];
  const score = parseInt(scoreLine.replace(/[^\d]/g, ''), 10);
  if (isNaN(score)) return null;

  return { type: 'krillion', puzzleNumber, score, rawText: text };
}

/** Parse Ballpark share text */
function parseBallpark(text: string): ParsedPuzzle | null {
  const matchPuzz = text.match(/Ballpark\s+#(\d+)/i);
  if (!matchPuzz) return null;
  const puzzleNumber = parseInt(matchPuzz[1], 10);

  const scoreLine = text.match(/(\d+)\/500/);
  if (!scoreLine) return null;
  const score = parseInt(scoreLine[1], 10);

  return { type: 'ballpark', puzzleNumber, score, rawText: text };
}

/** Auto-detect and parse a puzzle from share text */
export function parsePuzzle(text: string): ParsedPuzzle | null {
  const t = text.trim();
  if (/^Wordle\s+/i.test(t)) return parseWordle(t);
  if (/^Connections\s+Puzzle/i.test(t)) return parseConnections(t);
  if (/^Krillion\s+#/i.test(t)) return parseKrillion(t);
  if (/^Ballpark\s+#/i.test(t)) return parseBallpark(t);
  return null;
}

/** Does lower score win for this puzzle type? */
export function lowerWins(type: PuzzleType): boolean {
  return type === 'wordle' || type === 'connections';
}

/**
 * Puzzle pairwise comparison. Returns 1 if A wins, -1 if B wins, 0 if draw.
 * Wordle hard mode is a tiebreak: hard mode wins a tie.
 */
export function comparePuzzleScores(
  a: { score: number; hardMode?: boolean },
  b: { score: number; hardMode?: boolean },
  type: PuzzleType
): 1 | -1 | 0 {
  const lower = lowerWins(type);
  if (a.score !== b.score) {
    if (lower) return a.score < b.score ? 1 : -1;
    return a.score > b.score ? 1 : -1;
  }
  // Tie
  if (type === 'wordle' && a.hardMode !== b.hardMode) {
    return a.hardMode ? 1 : -1; // hard mode wins tie
  }
  return 0;
}

/**
 * K factor for puzzle day: 16 / (playerCount - 1).
 * Returns 0 if only one player.
 */
export function puzzleK(playerCount: number): number {
  if (playerCount <= 1) return 0;
  return 16 / (playerCount - 1);
}

/** Settle a puzzle day: given submissions, return elo changes per member */
export interface PuzzleSettlementInput {
  memberId: string;
  score: number;
  hardMode?: boolean;
  currentRating: number;
  matchCount: number; // matches before this day
}

export interface PuzzleSettlementResult {
  memberId: string;
  ratingChange: number;
  newRating: number;
}

export function settlePuzzleDay(
  submissions: PuzzleSettlementInput[],
  type: PuzzleType
): PuzzleSettlementResult[] {
  const n = submissions.length;
  if (n <= 1) {
    return submissions.map((s) => ({ memberId: s.memberId, ratingChange: 0, newRating: s.currentRating }));
  }

  const k = puzzleK(n);
  const changes = new Map<string, number>();
  submissions.forEach((s) => changes.set(s.memberId, 0));

  // Every pair
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = submissions[i];
      const b = submissions[j];
      const cmp = comparePuzzleScores(a, b, type);
      const eA = 1 / (1 + Math.pow(10, (b.currentRating - a.currentRating) / 400));
      const eB = 1 - eA;
      const sA = cmp === 1 ? 1 : cmp === -1 ? 0 : 0.5;
      const sB = 1 - sA;
      const changeA = Math.round(k * (sA - eA));
      const changeB = Math.round(k * (sB - eB));
      changes.set(a.memberId, (changes.get(a.memberId) || 0) + changeA);
      changes.set(b.memberId, (changes.get(b.memberId) || 0) + changeB);
    }
  }

  return submissions.map((s) => {
    const change = changes.get(s.memberId) || 0;
    return {
      memberId: s.memberId,
      ratingChange: change,
      newRating: s.currentRating + change,
    };
  });
}
