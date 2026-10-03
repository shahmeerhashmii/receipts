import { describe, it, expect } from 'vitest';
import { generateJoinCode, isValidJoinCode } from '../joinCode';

const VALID_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const INVALID_CHARS = 'OIL01';

describe('generateJoinCode', () => {
  it('generates a 6 character code', () => {
    const code = generateJoinCode();
    expect(code).toHaveLength(6);
  });

  it('only uses valid characters', () => {
    for (let i = 0; i < 100; i++) {
      const code = generateJoinCode();
      for (const ch of code) {
        expect(VALID_CHARS).toContain(ch);
      }
    }
  });

  it('never uses ambiguous characters', () => {
    for (let i = 0; i < 100; i++) {
      const code = generateJoinCode();
      for (const ch of INVALID_CHARS) {
        expect(code).not.toContain(ch);
      }
    }
  });

  it('generates unique codes', () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateJoinCode()));
    expect(codes.size).toBeGreaterThan(45); // very high probability of unique
  });
});

describe('isValidJoinCode', () => {
  it('accepts valid codes', () => {
    expect(isValidJoinCode('K7QX2M')).toBe(true);
    expect(isValidJoinCode('ABCDE2')).toBe(true);
    expect(isValidJoinCode('RSTUVW')).toBe(true);
  });

  it('rejects wrong length', () => {
    expect(isValidJoinCode('K7QX2')).toBe(false);
    expect(isValidJoinCode('K7QX2MM')).toBe(false);
  });

  it('rejects ambiguous characters', () => {
    expect(isValidJoinCode('K7QX2O')).toBe(false);
    expect(isValidJoinCode('K7QX21')).toBe(false);
    expect(isValidJoinCode('K7QX2I')).toBe(false);
    expect(isValidJoinCode('K7QX2L')).toBe(false);
  });

  it('rejects lowercase', () => {
    expect(isValidJoinCode('k7qx2m')).toBe(false);
  });
});
