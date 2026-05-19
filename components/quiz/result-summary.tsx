'use client';

import Link from 'next/link';
import { CheckCircle2, ShieldAlert } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatPercent } from '@/lib/utils';

export function ResultSummary({
  projectId,
  score,
  totalMarks,
  percentage,
  disqualified,
  disqualifyReason,
  coachingPlan,
  attemptHistory,
}: {
  projectId: string;
  score: number;
  totalMarks: number;
  percentage: number;
  disqualified?: boolean;
  disqualifyReason?: string | null;
  coachingPlan?: {
    weakSections: Array<{ section: string; score: number; total: number; percentage: number }>;
    recommendations: Array<{
      section: string;
      focus: string;
      documents: Array<{ id: string; name: string }>;
    }>;
  };
  attemptHistory?: Array<{
    score: number;
    totalMarks: number;
    percentage: number;
    submittedAt: string | null;
    resetAt: string;
  }>;
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
          <CardTitle>Quest submitted</CardTitle>
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
        {attemptHistory && attemptHistory.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">Attempt History</p>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm">
                <span className="text-slate-600">Latest attempt</span>
                <span className="font-semibold text-slate-900">
                  {score}/{totalMarks} ({percentage.toFixed(1)}%)
                </span>
              </div>
              {attemptHistory.slice(0, 5).map((item, idx) => (
                <div
                  key={`${item.resetAt}-${idx}`}
                  className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm"
                >
                  <span className="text-slate-600">Previous attempt {idx + 1}</span>
                  <span className="font-semibold text-slate-900">
                    {item.score}/{item.totalMarks} ({item.percentage.toFixed(1)}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        {coachingPlan && coachingPlan.recommendations.length > 0 && (
          <div className="space-y-3 rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm font-semibold text-blue-900">Weak-Area Coaching Plan</p>
            <div className="flex flex-wrap gap-2">
              <Link href={`/projects/${projectId}/study`}>
                <span className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-800 ring-1 ring-blue-200">
                  Open Study Mode
                </span>
              </Link>
              <Link href={`/projects/${projectId}/flashcards`}>
                <span className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-800 ring-1 ring-blue-200">
                  Review Flashcards
                </span>
              </Link>
            </div>
            {coachingPlan.recommendations.map((item) => (
              <div key={item.section} className="rounded-xl bg-white/80 p-3">
                <p className="text-sm font-semibold text-slate-900">
                  {item.section.charAt(0).toUpperCase() + item.section.slice(1)}
                </p>
                <p className="mt-1 text-sm text-slate-600">{item.focus}</p>
                {item.documents.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {item.documents.map((doc) => (
                      <Link
                        key={doc.id}
                        href={`/api/documents/view?documentId=${doc.id}`}
                        target="_blank"
                        className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-800 hover:bg-blue-200"
                      >
                        {doc.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
