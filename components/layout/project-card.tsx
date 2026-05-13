import Link from 'next/link';
import { FileText, MessageSquare, BookOpen, ArrowRight, Clock, Sparkles } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ProjectDashboardCard } from '@/lib/types/database';

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export function ProjectCard({ project }: { project: ProjectDashboardCard }) {
  const statusVariant =
    project.quizStatus === 'Completed' ? 'success' : project.quizStatus === 'In Progress' ? 'warning' : 'neutral';

  // Deadline badge
  let deadlineBadge: React.ReactNode = null;
  if (project.quizCloseAt && project.quizStatus !== 'Completed') {
    const days = daysUntil(project.quizCloseAt);
    const deadlineClass =
      days < 0
        ? 'bg-red-100 text-red-700'
        : days <= 2
          ? 'bg-red-100 text-red-700'
          : days <= 7
            ? 'bg-amber-100 text-amber-700'
            : 'bg-slate-100 text-slate-600';
    const deadlineLabel = days < 0 ? 'Overdue' : days === 0 ? 'Due today' : `${days}d left`;
    deadlineBadge = (
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${deadlineClass}`}>
        <Clock className="h-3 w-3" />
        {deadlineLabel}
      </span>
    );
  }

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex items-center gap-2">
              <CardTitle className="leading-snug">{project.name}</CardTitle>
              {project.isNewDocs && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                  <Sparkles className="h-3 w-3" />
                  New docs
                </span>
              )}
            </div>
            {deadlineBadge}
          </div>
          <Badge variant={statusVariant} className="shrink-0">
            {project.quizStatus}
          </Badge>
        </div>
        {project.description && (
          <p className="mt-1 line-clamp-2 text-sm text-slate-500">{project.description}</p>
        )}
      </CardHeader>

      <CardContent className="flex flex-1 flex-col justify-between gap-5">
        <div className="space-y-3">
          {/* Docs viewed progress */}
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Docs reviewed</p>
              </div>
              <p className="text-xs font-semibold text-slate-700">
                {project.docsViewedCount}/{project.documentCount}
              </p>
            </div>
            {project.documentCount > 0 && (
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all"
                  style={{ width: `${Math.min(100, Math.round((project.docsViewedCount / project.documentCount) * 100))}%` }}
                />
              </div>
            )}
          </div>

          {/* Quiz score bar or status */}
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 shrink-0 text-slate-400" />
                <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Quiz</p>
              </div>
              {project.quizPercentage != null ? (
                <p className={`text-xs font-semibold ${project.quizPassed ? 'text-emerald-600' : 'text-red-600'}`}>
                  {Math.round(project.quizPercentage)}% · {project.quizPassed ? 'Passed' : 'Failed'}
                </p>
              ) : (
                <p className="text-xs font-semibold text-slate-500">{project.quizScoreLabel ?? '—'}</p>
              )}
            </div>
            {project.quizPercentage != null && (
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className={`h-full rounded-full transition-all ${project.quizPassed ? 'bg-emerald-500' : 'bg-red-400'}`}
                  style={{ width: `${Math.min(100, Math.round(project.quizPercentage))}%` }}
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/projects/${project.id}/chat`}>
            <Button size="sm">
              <MessageSquare className="h-3.5 w-3.5" />
              Ask AI
            </Button>
          </Link>
          <Link href={`/projects/${project.id}/quiz`}>
            <Button size="sm" variant="secondary">
              <BookOpen className="h-3.5 w-3.5" />
              {project.quizStatus === 'In Progress' ? 'Resume Quiz' : 'Take Quiz'}
            </Button>
          </Link>
          <Link href={`/projects/${project.id}`} className="ml-auto">
            <Button size="sm" variant="ghost">
              Open
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}