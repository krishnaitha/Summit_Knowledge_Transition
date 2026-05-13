import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

import { removeProjectMemberAction, updateProjectMemberRoleAction } from '@/app/actions/admin';
import { MemberInviteForm } from '@/components/admin/member-invite-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SubmitButton } from '@/components/ui/submit-button';
import { getProjectById, getProjectMembers } from '@/lib/data';
import { requireProjectAdmin } from '@/lib/auth';
import { formatDate } from '@/lib/utils';

export default async function ProjectMembersPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  await requireProjectAdmin(params.id);
  const [project, members] = await Promise.all([
    getProjectById(params.id),
    getProjectMembers(params.id),
  ]);

  return (
    <div className="space-y-8">
      <nav className="flex items-center gap-1.5 text-sm text-slate-500">
        <Link href="/admin/projects" className="transition hover:text-slate-900">Projects</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href={`/admin/projects/${params.id}`} className="transition hover:text-slate-900">{project?.name ?? 'Project'}</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-slate-900">Members</span>
      </nav>
      <Card>
        <CardHeader>
          <CardTitle>Invite or assign member</CardTitle>
        </CardHeader>
        <CardContent>
          <MemberInviteForm projectId={params.id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assigned members</CardTitle>
          <p className="text-sm text-slate-500">
            Project admins can manage documents, members, and quizzes for this project only. They don't have access to other projects.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {members.length ? (
            members.map((member) => (
              <div key={member.id} className="flex flex-col gap-4 rounded-2xl bg-slate-50 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-900">{member.full_name ?? member.email}</p>
                    <Badge variant={member.project_role === 'admin' ? 'info' : 'neutral'}>
                      {member.project_role === 'admin' ? 'Project admin' : 'Member'}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-500">{member.email} • Assigned {formatDate(member.assigned_at, true)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <form action={updateProjectMemberRoleAction} className="flex items-center gap-2">
                    <input name="project_id" type="hidden" value={params.id} />
                    <input name="user_id" type="hidden" value={member.id} />
                    <input name="role" type="hidden" value={member.project_role === 'admin' ? 'member' : 'admin'} />
                    <SubmitButton variant="secondary" loadingText="Updating…">
                      {member.project_role === 'admin' ? 'Remove admin' : 'Make admin'}
                    </SubmitButton>
                  </form>
                  <form action={removeProjectMemberAction}>
                    <input name="project_id" type="hidden" value={params.id} />
                    <input name="user_id" type="hidden" value={member.id} />
                    <SubmitButton variant="danger" loadingText="Removing…">Remove</SubmitButton>
                  </form>
                </div>
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