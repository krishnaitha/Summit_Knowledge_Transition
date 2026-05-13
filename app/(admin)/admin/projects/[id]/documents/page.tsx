import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

import { toggleDocumentRequiredAction } from '@/app/actions/admin';
import { DocumentUploadPanel } from '@/components/admin/document-upload-panel';
import { DocumentsList } from '@/components/admin/documents-list';
import { getProjectById, getProjectDocuments } from '@/lib/data';

export default async function ProjectDocumentsPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const [project, documents] = await Promise.all([
    getProjectById(params.id),
    getProjectDocuments(params.id),
  ]);

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1.5 text-sm text-slate-500">
        <Link href="/admin/projects" className="transition hover:text-slate-900">Projects</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href={`/admin/projects/${params.id}`} className="transition hover:text-slate-900">{project?.name ?? 'Project'}</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-slate-900">Documents</span>
      </nav>
      <DocumentUploadPanel projectId={params.id} />
      <DocumentsList documents={documents} projectId={params.id} toggleRequiredAction={toggleDocumentRequiredAction} />
    </div>
  );
}