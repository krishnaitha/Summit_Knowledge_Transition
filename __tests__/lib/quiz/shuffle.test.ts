import { describe, expect, it } from 'vitest';

import { fisherYatesShuffle, normalizeOptionKey } from '@/lib/quiz/shuffle';

// ---------------------------------------------------------------------------
// fisherYatesShuffle
// ---------------------------------------------------------------------------
describe('fisherYatesShuffle', () => {
  it('returns an array of the same length', () => {
    const input = [1, 2, 3, 4, 5];
    expect(fisherYatesShuffle(input)).toHaveLength(5);
  });

  it('contains all original elements', () => {
    const input = ['A', 'B', 'C', 'D'];
    const result = fisherYatesShuffle(input);
    expect(result.sort()).toEqual([...input].sort());
  });

  it('does not mutate the original array', () => {
    const input = [1, 2, 3];
    const original = [...input];
    fisherYatesShuffle(input);
    expect(input).toEqual(original);
  });

  it('returns an empty array for empty input', () => {
    expect(fisherYatesShuffle([])).toEqual([]);
  });

  it('returns a single-element array unchanged', () => {
    expect(fisherYatesShuffle(['only'])).toEqual(['only']);
  });

  it('produces a different order over many runs (statistical)', () => {
    // With 4 elements there are 24 permutations.
    // The probability that 50 shuffles all preserve the original order is (1/24)^49 ≈ 0.
    const input = [1, 2, 3, 4];
    const originalStr = JSON.stringify(input);
    const alwaysSameOrder = Array.from({ length: 50 }, () =>
      JSON.stringify(fisherYatesShuffle(input)),
    ).every((s) => s === originalStr);
    expect(alwaysSameOrder).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// normalizeOptionKey
// ---------------------------------------------------------------------------
describe('normalizeOptionKey', () => {
  it('returns the uppercase version of valid lowercase keys', () => {
    expect(normalizeOptionKey('a')).toBe('A');
    expect(normalizeOptionKey('b')).toBe('B');
    expect(normalizeOptionKey('c')).toBe('C');
    expect(normalizeOptionKey('d')).toBe('D');
  });

  it('returns the same value for already-uppercase valid keys', () => {
    expect(normalizeOptionKey('A')).toBe('A');
    expect(normalizeOptionKey('B')).toBe('B');
    expect(normalizeOptionKey('C')).toBe('C');
    expect(normalizeOptionKey('D')).toBe('D');
  });

  it('falls back to "A" for an unrecognised key', () => {
    expect(normalizeOptionKey('E')).toBe('A');
    expect(normalizeOptionKey('z')).toBe('A');
    expect(normalizeOptionKey('1')).toBe('A');
    expect(normalizeOptionKey('')).toBe('A');
  });
});
