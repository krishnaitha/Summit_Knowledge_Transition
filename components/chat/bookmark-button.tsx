'use client';

import { useState } from 'react';
import { Bookmark } from 'lucide-react';

import { cn } from '@/lib/utils';

interface BookmarkButtonProps {
  messageId: string;
  projectId: string;
  initialIsBookmarked: boolean;
}

export function BookmarkButton({ messageId, projectId, initialIsBookmarked }: BookmarkButtonProps) {
  const [isBookmarked, setIsBookmarked] = useState(initialIsBookmarked);
  const [isLoading, setIsLoading] = useState(false);

  const toggle = async () => {
    if (isLoading) return;
    setIsLoading(true);
    const prev = isBookmarked;
    setIsBookmarked(!prev);

    try {
      if (prev) {
        const res = await fetch(`/api/bookmarks?messageId=${encodeURIComponent(messageId)}`, {
          method: 'DELETE',
        });
        if (!res.ok) setIsBookmarked(prev);
      } else {
        const res = await fetch('/api/bookmarks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageId, projectId }),
        });
        if (!res.ok) setIsBookmarked(prev);
      }
    } catch {
      setIsBookmarked(prev);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isLoading}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium transition-colors',
        isBookmarked
          ? 'bg-amber-100 text-amber-700'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
        isLoading && 'opacity-50',
      )}
      aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark this answer'}
    >
      <Bookmark className={cn('h-4 w-4', isBookmarked && 'fill-current')} />
      <span>{isBookmarked ? 'Pinned' : 'Pin this answer'}</span>
    </button>
  );
}
