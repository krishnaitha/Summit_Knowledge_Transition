import Link from 'next/link';
import { RefreshCw } from 'lucide-react';

import { createProjectAction, toggleProjectStatusAction } from '@/app/actions/admin';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SubmitButton } from '@/components/ui/submit-button';
import { Textarea } from '@/components/ui/textarea';
import { requireAdmin } from '@/lib/auth';
import { getAllProjects, getPendingRetakeCountsByProject } from '@/lib/data';

export default async function AdminProjectsPage() {
  const { profile } = await requireAdmin();
  const [projects, pendingRetakeCounts] = await Promise.all([
    getAllProjects(),
    getPendingRetakeCountsByProject(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-slate-950">Projects</h1>
        <p className="mt-2 text-sm text-slate-500">
          Create projects, control active status, and open each project workspace.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create project</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createProjectAction} className="grid gap-4 lg:grid-cols-2">
            <input name="created_by" type="hidden" value={profile!.id} />
            <Input name="name" placeholder="Project name" required />
            <Input
              defaultValue="60"
              min={0}
              max={100}
              name="pass_threshold"
              placeholder="Pass threshold"
              type="number"
            />
            <div className="lg:col-span-2">
              <Textarea name="description" placeholder="Project description" />
            </div>
            <SubmitButton className="lg:w-fit" loadingText="Creating…">
              Create project
            </SubmitButton>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-6">
        {projects.map((project) => {
          const pendingCount = pendingRetakeCounts.get(project.id) ?? 0;
          return (
            <Card
              key={project.id}
              className={pendingCount > 0 ? 'ring-2 ring-amber-300' : undefined}
            >
              <CardContent className="flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-lg font-semibold text-slate-950">{project.name}</h2>
                    <Badge variant={project.is_active ? 'success' : 'warning'}>
                      {project.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    {pendingCount > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                        <RefreshCw className="h-3 w-3" />
                        {pendingCount} re-enable {pendingCount === 1 ? 'request' : 'requests'}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 max-w-2xl text-sm text-slate-600">
                    {project.description ?? 'No description available.'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link href={`/admin/projects/${project.id}`}>
                    <Button variant={pendingCount > 0 ? 'primary' : 'secondary'}>
                      {pendingCount > 0 ? 'Review' : 'Open'}
                    </Button>
                  </Link>
                  <form action={toggleProjectStatusAction}>
                    <input name="project_id" type="hidden" value={project.id} />
                    <input name="next_state" type="hidden" value={String(!project.is_active)} />
                    <SubmitButton
                      variant={project.is_active ? 'danger' : 'primary'}
                      loadingText="Updating…"
                    >
                      {project.is_active ? 'Deactivate' : 'Activate'}
                    </SubmitButton>
                  </form>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
