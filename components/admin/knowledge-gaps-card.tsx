import Link from 'next/link';
import { AlertTriangle, ArrowRight, FileText } from 'lucide-react';

import type { KnowledgeGap } from '@/lib/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function KnowledgeGapsCard({ gaps }: { gaps: KnowledgeGap[] }) {
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
          <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
            {gaps.length} unanswered
          </span>
        </CardTitle>
        <p className="text-xs text-slate-400">Last 30 days · across all projects</p>
      </CardHeader>
      <CardContent className="space-y-1 p-0">
        {gaps.map((gap, i) => (
          <div
            key={i}
            className="flex items-start gap-3 border-t border-slate-100 px-6 py-3 first:border-t-0"
          >
            {/* Occurrence badge */}
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

            {/* Query + metadata */}
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

            {/* Capture link */}
            <Link
              href={`/admin/generate-document?context=${encodeURIComponent(gap.query)}`}
              className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-900 hover:text-slate-900"
              title="Capture knowledge for this topic"
            >
              <FileText className="h-3 w-3" />
              Capture
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
