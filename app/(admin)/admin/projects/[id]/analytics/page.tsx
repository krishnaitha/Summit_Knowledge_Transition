import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

import { resetQuizAttemptAction, setQuizWindowAction } from '@/app/actions/admin';
import { ProjectAnalyticsTabs } from '@/components/admin/project-analytics-tabs';
import { QuizWindowForm } from '@/components/admin/quiz-window-form';
import { requireAdmin } from '@/lib/auth';
import { getObservabilityMetrics, getProjectAnalytics, getProjectById } from '@/lib/data';

export default async function ProjectAnalyticsPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const [{ profile }, project, analytics, observability] = await Promise.all([
    requireAdmin(),
    getProjectById(params.id),
    getProjectAnalytics(params.id),
    getObservabilityMetrics(params.id),
  ]);

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1.5 text-sm text-slate-500">
        <Link href="/admin/projects" className="transition hover:text-slate-900">Projects</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href={`/admin/projects/${params.id}`} className="transition hover:text-slate-900">{project?.name ?? 'Project'}</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-slate-900">Analytics</span>
      </nav>
      <QuizWindowForm
        projectId={params.id}
        currentOpenAt={project?.quiz_open_at}
        currentCloseAt={project?.quiz_close_at}
        setWindowAction={setQuizWindowAction}
      />
      <ProjectAnalyticsTabs
        projectId={params.id}
        adminId={profile?.id}
        resetAction={resetQuizAttemptAction}
        analytics={analytics}
        observability={observability}
      />
    </div>
  );
}
