import { ProjectCard } from '@/components/layout/project-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { requireMember } from '@/lib/auth';
import { getAssignedProjects } from '@/lib/data';

export default async function DashboardPage() {
  const { profile } = await requireMember();
  const projects = await getAssignedProjects(profile!.id);

  return (
    <div className="space-y-8">
      <Card className="bg-hero-grid text-white">
        <CardHeader>
          <CardTitle className="text-3xl text-white">
            Welcome back, {profile?.full_name ?? 'team member'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="max-w-3xl text-sm leading-7 text-slate-200">
            Review your assigned transition projects, ask grounded KT questions, and complete your
            one-time quiz when you are ready.
          </p>
        </CardContent>
      </Card>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">Assigned projects</h2>
          <p className="text-sm text-slate-500">
            Each card shows document coverage and your quiz status.
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {projects.length ? (
            projects.map((project) => <ProjectCard key={project.id} project={project} />)
          ) : (
            <Card>
              <CardContent className="p-6 text-sm text-slate-500">
                No active projects are assigned yet.
              </CardContent>
            </Card>
          )}
        </div>
      </section>
    </div>
  );
}
