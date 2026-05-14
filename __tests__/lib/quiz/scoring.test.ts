import { describe, expect, it } from 'vitest';

import { computeSectionScores, scoreQuizSubmission } from '@/lib/quiz/scoring';
import type { AssignedQuestion } from '@/lib/types/database';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeQuestion(
  id: string,
  correctKey: 'A' | 'B' | 'C' | 'D',
  marks: number,
  section = 'general',
): AssignedQuestion {
  return {
    questionId: id,
    section,
    questionText: `Question ${id}`,
    options: [
      { key: 'A', text: 'Option A', originalKey: 'A' },
      { key: 'B', text: 'Option B', originalKey: 'B' },
      { key: 'C', text: 'Option C', originalKey: 'C' },
      { key: 'D', text: 'Option D', originalKey: 'D' },
    ],
    correctKey,
    explanation: null,
    marks,
    questionType: 'mcq',
  };
}

// ---------------------------------------------------------------------------
// computeSectionScores
// ---------------------------------------------------------------------------
describe('computeSectionScores', () => {
  it('returns an empty object for an empty question list', () => {
    expect(computeSectionScores([], {})).toEqual({});
  });

  it('counts a correct answer as a score', () => {
    const questions = [makeQuestion('q1', 'A', 1)];
    const result = computeSectionScores(questions, { q1: 'A' });
    expect(result.general).toEqual({ score: 1, total: 1 });
  });

  it('counts an incorrect answer as zero score', () => {
    const questions = [makeQuestion('q1', 'A', 1)];
    const result = computeSectionScores(questions, { q1: 'B' });
    expect(result.general).toEqual({ score: 0, total: 1 });
  });

  it('accumulates marks across multiple questions in the same section', () => {
    const questions = [
      makeQuestion('q1', 'A', 2),
      makeQuestion('q2', 'B', 3),
      makeQuestion('q3', 'C', 1),
    ];
    const answers = { q1: 'A' as const, q2: 'B' as const, q3: 'D' as const }; // q3 wrong
    const result = computeSectionScores(questions, answers);
    expect(result.general).toEqual({ score: 5, total: 6 });
  });

  it('tracks scores per section independently', () => {
    const questions = [
      makeQuestion('q1', 'A', 1, 'react'),
      makeQuestion('q2', 'B', 2, 'testing'),
      makeQuestion('q3', 'C', 1, 'react'),
    ];
    const answers = { q1: 'A' as const, q2: 'D' as const, q3: 'D' as const }; // q2 wrong (correct is B), q3 wrong (correct is C)
    const result = computeSectionScores(questions, answers);
    expect(result.react).toEqual({ score: 1, total: 2 }); // q1 correct, q3 wrong
    expect(result.testing).toEqual({ score: 0, total: 2 });
  });

  it('falls back to "general" section when question has no section', () => {
    const q = makeQuestion('q1', 'A', 1);
    (q as { section?: string }).section = undefined as unknown as string;
    const result = computeSectionScores([q], { q1: 'A' });
    expect(result.general).toBeDefined();
  });

  it('treats marks=0 as 0 via nullish coalescing (not a logical-OR fallback)', () => {
    // The function uses `q.marks ?? 1`, so 0 is kept as-is — only null/undefined falls back to 1.
    const q = makeQuestion('q1', 'A', 0);
    const result = computeSectionScores([q], { q1: 'A' });
    expect(result.general).toEqual({ score: 0, total: 0 });
  });
});

// ---------------------------------------------------------------------------
// scoreQuizSubmission
// ---------------------------------------------------------------------------
describe('scoreQuizSubmission', () => {
  const questions = [
    makeQuestion('q1', 'A', 2),
    makeQuestion('q2', 'B', 3),
    makeQuestion('q3', 'C', 5),
  ];

  it('calculates total score for all correct answers', () => {
    const { score, totalMarks } = scoreQuizSubmission(questions, {
      q1: 'A',
      q2: 'B',
      q3: 'C',
    });
    expect(score).toBe(10);
    expect(totalMarks).toBe(10);
  });

  it('calculates score for partially correct answers', () => {
    const { score } = scoreQuizSubmission(questions, {
      q1: 'A', // correct  +2
      q2: 'D', // wrong     +0
      q3: 'C', // correct  +5
    });
    expect(score).toBe(7);
  });

  it('calculates percentage correctly', () => {
    const { percentage } = scoreQuizSubmission(questions, {
      q1: 'A', // 2/10 = 20%
    });
    expect(percentage).toBe(20);
  });

  it('marks as passed when percentage meets the threshold', () => {
    const { passed } = scoreQuizSubmission(
      questions,
      { q1: 'A', q2: 'B', q3: 'C' }, // 100%
      60,
    );
    expect(passed).toBe(true);
  });

  it('marks as failed when percentage is below the threshold', () => {
    const { passed } = scoreQuizSubmission(
      questions,
      { q1: 'A' }, // 20%
      60,
    );
    expect(passed).toBe(false);
  });

  it('marks as passed when percentage equals the threshold exactly', () => {
    // q1(2) + q2(3) = 5/10 = 50% — pass threshold 50
    const { passed } = scoreQuizSubmission(questions, { q1: 'A', q2: 'B' }, 50);
    expect(passed).toBe(true);
  });

  it('uses 60 as the default pass threshold', () => {
    // q1(2) + q3(5) = 7/10 = 70% → should pass at default threshold of 60
    const { passed } = scoreQuizSubmission(questions, { q1: 'A', q3: 'C' });
    expect(passed).toBe(true);
  });

  it('returns percentage 0 when there are no questions', () => {
    const { percentage } = scoreQuizSubmission([], {});
    expect(percentage).toBe(0);
  });

  it('marks a question as isCorrect=true in review when answered correctly', () => {
    const { review } = scoreQuizSubmission(questions, { q1: 'A' });
    const q1Review = review.find((r) => r.questionId === 'q1')!;
    expect(q1Review.isCorrect).toBe(true);
    expect(q1Review.selectedKey).toBe('A');
  });

  it('marks a question as isCorrect=false when answered incorrectly', () => {
    const { review } = scoreQuizSubmission(questions, { q1: 'D' });
    const q1Review = review.find((r) => r.questionId === 'q1')!;
    expect(q1Review.isCorrect).toBe(false);
    expect(q1Review.selectedKey).toBe('D');
  });

  it('sets selectedKey to null when a question is not answered', () => {
    const { review } = scoreQuizSubmission(questions, {});
    expect(review.find((r) => r.questionId === 'q1')!.selectedKey).toBeNull();
  });
});
