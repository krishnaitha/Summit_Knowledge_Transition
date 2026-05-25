import { ChevronRight } from 'lucide-react';
import Link from 'next/link';

import { ChatInterface } from '@/components/chat/chat-interface';
import { requireAdmin } from '@/lib/auth';
import { getProjectById } from '@/lib/data';

export default async function AdminProjectChatPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  await requireAdmin();

  const project = await getProjectById(params.id);

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
        initialMessages={[]}
        initialSessionId={null}
        initialSessions={[]}
        projectId={params.id}
        projectName={project?.name ?? 'Project'}
      />
    </div>
  );
}
