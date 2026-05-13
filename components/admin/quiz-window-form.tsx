'use client';

import { useState, useTransition } from 'react';
import { CalendarClock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  // Convert to string if needed, then trim to "YYYY-MM-DDTHH:MM" for the datetime-local input
  const isoStr = typeof iso === 'string' ? iso : String(iso);
  return isoStr.slice(0, 16);
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  return date.toLocaleString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

export function QuizWindowForm({
  projectId,
  currentOpenAt,
  currentCloseAt,
  setWindowAction,
}: {
  projectId: string;
  currentOpenAt: string | null | undefined;
  currentCloseAt: string | null | undefined;
  setWindowAction: (formData: FormData) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      await setWindowAction(fd);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-slate-400" />
          <CardTitle>Quiz window</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-4">
          <input type="hidden" name="project_id" value={projectId} />
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">Opens at</label>
            <input
              name="quiz_open_at"
              type="datetime-local"
              defaultValue={toDatetimeLocal(currentOpenAt)}
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">Closes at</label>
            <input
              name="quiz_close_at"
              type="datetime-local"
              defaultValue={toDatetimeLocal(currentCloseAt)}
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
            />
          </div>
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? 'Saving…' : saved ? 'Saved ✓' : 'Save window'}
          </Button>
          {(currentOpenAt || currentCloseAt) && (
            <p className="w-full text-xs text-slate-400">
              {currentOpenAt ? `Opens ${formatDateTime(currentOpenAt)}` : 'No open restriction'}
              {' · '}
              {currentCloseAt ? `Closes ${formatDateTime(currentCloseAt)}` : 'No close restriction'}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
