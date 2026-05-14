import { describe, expect, it } from 'vitest';

import { assignQuizSetToUser } from '@/lib/quiz/assignment';
import type { QuizSetRecord } from '@/lib/types/database';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeSet(id: string, setNumber: number): QuizSetRecord {
  return {
    id,
    project_id: 'proj-1',
    set_name: `Set ${setNumber}`,
    set_number: setNumber,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    category: 'general',
  };
}

// ---------------------------------------------------------------------------
// assignQuizSetToUser
// ---------------------------------------------------------------------------
describe('assignQuizSetToUser', () => {
  it('throws when there are no active quiz sets', () => {
    expect(() => assignQuizSetToUser(0, [])).toThrow(
      'No active quiz sets configured for this project.',
    );
  });

  it('returns the only set when there is one set', () => {
    const sets = [makeSet('s1', 1)];
    expect(assignQuizSetToUser(0, sets).id).toBe('s1');
    expect(assignQuizSetToUser(5, sets).id).toBe('s1');
  });

  it('distributes users round-robin across sets (sorted by set_number)', () => {
    const sets = [makeSet('s1', 1), makeSet('s2', 2), makeSet('s3', 3)];
    expect(assignQuizSetToUser(0, sets).id).toBe('s1'); // 0 % 3 = 0
    expect(assignQuizSetToUser(1, sets).id).toBe('s2'); // 1 % 3 = 1
    expect(assignQuizSetToUser(2, sets).id).toBe('s3'); // 2 % 3 = 2
    expect(assignQuizSetToUser(3, sets).id).toBe('s1'); // 3 % 3 = 0 → wraps
    expect(assignQuizSetToUser(4, sets).id).toBe('s2'); // 4 % 3 = 1
  });

  it('sorts sets by set_number before distributing (order-independent input)', () => {
    // Deliberately pass sets out of order
    const sets = [makeSet('s3', 3), makeSet('s1', 1), makeSet('s2', 2)];
    expect(assignQuizSetToUser(0, sets).id).toBe('s1'); // sorted: s1, s2, s3
    expect(assignQuizSetToUser(1, sets).id).toBe('s2');
    expect(assignQuizSetToUser(2, sets).id).toBe('s3');
  });

  it('does not mutate the original sets array order', () => {
    const sets = [makeSet('s2', 2), makeSet('s1', 1)];
    const originalIds = sets.map((s) => s.id);
    assignQuizSetToUser(0, sets);
    expect(sets.map((s) => s.id)).toEqual(originalIds);
  });
});
