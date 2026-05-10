import Link from 'next/link';

import { createProjectAction, toggleProjectStatusAction } from '@/app/actions/admin';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SubmitButton } from '@/components/ui/submit-button';
import { Textarea } from '@/components/ui/textarea';
import { requireAdmin } from '@/lib/auth';
import { getAllProjects } from '@/lib/data';

export default async function AdminProjectsPage() {
  const { profile } = await requireAdmin();
  const projects = await getAllProjects();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-slate-950">Projects</h1>
        <p className="mt-2 text-sm text-slate-500">Create projects, control active status, and open each project workspace.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create project</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createProjectAction} className="grid gap-4 lg:grid-cols-2">
            <input name="created_by" type="hidden" value={profile!.id} />
            <Input name="name" placeholder="Project name" required />
            <Input defaultValue="60" min={0} max={100} name="pass_threshold" placeholder="Pass threshold" type="number" />
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
        {projects.map((project) => (
          <Card key={project.id}>
            <CardContent className="flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-slate-950">{project.name}</h2>
                  <Badge variant={project.is_active ? 'success' : 'warning'}>{project.is_active ? 'Active' : 'Inactive'}</Badge>
                </div>
                <p className="mt-2 max-w-2xl text-sm text-slate-600">{project.description ?? 'No description available.'}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href={`/admin/projects/${project.id}`}>
                  <Button variant="secondary">Open</Button>
                </Link>
                <form action={toggleProjectStatusAction}>
                  <input name="project_id" type="hidden" value={project.id} />
                  <input name="next_state" type="hidden" value={String(!project.is_active)} />
                  <SubmitButton variant={project.is_active ? 'danger' : 'primary'} loadingText="Updating…">
                    {project.is_active ? 'Deactivate' : 'Activate'}
                  </SubmitButton>
                </form>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}