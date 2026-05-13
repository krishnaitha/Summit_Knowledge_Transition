import { KeyRound, UserRound } from 'lucide-react';

import { createDemoUserAction } from '@/app/actions/admin';
import { UsersTable } from '@/components/admin/users-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SubmitButton } from '@/components/ui/submit-button';
import { requireAdmin } from '@/lib/auth';
import { getAdminDashboardStats, getAllProjects, getAllUsers } from '@/lib/data';

export default async function AdminUsersPage() {
  await requireAdmin();
  const [users, projects, dashboardStats] = await Promise.all([
    getAllUsers(),
    getAllProjects(),
    getAdminDashboardStats(),
  ]);
  const activeProjects = projects.filter((p) => p.is_active);

  return (
    <div className="space-y-8">
      {/* Demo user panel */}
      <Card className="border-brand-200 from-brand-50/60 bg-gradient-to-br to-white">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="bg-brand-700 flex h-8 w-8 items-center justify-center rounded-lg">
              <UserRound className="h-4 w-4 text-white" />
            </div>
            <div>
              <CardTitle>Create demo user</CardTitle>
              <p className="mt-0.5 text-xs text-slate-500">
                Creates a member account you can use to test the quiz and chat experience. No email
                confirmation needed.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Fixed credentials display */}
          <div className="border-brand-100 grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-2">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                <UserRound className="h-4 w-4 text-slate-500" />
              </div>
              <div>
                <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">Email</p>
                <p className="font-mono text-sm font-semibold text-slate-800">demo@summit.app</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                <KeyRound className="h-4 w-4 text-slate-500" />
              </div>
              <div>
                <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">
                  Password
                </p>
                <p className="font-mono text-sm font-semibold text-slate-800">Demo@Summit1</p>
              </div>
            </div>
          </div>

          {/* Project assignment + create */}
          <form action={createDemoUserAction} className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Assign to project</label>
              <select
                name="project_id"
                className="focus:border-accent-500 focus:ring-accent-200 h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:ring-2"
              >
                <option value="">— none —</option>
                {activeProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <SubmitButton loadingText="Creating…">Create / reset demo user</SubmitButton>
          </form>
          <p className="text-xs text-slate-400">
            If the demo user already exists, clicking the button again just re-assigns them to the
            selected project.
          </p>
        </CardContent>
      </Card>

      {/* Users list */}
      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <p className="text-sm text-slate-500">
            Locking a user immediately blocks new logins for that account.
          </p>
        </CardHeader>
        <CardContent>
          <UsersTable
            users={users}
            projects={activeProjects}
            activity={dashboardStats.recentActivity}
          />
        </CardContent>
      </Card>
    </div>
  );
}
