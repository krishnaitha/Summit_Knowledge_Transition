import type { AssignedQuestion, QuizOptionKey, QuizReviewQuestion } from '@/lib/types/database';

/** Compute per-section raw scores from the assigned questions and the submitted answers. */
export function computeSectionScores(
  assignedQuestions: AssignedQuestion[],
  answersGiven: Record<string, QuizOptionKey>,
): Record<string, { score: number; total: number }> {
  const result: Record<string, { score: number; total: number }> = {};
  for (const q of assignedQuestions) {
    const sec = q.section ?? 'general';
    if (!result[sec]) result[sec] = { score: 0, total: 0 };
    result[sec].total += q.marks ?? 1;
    if (answersGiven[q.questionId] === q.correctKey) result[sec].score += q.marks ?? 1;
  }
  return result;
}

export function scoreQuizSubmission(
  assignedQuestions: AssignedQuestion[],
  answers: Record<string, QuizOptionKey>,
  passThreshold = 60,
) {
  const review: QuizReviewQuestion[] = assignedQuestions.map((question) => {
    const selectedKey = answers[question.questionId] ?? null;
    const isCorrect = selectedKey === question.correctKey;

    return {
      ...question,
      selectedKey,
      isCorrect,
    };
  });

  const score = review.reduce((sum, question) => {
    return sum + (question.isCorrect ? question.marks : 0);
  }, 0);

  const totalMarks = review.reduce((sum, question) => sum + question.marks, 0);
  const percentage = totalMarks > 0 ? (score / totalMarks) * 100 : 0;

  return {
    review,
    score,
    totalMarks,
    percentage,
    passed: percentage >= passThreshold,
  };
}
