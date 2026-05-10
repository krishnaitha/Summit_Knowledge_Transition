import type { AssignedQuestion, QuizQuestionRecord, QuizSetRecord } from '@/lib/types/database';
import { fisherYatesShuffle } from '@/lib/quiz/shuffle';

const DISPLAY_KEYS = ['A', 'B', 'C', 'D'] as const;

export function assignQuizSetToUser(userIndex: number, activeSets: QuizSetRecord[]) {
  if (!activeSets.length) {
    throw new Error('No active quiz sets configured for this project.');
  }

  const sortedSets = [...activeSets].sort((left, right) => left.set_number - right.set_number);
  return sortedSets[userIndex % sortedSets.length];
}

export function createAssignedQuestions(questions: QuizQuestionRecord[]) {
  return createSectionedQuestions(questions, 'functional', questions.length);
}

export function createSectionedQuestions(
  questions: QuizQuestionRecord[],
  section: string,
  limit: number,
): AssignedQuestion[] {
  const shuffled = fisherYatesShuffle([...questions]).slice(0, limit);

  return shuffled.map<AssignedQuestion>((question) => {
    const isTrueFalse = question.question_type === 'true_false';

    // True/False: keep A=True, B=False in fixed order (no shuffle needed)
    // MCQ: shuffle all 4 options so the correct answer position varies each attempt
    const options = isTrueFalse
      ? [
          { key: 'A' as const, text: question.option_a, originalKey: 'A' as const },
          { key: 'B' as const, text: question.option_b, originalKey: 'B' as const },
        ]
      : fisherYatesShuffle([
          { originalKey: 'A' as const, text: question.option_a },
          { originalKey: 'B' as const, text: question.option_b },
          { originalKey: 'C' as const, text: question.option_c },
          { originalKey: 'D' as const, text: question.option_d },
        ]).map((option, index) => ({
          key: DISPLAY_KEYS[index],
          text: option.text,
          originalKey: option.originalKey,
        }));

    const correctOption = options.find((o) => o.originalKey === question.correct_option);

    return {
      questionId: question.id,
      section,
      questionText: question.question_text,
      options,
      correctKey: correctOption?.key ?? 'A',
      explanation: question.explanation,
      marks: question.marks,
      questionType: question.question_type ?? 'mcq',
    };
  });
}
