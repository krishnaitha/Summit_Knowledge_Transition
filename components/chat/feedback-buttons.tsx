'use client';

import { useState } from 'react';
import { ThumbsDown, ThumbsUp } from 'lucide-react';

import { cn } from '@/lib/utils';

const DOWN_REASONS = [
  { key: 'incorrect', label: 'Incorrect' },
  { key: 'unclear', label: 'Unclear' },
  { key: 'missing_source', label: 'Missing source' },
  { key: 'not_relevant', label: 'Not relevant' },
] as const;

export function FeedbackButtons({ messageId, projectId }: { messageId: string; projectId: string }) {
  const [rating, setRating] = useState<'up' | 'down' | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const save = async (nextRating: 'up' | 'down', reasonTag?: string) => {
    if (isSaving) return;
    setIsSaving(true);
    const previous = rating;
    setRating(nextRating);

    try {
      const res = await fetch('/api/chat/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, projectId, rating: nextRating, reasonTag }),
      });
      if (!res.ok) {
        setRating(previous);
      }
    } catch {
      setRating(previous);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mt-2 flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => save('up', 'helpful')}
          disabled={isSaving}
          className={cn(
            'rounded-full p-1 transition-colors',
            rating === 'up' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-400 hover:text-slate-600',
          )}
          aria-label="Helpful answer"
        >
          <ThumbsUp className={cn('h-4 w-4', rating === 'up' && 'fill-current')} />
        </button>
        <button
          type="button"
          onClick={() => save('down')}
          disabled={isSaving}
          className={cn(
            'rounded-full p-1 transition-colors',
            rating === 'down' ? 'bg-rose-100 text-rose-700' : 'text-slate-400 hover:text-slate-600',
          )}
          aria-label="Needs improvement"
        >
          <ThumbsDown className={cn('h-4 w-4', rating === 'down' && 'fill-current')} />
        </button>
      </div>

      {rating === 'down' && (
        <div className="flex flex-wrap justify-end gap-1.5">
          {DOWN_REASONS.map((reason) => (
            <button
              key={reason.key}
              type="button"
              onClick={() => save('down', reason.key)}
              disabled={isSaving}
              className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700 hover:bg-rose-100"
            >
              {reason.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
