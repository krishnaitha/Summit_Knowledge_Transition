import { ChevronRight } from 'lucide-react';
import Link from 'next/link';

import { ChatInterface } from '@/components/chat/chat-interface';
import { requireAdmin } from '@/lib/auth';
import { getChatMessages, getProjectById, getProjectChatSessions } from '@/lib/data';

export default async function AdminProjectChatPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { profile } = await requireAdmin();

  const [project, sessions] = await Promise.all([
    getProjectById(params.id),
    getProjectChatSessions(profile!.id, params.id),
  ]);

  const initialSession = sessions[0] ?? null;
  const messages = initialSession ? await getChatMessages(initialSession.id) : [];

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1.5 text-sm text-slate-500">
        <Link href="/admin/projects" className="transition hover:text-slate-900">
          Products
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href={`/admin/projects/${params.id}`} className="transition hover:text-slate-900">
          {project?.name ?? 'Project'}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-slate-900">Chat</span>
      </nav>

      <ChatInterface
        initialMessages={messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          sources: m.sources,
        }))}
        initialSessionId={initialSession?.id ?? null}
        initialSessions={sessions.map((s, i) => ({
          id: s.id,
          label: i === 0 ? 'Most recent chat' : `Chat ${i + 1}`,
        }))}
        projectId={params.id}
        projectName={project?.name ?? 'Project'}
      />
    </div>
  );
}
