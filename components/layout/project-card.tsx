import Link from 'next/link';
import { FileText, MessageSquare, BookOpen, ArrowRight } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ProjectDashboardCard } from '@/lib/types/database';

export function ProjectCard({ project }: { project: ProjectDashboardCard }) {
  const statusVariant =
    project.quizStatus === 'Completed'
      ? 'success'
      : project.quizStatus === 'In Progress'
        ? 'warning'
        : 'neutral';

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="leading-snug">{project.name}</CardTitle>
          <Badge variant={statusVariant} className="shrink-0">
            {project.quizStatus}
          </Badge>
        </div>
        {project.description && (
          <p className="mt-1 line-clamp-2 text-sm text-slate-500">{project.description}</p>
        )}
      </CardHeader>

      <CardContent className="flex flex-1 flex-col justify-between gap-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
            <FileText className="h-4 w-4 shrink-0 text-slate-400" />
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                Docs
              </p>
              <p className="text-xl font-semibold text-slate-950">{project.documentCount}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
            <BookOpen className="h-4 w-4 shrink-0 text-slate-400" />
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                Quiz
              </p>
              <p className="text-base font-semibold text-slate-950">
                {project.quizScoreLabel ?? '—'}
              </p>
            </div>
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
              Take Quiz
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
