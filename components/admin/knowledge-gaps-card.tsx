'use client';

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  FileText,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { KnowledgeGapThreadButton } from '@/components/admin/knowledge-gap-thread-button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { KnowledgeGap } from '@/lib/data';

export function KnowledgeGapsCard({ gaps }: { gaps: KnowledgeGap[] }) {
  const openGaps = gaps.filter((g) => !g.resolvedThreadId);
  const resolvedGaps = gaps.filter((g) => g.resolvedThreadId);
  const [showResolved, setShowResolved] = useState(false);

  if (gaps.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-slate-400" />
            Knowledge Gaps
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">
            No unanswered questions in the last 30 days. Knowledge base coverage looks good.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Knowledge Gaps
          {openGaps.length > 0 && (
            <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
              {openGaps.length} open
            </span>
          )}
          {resolvedGaps.length > 0 && (
            <span className="ml-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
              {resolvedGaps.length} resolved
            </span>
          )}
        </CardTitle>
        <p className="text-xs text-slate-400">Last 30 days · across all projects</p>
      </CardHeader>
      <CardContent className="space-y-1 p-0">
        {openGaps.map((gap, i) => (
          <GapRow key={i} gap={gap} />
        ))}

        {resolvedGaps.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => setShowResolved((v) => !v)}
              className="flex w-full items-center justify-between border-t border-slate-100 px-6 py-2.5 text-xs font-medium text-slate-500 transition hover:text-slate-700"
            >
              <span>{showResolved ? 'Hide resolved' : `Show ${resolvedGaps.length} resolved`}</span>
              {showResolved ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>

            {showResolved && resolvedGaps.map((gap, i) => <ResolvedGapRow key={i} gap={gap} />)}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function GapRow({ gap }: { gap: KnowledgeGap }) {
  return (
    <div className="flex items-start gap-3 border-t border-slate-100 px-6 py-3 first:border-t-0">
      <span
        className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
          gap.occurrences >= 5
            ? 'bg-red-100 text-red-700'
            : gap.occurrences >= 3
              ? 'bg-amber-100 text-amber-700'
              : 'bg-slate-100 text-slate-600'
        }`}
      >
        {gap.occurrences}×
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-slate-800">{gap.query}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {gap.projects.map((name) => (
            <span
              key={name}
              className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs text-slate-500"
            >
              {name}
            </span>
          ))}
          <span className="text-xs text-slate-400">{gap.lastAskedAt}</span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <Link
          href={`/admin/generate-document?context=${encodeURIComponent(gap.query)}`}
          className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-900 hover:text-slate-900"
          title="Capture knowledge for this topic"
        >
          <FileText className="h-3 w-3" />
          Capture
          <ArrowRight className="h-3 w-3" />
        </Link>
        {gap.projectIds.length > 0 && (
          <KnowledgeGapThreadButton
            query={gap.query}
            projectIds={gap.projectIds}
            projectNames={gap.projects}
          />
        )}
      </div>
    </div>
  );
}

function ResolvedGapRow({ gap }: { gap: KnowledgeGap }) {
  return (
    <div className="flex items-start gap-3 border-t border-slate-100 bg-green-50/40 px-6 py-3">
      <span className="mt-0.5 shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700 tabular-nums">
        {gap.occurrences}×
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <CheckCircle className="h-3.5 w-3.5 shrink-0 text-green-600" />
          <p className="truncate text-sm text-slate-600">{gap.query}</p>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {gap.projects.map((name) => (
            <span
              key={name}
              className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs text-slate-500"
            >
              {name}
            </span>
          ))}
          <span className="text-xs text-slate-400">{gap.lastAskedAt}</span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <Link
          href={`/admin/knowledge-gap-threads/${gap.resolvedThreadId}`}
          className="flex items-center gap-1 rounded-lg border border-green-200 bg-white px-2.5 py-1.5 text-xs font-medium text-green-700 transition hover:border-green-700 hover:text-green-900"
        >
          View thread
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
