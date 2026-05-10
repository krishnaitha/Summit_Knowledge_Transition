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
        const res = await fetch(`/api/bookmarks?messageId=${encodeURIComponent(messageId)}`, { method: 'DELETE' });
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
        'rounded-full p-1 transition-colors',
        isBookmarked ? 'text-amber-500' : 'text-slate-400 hover:text-slate-600',
        isLoading && 'opacity-50',
      )}
      aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark this answer'}
    >
      <Bookmark className={cn('h-4 w-4', isBookmarked && 'fill-current')} />
    </button>
  );
}
