import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { redirect } from 'next/navigation';

import { DocumentThreadsBoard } from '@/components/documents/document-threads-board';
import { requireProjectAdmin } from '@/lib/auth';
import { getDocumentById, getDocumentThreads, getProjectById } from '@/lib/data';

export default async function AdminDocumentThreadsPage(props: {
  params: Promise<{ id: string; documentId: string }>;
}) {
  const params = await props.params;
  await requireProjectAdmin(params.id);

  const [project, document, threads] = await Promise.all([
    getProjectById(params.id),
    getDocumentById(params.documentId),
    getDocumentThreads(params.id, params.documentId),
  ]);

  if (!document || document.project_id !== params.id) {
    redirect(`/admin/projects/${params.id}/documents`);
  }

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1.5 text-sm text-slate-500">
        <Link href="/admin/projects" className="transition hover:text-slate-900">
          Projects
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href={`/admin/projects/${params.id}`} className="transition hover:text-slate-900">
          {project?.name ?? 'Project'}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link
          href={`/admin/projects/${params.id}/documents`}
          className="transition hover:text-slate-900"
        >
          Documents
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
        canModerate={true}
      />
    </div>
  );
}
