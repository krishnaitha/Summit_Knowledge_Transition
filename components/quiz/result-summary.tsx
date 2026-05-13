'use client';

import { CheckCircle2, ShieldAlert } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatPercent } from '@/lib/utils';

export function ResultSummary({
  score,
  totalMarks,
  percentage,
  disqualified,
  disqualifyReason,
}: {
  score: number;
  totalMarks: number;
  percentage: number;
  disqualified?: boolean;
  disqualifyReason?: string | null;
}) {
  if (disqualified) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-rose-500" />
            <CardTitle className="text-rose-700">Disqualified</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
            <p className="font-semibold text-rose-800">Your attempt has been marked as failed.</p>
            <p className="mt-1 text-sm text-rose-700">
              {disqualifyReason ?? 'Integrity violation detected during the assessment.'}
            </p>
          </div>
          <p className="text-sm text-slate-500">
            This result has been recorded. Please contact your admin if you believe this is an
            error.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          <CardTitle>Quiz submitted</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end gap-4">
          <p className="text-5xl font-bold tracking-tight text-slate-950">
            {score}
            <span className="text-2xl font-medium text-slate-400">/{totalMarks}</span>
          </p>
          <p className="mb-1 text-2xl font-semibold text-slate-600">{formatPercent(percentage)}</p>
        </div>
        <p className="text-sm text-slate-500">
          Your score has been recorded. Your admin will review the results.
        </p>
      </CardContent>
    </Card>
  );
}
