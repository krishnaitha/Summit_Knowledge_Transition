import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

import {
  createDocumentConnectorAction,
  deleteDocumentConnectorAction,
  syncDocumentConnectorAction,
  toggleDocumentRequiredAction,
} from '@/app/actions/admin';
import { DocumentConnectorsPanel } from '@/components/admin/document-connectors-panel';
import { DocumentUploadPanel } from '@/components/admin/document-upload-panel';
import { DocumentsList } from '@/components/admin/documents-list';
import { getProjectById, getProjectDocumentConnectors, getProjectDocuments } from '@/lib/data';

export default async function ProjectDocumentsPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const [project, documents, connectors] = await Promise.all([
    getProjectById(params.id),
    getProjectDocuments(params.id),
    getProjectDocumentConnectors(params.id),
  ]);

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
        <span className="font-medium text-slate-900">Documents</span>
      </nav>
      <DocumentConnectorsPanel
        projectId={params.id}
        connectors={connectors}
        createAction={createDocumentConnectorAction}
        syncAction={syncDocumentConnectorAction}
        deleteAction={deleteDocumentConnectorAction}
      />
      <DocumentUploadPanel projectId={params.id} />
      <DocumentsList
        documents={documents}
        projectId={params.id}
        toggleRequiredAction={toggleDocumentRequiredAction}
      />
    </div>
  );
}
