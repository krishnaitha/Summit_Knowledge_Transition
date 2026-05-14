import { describe, expect, it, vi } from 'vitest';

import { cn, formatDate, formatPercent, safeJsonParse, sleep, toCsv } from '@/lib/utils';

describe('cn', () => {
  it('merges multiple class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('ignores falsy values', () => {
    expect(cn('base', false && 'hidden', undefined, 'active')).toBe('base active');
  });

  it('deduplicates conflicting tailwind classes (last wins)', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });

  it('returns empty string when called with no arguments', () => {
    expect(cn()).toBe('');
  });

  it('merges conditional object notation', () => {
    expect(cn({ 'text-red-500': true, 'text-blue-500': false })).toBe('text-red-500');
  });
});

describe('formatDate', () => {
  it('returns N/A for null', () => {
    expect(formatDate(null)).toBe('N/A');
  });

  it('returns N/A for undefined', () => {
    expect(formatDate(undefined)).toBe('N/A');
  });

  it('formats a Date object without time', () => {
    // Use local-time constructor to avoid timezone ambiguity
    const date = new Date(2024, 0, 15); // Jan 15 2024 in local tz
    expect(formatDate(date)).toBe('15 Jan 2024');
  });

  it('formats a Date object with time when withTime=true', () => {
    const date = new Date(2024, 5, 1, 14, 30); // Jun 1 2024 14:30 local
    expect(formatDate(date, true)).toBe('01 Jun 2024, 14:30');
  });

  it('accepts a string date value', () => {
    const result = formatDate(new Date(2024, 11, 25).toISOString());
    expect(result).toContain('Dec 2024');
  });
});

describe('formatPercent', () => {
  it('returns 0% for null', () => {
    expect(formatPercent(null)).toBe('0%');
  });

  it('returns 0% for undefined', () => {
    expect(formatPercent(undefined)).toBe('0%');
  });

  it('returns 0% for NaN', () => {
    expect(formatPercent(NaN)).toBe('0%');
  });

  it('rounds up correctly', () => {
    expect(formatPercent(75.6)).toBe('76%');
  });

  it('rounds down correctly', () => {
    expect(formatPercent(75.4)).toBe('75%');
  });

  it('handles 0', () => {
    expect(formatPercent(0)).toBe('0%');
  });

  it('handles 100', () => {
    expect(formatPercent(100)).toBe('100%');
  });
});

describe('safeJsonParse', () => {
  it('parses a valid JSON object', () => {
    expect(safeJsonParse('{"a":1,"b":"two"}', {})).toEqual({ a: 1, b: 'two' });
  });

  it('parses a valid JSON array', () => {
    expect(safeJsonParse('[1,2,3]', [])).toEqual([1, 2, 3]);
  });

  it('returns the fallback for invalid JSON', () => {
    expect(safeJsonParse('not-json', 42)).toBe(42);
  });

  it('returns the fallback for an empty string', () => {
    expect(safeJsonParse('', null)).toBe(null);
  });

  it('returns the fallback for a partial JSON string', () => {
    expect(safeJsonParse('{broken', [])).toEqual([]);
  });
});

describe('toCsv', () => {
  it('returns an empty string for an empty array', () => {
    expect(toCsv([])).toBe('');
  });

  it('produces a header row followed by a data row', () => {
    const result = toCsv([{ name: 'Alice', age: 30 }]);
    expect(result).toBe('name,age\n"Alice","30"');
  });

  it('handles multiple rows', () => {
    const result = toCsv([{ n: 'A' }, { n: 'B' }]);
    const lines = result.split('\n');
    expect(lines).toHaveLength(3); // header + 2 data rows
    expect(lines[0]).toBe('n');
    expect(lines[1]).toBe('"A"');
    expect(lines[2]).toBe('"B"');
  });

  it('escapes double quotes inside cell values', () => {
    const result = toCsv([{ val: 'say "hello"' }]);
    expect(result).toContain('"say ""hello"""');
  });

  it('handles null and undefined cell values as empty strings', () => {
    const result = toCsv([{ a: null, b: undefined } as Record<string, unknown>]);
    expect(result).toBe('a,b\n"",""');
  });
});

describe('sleep', () => {
  it('resolves after the specified delay', async () => {
    vi.useFakeTimers();
    const promise = sleep(1000);
    vi.advanceTimersByTime(1000);
    await expect(promise).resolves.toBeUndefined();
    vi.useRealTimers();
  });

  it('does not resolve before the delay', async () => {
    vi.useFakeTimers();
    let resolved = false;
    sleep(500).then(() => {
      resolved = true;
    });
    vi.advanceTimersByTime(499);
    // flush microtasks
    await Promise.resolve();
    expect(resolved).toBe(false);
    vi.useRealTimers();
  });
});
