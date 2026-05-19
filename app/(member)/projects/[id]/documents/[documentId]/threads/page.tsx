import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { redirect } from 'next/navigation';

import { DocumentThreadsBoard } from '@/components/documents/document-threads-board';
import { getProjectAdminIds, requireMember } from '@/lib/auth';
import {
  getDocumentById,
  getDocumentThreads,
  getProjectById,
  userHasProjectAccess,
} from '@/lib/data';

export default async function MemberDocumentThreadsPage(props: {
  params: Promise<{ id: string; documentId: string }>;
}) {
  const params = await props.params;
  const { profile } = await requireMember();

  const canAccess = await userHasProjectAccess(profile!.id, profile?.role, params.id);
  if (!canAccess) {
    redirect('/dashboard');
  }

  const [project, document] = await Promise.all([
    getProjectById(params.id),
    getDocumentById(params.documentId),
  ]);

  if (!document || document.project_id !== params.id) {
    redirect(`/projects/${params.id}`);
  }

  const [threads, adminProjectIds] = await Promise.all([
    getDocumentThreads(params.id, params.documentId),
    getProjectAdminIds(profile!.id),
  ]);

  const canModerate = adminProjectIds.includes(params.id);

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
        <span className="font-medium text-slate-900">Document Threads</span>
      </nav>

      <div>
        <p className="text-xs tracking-wide text-slate-500 uppercase">Document</p>
        <p className="text-lg font-semibold text-slate-900">{document.file_name}</p>
      </div>

      <DocumentThreadsBoard
        projectId={params.id}
        document={document}
        threads={threads}
        canModerate={canModerate}
      />
    </div>
  );
}
