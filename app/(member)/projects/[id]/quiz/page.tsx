import Link from 'next/link';
import { ChevronRight, Clock } from 'lucide-react';
import { redirect } from 'next/navigation';

import { QuizExperience } from '@/components/quiz/quiz-experience';
import { Card, CardContent } from '@/components/ui/card';
import { requireMember } from '@/lib/auth';
import { getProjectById, getQuizAttemptForProject, userHasProjectAccess } from '@/lib/data';
import sql from '@/lib/db';

function formatWindowDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default async function ProjectQuizPage({ params }: { params: { id: string } }) {
  const { profile } = await requireMember();
  const canAccess = await userHasProjectAccess(profile!.id, profile?.role, params.id);

  if (!canAccess) {
    redirect('/dashboard');
  }

  const [project, attempt, pendingRequests] = await Promise.all([
    getProjectById(params.id),
    getQuizAttemptForProject(profile!.id, params.id),
    sql`SELECT id FROM quiz_retake_requests WHERE user_id = ${profile!.id} AND project_id = ${params.id} AND status = 'pending' LIMIT 1`,
  ]);
  const hasPendingRetakeRequest = pendingRequests.length > 0;

  const now = new Date();
  const openAt = project?.quiz_open_at ? new Date(project.quiz_open_at) : null;
  const closeAt = project?.quiz_close_at ? new Date(project.quiz_close_at) : null;

  const notOpenYet = openAt && openAt > now;
  const windowClosed = closeAt && closeAt < now;
  const outsideWindow = (notOpenYet || windowClosed) && attempt?.status !== 'submitted';

  let lockedAttempt = null;

  if (attempt?.status === 'submitted') {
    lockedAttempt = {
      score: attempt.score ?? 0,
      totalMarks: attempt.total_marks ?? 0,
      percentage: Number(attempt.percentage ?? 0),
    };
  }

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1.5 text-sm text-slate-500">
        <Link href="/dashboard" className="transition hover:text-slate-900">
          Dashboard
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href={`/projects/${params.id}`} className="transition hover:text-slate-900">
          {project?.name ?? 'Project'}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-slate-900">Quiz</span>
      </nav>

      {outsideWindow ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
              <Clock className="h-6 w-6 text-amber-600" />
            </div>
            {notOpenYet ? (
              <>
                <p className="text-lg font-semibold text-slate-900">Quiz not open yet</p>
                <p className="text-sm text-slate-500">
                  This quiz opens on <strong>{formatWindowDate(project!.quiz_open_at!)}</strong>.
                  <br />
                  Please come back then.
                </p>
              </>
            ) : (
              <>
                <p className="text-lg font-semibold text-slate-900">Quiz window has closed</p>
                <p className="text-sm text-slate-500">
                  The quiz closed on <strong>{formatWindowDate(project!.quiz_close_at!)}</strong>.
                  <br />
                  Contact your admin if you believe this is an error.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <QuizExperience
          lockedAttempt={lockedAttempt}
          projectId={params.id}
          projectName={project?.name ?? 'Project'}
          hasPendingRetakeRequest={hasPendingRetakeRequest}
        />
      )}
    </div>
  );
}
