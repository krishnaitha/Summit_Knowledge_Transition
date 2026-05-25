import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { redirect } from 'next/navigation';

import { ChatInterface } from '@/components/chat/chat-interface';
import { requireMember } from '@/lib/auth';
import { getProjectById, userHasProjectAccess } from '@/lib/data';

export default async function ProjectChatPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { profile } = await requireMember();
  const canAccess = await userHasProjectAccess(profile!.id, profile?.role, params.id);

  if (!canAccess) {
    redirect('/dashboard');
  }

  const project = await getProjectById(params.id);

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
        <span className="font-medium text-slate-900">Chat</span>
      </nav>

      <ChatInterface
        initialMessages={[]}
        initialSessionId={null}
        initialSessions={[]}
        projectId={params.id}
        projectName={project?.name ?? 'Project'}
        initialBookmarkedIds={[]}
      />
    </div>
  );
}
