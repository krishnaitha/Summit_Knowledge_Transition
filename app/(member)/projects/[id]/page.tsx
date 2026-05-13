import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { redirect } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { requireMember } from '@/lib/auth';
import { getProjectById, getProjectDocuments, getQuizAttemptForProject, userHasProjectAccess } from '@/lib/data';
import { formatDate } from '@/lib/utils';

export default async function ProjectOverviewPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { profile } = await requireMember();
  const canAccess = await userHasProjectAccess(profile!.id, profile?.role, params.id);

  if (!canAccess) {
    redirect('/dashboard');
  }

  const [project, documents, attempt] = await Promise.all([
    getProjectById(params.id),
    getProjectDocuments(params.id),
    getQuizAttemptForProject(profile!.id, params.id),
  ]);
  const requiredCount = documents.filter((d) => d.is_required).length;

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1.5 text-sm text-slate-500">
        <Link href="/dashboard" className="transition hover:text-slate-900">Dashboard</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-slate-900">{project?.name ?? 'Project'}</span>
      </nav>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle>{project?.name ?? 'Project overview'}</CardTitle>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">{project?.description ?? 'No project description available.'}</p>
            </div>
            <Badge variant={attempt?.status === 'submitted' ? 'success' : attempt?.status === 'in_progress' ? 'warning' : 'neutral'}>
              {attempt?.status === 'submitted' ? 'Quiz Completed' : attempt?.status === 'in_progress' ? 'Quiz In Progress' : 'Quiz Not Started'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Link href={`/projects/${params.id}/chat`}>
            <Button>Ask the AI</Button>
          </Link>
          <Link href={`/projects/${params.id}/quiz`}>
            <Button variant="secondary">Take the Quiz</Button>
          </Link>
          <Link href={`/projects/${params.id}/bookmarks`}>
            <Button variant="secondary">Bookmarks</Button>
          </Link>
          {requiredCount > 0 && (
            <p className="self-center text-xs font-medium text-amber-700">
              {requiredCount} required doc{requiredCount === 1 ? '' : 's'} must be read before quiz unlock.
            </p>
          )}
        </CardContent>
      </Card>

      <Card id="documents">
        <CardHeader>
          <CardTitle>KT documents</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {documents.length ? (
              documents.map((document) => (
                <div key={document.id} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-900">{document.file_name}</p>
                      {document.is_required && <Badge variant="warning">Required</Badge>}
                    </div>
                    <p className="text-xs text-slate-500">Uploaded {formatDate(document.uploaded_at, true)} • {document.chunk_count} chunks</p>
                  </div>
                  <a
                    href={`/api/documents/view?documentId=${document.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`View ${document.file_name}`}
                  >
                    <Badge variant="info">{document.file_type.toUpperCase()}</Badge>
                  </a>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">No KT documents are available yet for this project.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}