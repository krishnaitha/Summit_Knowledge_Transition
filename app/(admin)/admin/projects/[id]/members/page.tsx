import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

import { inviteProjectMemberAction, removeProjectMemberAction } from '@/app/actions/admin';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SubmitButton } from '@/components/ui/submit-button';
import { getProjectById, getProjectMembers } from '@/lib/data';
import { formatDate } from '@/lib/utils';

export default async function ProjectMembersPage({ params }: { params: { id: string } }) {
  const [project, members] = await Promise.all([
    getProjectById(params.id),
    getProjectMembers(params.id),
  ]);

  return (
    <div className="space-y-8">
      <nav className="flex items-center gap-1.5 text-sm text-slate-500">
        <Link href="/admin/projects" className="transition hover:text-slate-900">
          Projects
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href={`/admin/projects/${params.id}`} className="transition hover:text-slate-900">
          {project?.name ?? 'Project'}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-slate-900">Members</span>
      </nav>
      <Card>
        <CardHeader>
          <CardTitle>Invite or assign member</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={inviteProjectMemberAction} className="grid gap-4 lg:grid-cols-3">
            <input name="project_id" type="hidden" value={params.id} />
            <Input name="full_name" placeholder="Full name" />
            <Input name="email" placeholder="name@company.com" required type="email" />
            <SubmitButton className="lg:w-fit" loadingText="Inviting…">
              Invite with magic link
            </SubmitButton>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assigned members</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {members.length ? (
            members.map((member) => (
              <div
                key={member.id}
                className="flex flex-col gap-4 rounded-2xl bg-slate-50 p-4 lg:flex-row lg:items-center lg:justify-between"
              >
                <div>
                  <p className="font-semibold text-slate-900">{member.full_name ?? member.email}</p>
                  <p className="text-sm text-slate-500">
                    {member.email} • Assigned {formatDate(member.assigned_at, true)}
                  </p>
                </div>
                <form action={removeProjectMemberAction}>
                  <input name="project_id" type="hidden" value={params.id} />
                  <input name="user_id" type="hidden" value={member.id} />
                  <SubmitButton variant="danger" loadingText="Removing…">
                    Remove
                  </SubmitButton>
                </form>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">No members assigned yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
