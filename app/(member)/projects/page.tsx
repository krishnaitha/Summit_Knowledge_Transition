import { ProjectCard } from '@/components/layout/project-card';
import { Card, CardContent } from '@/components/ui/card';
import { requireMember } from '@/lib/auth';
import { getAssignedProjects } from '@/lib/data';

export default async function MyProjectsPage() {
  const { profile } = await requireMember();
  const projects = await getAssignedProjects(profile!.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">My Products</h1>
        <p className="mt-1 text-sm text-slate-500">Your assigned knowledge transfer products.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {projects.length ? (
          projects.map((project) => <ProjectCard key={project.id} project={project} />)
        ) : (
          <Card>
            <CardContent className="p-6 text-sm text-slate-500">
              No active products are assigned yet.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
