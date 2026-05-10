import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { redirect } from 'next/navigation';

import { ChatInterface } from '@/components/chat/chat-interface';
import { requireMember } from '@/lib/auth';
import { getChatMessages, getBookmarkedMessageIds, getProjectById, getProjectChatSessions, userHasProjectAccess } from '@/lib/data';

export default async function ProjectChatPage({ params }: { params: { id: string } }) {
  const { profile } = await requireMember();
  const canAccess = await userHasProjectAccess(profile!.id, profile?.role, params.id);

  if (!canAccess) {
    redirect('/dashboard');
  }

  const project = await getProjectById(params.id);
  const sessions = await getProjectChatSessions(profile!.id, params.id);
  const initialSession = sessions[0] ?? null;
  const [messages, initialBookmarkedIds] = await Promise.all([
    initialSession ? getChatMessages(initialSession.id) : Promise.resolve([]),
    initialSession ? getBookmarkedMessageIds(profile!.id, initialSession.id) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1.5 text-sm text-slate-500">
        <Link href="/dashboard" className="transition hover:text-slate-900">Dashboard</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href={`/projects/${params.id}`} className="transition hover:text-slate-900">{project?.name ?? 'Project'}</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-slate-900">Chat</span>
      </nav>

      <ChatInterface
        initialMessages={messages.map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content,
          sources: message.sources,
        }))}
        initialSessionId={initialSession?.id ?? null}
        initialSessions={sessions.map((session, index) => ({
          id: session.id,
          label: index === 0 ? 'Most recent chat' : `Chat ${index + 1}`,
        }))}
        projectId={params.id}
        projectName={project?.name ?? 'Project'}
        initialBookmarkedIds={initialBookmarkedIds}
      />
    </div>
  );
}