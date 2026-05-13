import Link from 'next/link';
import { BookOpen, FileText, FolderOpen, MessageSquare, Activity, CheckCircle2, Clock, ArrowRight, Bookmark, Megaphone, HelpCircle, Settings } from 'lucide-react';

import { ProjectCard } from '@/components/layout/project-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { requireMember, getProjectAdminIds } from '@/lib/auth';
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
  const [projects, stats, adminProjectIds] = await Promise.all([
    getAssignedProjects(profile!.id, profile?.last_login_at),
    getMemberDashboardStats(profile!.id),
    getProjectAdminIds(profile!.id),
  ]);

  const nextActionProject =
    projects.find((p) => p.quizStatus === 'In Progress') ??
    projects.find((p) => p.quizStatus === 'Not Started') ??
    projects[0] ?? null;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="relative overflow-hidden border-0 bg-hero-grid text-white shadow-lg shadow-slate-900/10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.25),transparent_45%)]" />
          <CardContent className="relative space-y-6 p-6 sm:p-7">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">Member workspace</p>
                <h1 className="mt-2 text-3xl font-bold leading-tight text-white">Welcome back, {profile?.full_name ?? 'team member'}</h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-300">
                  One place to finish docs, ask AI questions, and complete assessments without jumping between screens.
                </p>
              </div>
              {nextActionProject && nextActionProject.quizStatus !== 'Completed' && (
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
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: 'Projects', value: stats.totalProjects, icon: FolderOpen, color: 'text-sky-700 bg-sky-100' },
                { label: 'Completed', value: stats.completedQuizzes, icon: CheckCircle2, color: 'text-emerald-700 bg-emerald-100' },
                { label: 'In Progress', value: stats.inProgressQuizzes, icon: Clock, color: 'text-amber-700 bg-amber-100' },
                { label: 'Documents', value: stats.totalDocs, icon: FileText, color: 'text-indigo-700 bg-indigo-100' },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="rounded-2xl border border-white/20 bg-white/10 p-3 backdrop-blur-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-slate-200">{label}</p>
                    <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${color}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                  </div>
                  <p className="mt-2 text-2xl font-bold text-white">{value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel-solid">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Quick command panel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {nextActionProject ? (
              <>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Next up</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{nextActionProject.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{nextActionProject.quizStatus}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Link href={`/projects/${nextActionProject.id}/chat`}>
                    <Button size="sm" variant="secondary" className="w-full justify-center">
                      <MessageSquare className="h-3.5 w-3.5" />
                      Ask AI
                    </Button>
                  </Link>
                  <Link href={`/projects/${nextActionProject.id}/quiz`}>
                    <Button size="sm" className="w-full justify-center">
                      <BookOpen className="h-3.5 w-3.5" />
                      Quiz
                    </Button>
                  </Link>
                </div>
                <Link href={`/projects/${nextActionProject.id}`}>
                  <Button size="sm" variant="ghost" className="w-full justify-center">
                    Open project
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </>
            ) : (
              <p className="text-sm text-slate-500">No project assigned yet.</p>
            )}

            {adminProjectIds.length > 0 && (
              <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Settings className="h-3.5 w-3.5 text-blue-700" />
                  <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Project admin access</p>
                </div>
                <p className="text-sm text-slate-700">You manage {adminProjectIds.length} project{adminProjectIds.length > 1 ? 's' : ''}.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <div className="space-y-6">
          <section className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">Assigned projects</h2>
                <p className="text-sm text-slate-500">Your active work queue with docs, AI, and quiz status.</p>
              </div>
              <Badge variant="neutral">{projects.length} active</Badge>
            </div>
            <div className="grid gap-5 lg:grid-cols-2">
              {projects.length ? (
                projects.map((project) => <ProjectCard key={project.id} project={project} />)
              ) : (
                <Card>
                  <CardContent className="p-6 text-sm text-slate-500">No active projects assigned yet.</CardContent>
                </Card>
              )}
            </div>
          </section>

          {adminProjectIds.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-slate-600" />
                <h2 className="text-base font-semibold text-slate-900">Managed projects</h2>
                <Badge variant="info">Project Admin</Badge>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {projects
                  .filter((p) => adminProjectIds.includes(p.id))
                  .map((p) => (
                    <Card key={p.id} className="border-blue-100 bg-blue-50/40">
                      <CardContent className="flex items-center justify-between p-4">
                        <div>
                          <p className="font-semibold text-slate-900">{p.name}</p>
                          <p className="text-xs text-slate-500">{p.documentCount} doc{p.documentCount !== 1 ? 's' : ''}</p>
                        </div>
                        <Link href={`/admin/projects/${p.id}`}>
                          <Button size="sm" variant="secondary">
                            <Settings className="h-3.5 w-3.5" />
                            Manage
                          </Button>
                        </Link>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </section>
          )}

          {stats.recentAnnouncements.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-brand-600" />
                <h2 className="text-base font-semibold text-slate-900">Admin updates</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {stats.recentAnnouncements.map((item, i) => (
                  <Card key={i} className="border-brand-100 bg-brand-50/40">
                    <CardContent className="p-4">
                      <p className="text-[11px] font-medium uppercase tracking-wider text-brand-700">{item.projectName}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{item.title}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-slate-700">{item.message}</p>
                      <p className="mt-2 text-xs text-slate-400">{formatDate(item.createdAt, true)}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="space-y-6 xl:sticky xl:top-24">
          {stats.recentBookmarks.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Bookmark className="h-4 w-4 text-amber-500" />
                <h2 className="text-base font-semibold text-slate-900">Saved AI answers</h2>
              </div>
              <div className="space-y-3">
                {stats.recentBookmarks.map((bm, i) => (
                  <Card key={i} className="border-amber-100">
                    <CardContent className="p-4">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="truncate rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700">
                          {bm.projectName}
                        </span>
                        <span className="shrink-0 text-[10px] text-slate-400">{formatDate(bm.createdAt, true)}</span>
                      </div>
                      {bm.question && (
                        <div className="mb-2 flex items-start gap-1.5">
                          <HelpCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <p className="line-clamp-2 text-xs font-medium text-slate-600">{bm.question}</p>
                        </div>
                      )}
                      <p className="line-clamp-3 text-sm leading-relaxed text-slate-700">{bm.content}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-slate-500" />
              <h2 className="text-base font-semibold text-slate-900">Recent activity</h2>
            </div>
            <Card>
              <CardContent className="divide-y divide-slate-100 p-0">
                {stats.recentActivity.length ? (
                  stats.recentActivity.slice(0, 6).map((item, i) => (
                    <div key={i} className="flex items-start gap-3 px-4 py-3">
                      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100">
                        <Activity className="h-3 w-3 text-slate-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium capitalize text-slate-800">{activityLabel(item.action)}</p>
                        {item.projectName && <p className="truncate text-xs text-slate-500">{item.projectName}</p>}
                        <p className="text-xs text-slate-400">{formatDate(item.createdAt, true)}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="px-5 py-8 text-center">
                    <Activity className="mx-auto mb-2 h-7 w-7 text-slate-300" />
                    <p className="text-sm text-slate-400">No activity yet.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}
