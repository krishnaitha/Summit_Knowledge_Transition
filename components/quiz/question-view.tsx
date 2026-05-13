import { cn } from '@/lib/utils';

export interface QuizQuestionViewModel {
  questionId: string;
  questionText: string;
  options: Array<{ key: 'A' | 'B' | 'C' | 'D'; text: string }>;
}

export function QuestionView({
  question,
  currentIndex,
  total,
  selected,
  onSelect,
}: {
  question: QuizQuestionViewModel;
  currentIndex: number;
  total: number;
  selected?: string;
  onSelect: (value: 'A' | 'B' | 'C' | 'D') => void;
}) {
  const progress = Math.round(((currentIndex + 1) / total) * 100);

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 flex items-center justify-between text-sm text-slate-500">
          <span>{`Question ${currentIndex + 1} of ${total}`}</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 rounded-full bg-slate-100">
          <div className="h-2 rounded-full bg-accent-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="rounded-3xl bg-slate-50 p-6">
        <h3 className="text-lg font-semibold text-slate-950">{question.questionText}</h3>
      </div>

      <div className="grid gap-3">
        {question.options.map((option) => (
          <button
            key={option.key}
            className={cn(
              'rounded-2xl border px-5 py-4 text-left text-sm transition',
              selected === option.key
                ? 'border-accent-500 bg-accent-50 text-accent-900'
                : 'border-slate-200 bg-white hover:border-slate-300',
            )}
            onClick={() => onSelect(option.key)}
            type="button"
          >
            <span className="mr-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 font-semibold text-slate-700">
              {option.key}
            </span>
            {option.text}
          </button>
        ))}
      </div>
    </div>
  );
}
