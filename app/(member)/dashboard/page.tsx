import Link from 'next/link';
import { BookOpen, FileText, FolderOpen, MessageSquare, Activity, CheckCircle2, Clock, ArrowRight, Bookmark } from 'lucide-react';

import { ProjectCard } from '@/components/layout/project-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { requireMember } from '@/lib/auth';
import { getAssignedProjects, getMemberDashboardStats } from '@/lib/data';
import { formatDate } from '@/lib/utils';

const ACTION_LABELS: Record<string, string> = {
  chatbot_message: 'Asked the AI',
  document_viewed: 'Viewed a document',
  quiz_started: 'Started a quiz',
  quiz_submitted: 'Submitted a quiz',
  quiz_retake_requested: 'Requested a retake',
};

function activityLabel(action: string) {
  return ACTION_LABELS[action] ?? action.replaceAll('_', ' ');
}

export default async function DashboardPage() {
  const { profile } = await requireMember();
  const [projects, stats] = await Promise.all([
    getAssignedProjects(profile!.id, profile?.last_login_at),
    getMemberDashboardStats(profile!.id),
  ]);

  // Find the highest-priority "next action" project:
  // prefer in-progress quiz, then not-started quiz, then any project
  const nextActionProject =
    projects.find((p) => p.quizStatus === 'In Progress') ??
    projects.find((p) => p.quizStatus === 'Not Started') ??
    projects[0] ?? null;

  return (
    <div className="space-y-8">
      {/* Hero banner */}
      <Card className="bg-hero-grid text-white">
        <CardHeader>
          <CardTitle className="text-3xl text-white">Welcome back, {profile?.full_name ?? 'team member'}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="max-w-3xl text-sm leading-7 text-slate-200">
            Review your assigned transition projects, ask grounded KT questions, and complete your one-time quiz when you are ready.
          </p>
        </CardContent>
      </Card>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50">
              <FolderOpen className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Projects</p>
              <p className="text-2xl font-bold text-slate-950">{stats.totalProjects}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Completed</p>
              <p className="text-2xl font-bold text-slate-950">{stats.completedQuizzes}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">In Progress</p>
              <p className="text-2xl font-bold text-slate-950">{stats.inProgressQuizzes}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50">
              <FileText className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Docs</p>
              <p className="text-2xl font-bold text-slate-950">{stats.totalDocs}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bookmarks strip */}
      {stats.recentBookmarks.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Saved AI answers</h2>
            <Bookmark className="h-4 w-4 text-slate-400" />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {stats.recentBookmarks.map((bm, i) => (
              <Card key={i} className="border-amber-100 bg-amber-50/40">
                <CardContent className="p-4">
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-amber-600">{bm.projectName}</p>
                  <p className="line-clamp-3 text-sm text-slate-700">{bm.content}</p>
                  <p className="mt-2 text-xs text-slate-400">{formatDate(bm.createdAt, true)}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Next action highlight */}
      {nextActionProject && nextActionProject.quizStatus !== 'Completed' && (
        <Card className="border-accent-200 bg-accent-50">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant={nextActionProject.quizStatus === 'In Progress' ? 'warning' : 'neutral'}>
                  {nextActionProject.quizStatus}
                </Badge>
                <p className="text-sm font-semibold text-slate-900">{nextActionProject.name}</p>
              </div>
              <p className="text-sm text-slate-600">
                {nextActionProject.quizStatus === 'In Progress'
                  ? 'You have an unfinished quiz — pick up where you left off.'
                  : `${nextActionProject.documentCount} doc${nextActionProject.documentCount !== 1 ? 's' : ''} ready — ask the AI or take the quiz.`}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Link href={`/projects/${nextActionProject.id}/chat`}>
                <Button size="sm" variant="secondary">
                  <MessageSquare className="h-3.5 w-3.5" />
                  Ask AI
                </Button>
              </Link>
              <Link href={`/projects/${nextActionProject.id}/quiz`}>
                <Button size="sm">
                  <BookOpen className="h-3.5 w-3.5" />
                  {nextActionProject.quizStatus === 'In Progress' ? 'Resume Quiz' : 'Take Quiz'}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-8 xl:grid-cols-[1fr_320px]">
        {/* Projects */}
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Assigned projects</h2>
            <p className="text-sm text-slate-500">Each card shows document coverage and your quiz status.</p>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            {projects.length ? (
              projects.map((project) => <ProjectCard key={project.id} project={project} />)
            ) : (
              <Card>
                <CardContent className="p-6 text-sm text-slate-500">No active projects are assigned yet.</CardContent>
              </Card>
            )}
          </div>
        </section>

        {/* Recent activity */}
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Recent activity</h2>
            <p className="text-sm text-slate-500">Your latest interactions.</p>
          </div>
          <Card>
            <CardContent className="divide-y divide-slate-100 p-0">
              {stats.recentActivity.length ? (
                stats.recentActivity.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 px-5 py-4">
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100">
                      <Activity className="h-3.5 w-3.5 text-slate-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 capitalize">{activityLabel(item.action)}</p>
                      {item.projectName && (
                        <p className="truncate text-xs text-slate-500">{item.projectName}</p>
                      )}
                      <p className="text-xs text-slate-400">{formatDate(item.createdAt, true)}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-5 py-8 text-center">
                  <Activity className="mx-auto mb-2 h-7 w-7 text-slate-300" />
                  <p className="text-sm text-slate-400">No activity yet. Start by exploring a project.</p>
                  {projects[0] && (
                    <Link href={`/projects/${projects[0].id}`} className="mt-3 inline-flex items-center gap-1 text-sm text-accent-700 hover:underline">
                      Open {projects[0].name} <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}