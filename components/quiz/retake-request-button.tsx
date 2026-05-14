'use client';

import { RefreshCw } from 'lucide-react';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';

export function RetakeRequestButton({
  projectId,
  hasPendingRequest,
  canRequestRetake,
}: {
  projectId: string;
  hasPendingRequest: boolean;
  canRequestRetake: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(hasPendingRequest);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  if (!canRequestRetake && !submitted) {
    return null;
  }

  if (submitted) {
    return (
      <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Re-enable request submitted. Your admin will review it.
      </p>
    );
  }

  const handleSubmit = () => {
    startTransition(async () => {
      const res = await fetch('/api/quiz/request-retake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, reason: reason.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Failed to submit request.');
        return;
      }
      setSubmitted(true);
      setShowForm(false);
    });
  };

  if (!showForm) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setShowForm(true)}>
        <RefreshCw className="h-3.5 w-3.5" />
        Request re-enable
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-medium text-slate-800">Request re-enable</p>
      <textarea
        className="focus:ring-brand-500 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:ring-2 focus:outline-none"
        rows={3}
        placeholder="Optional: describe what happened (e.g. tab switch, connection issue)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" disabled={pending} onClick={handleSubmit}>
          {pending ? 'Submitting…' : 'Submit request'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setShowForm(false);
            setError(null);
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
