import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { redirect } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DebouncedDocumentSearch } from '@/components/search/debounced-document-search';
import { requireMember } from '@/lib/auth';
import {
  getProjectById,
  getProjectDocuments,
  getQuizAttemptForProject,
  searchProjectDocumentChunks,
  userHasProjectAccess,
} from '@/lib/data';
import { formatDate } from '@/lib/utils';

function HighlightedSnippet(props: { snippet: string }) {
  const segments = props.snippet
    .split('<<H>>')
    .flatMap((chunk, index) => {
      if (index === 0) {
        return [{ text: chunk, highlighted: false }];
      }

      const [highlightedText = '', ...rest] = chunk.split('<</H>>');

      return [
        { text: highlightedText, highlighted: true },
        { text: rest.join('<</H>>'), highlighted: false },
      ];
    })
    .filter((segment) => segment.text);

  return (
    <>
      {segments.map((segment, index) => {
        return segment.highlighted ? (
          <mark
            key={`${index}-${segment.text.slice(0, 12)}`}
            className="rounded-sm bg-amber-200 px-0.5 text-slate-900"
          >
            {segment.text}
          </mark>
        ) : (
          <span key={`${index}-${segment.text.slice(0, 12)}`}>{segment.text}</span>
        );
      })}
    </>
  );
}

const linkButtonClass =
  'inline-flex h-11 items-center justify-center rounded-xl bg-brand-700 px-4 text-sm font-medium text-white transition hover:bg-brand-800 focus:outline-none focus:ring-2 focus:ring-accent-400 focus:ring-offset-2';

const linkButtonSecondaryClass =
  'inline-flex h-11 items-center justify-center rounded-xl bg-white px-4 text-sm font-medium text-brand-700 ring-1 ring-slate-200 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-accent-400 focus:ring-offset-2';

const linkButtonSecondarySmClass =
  'inline-flex h-9 items-center justify-center rounded-lg bg-white px-3 text-sm font-medium text-brand-700 ring-1 ring-slate-200 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-accent-400 focus:ring-offset-2';

export default async function ProjectOverviewPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const documentQuery = (searchParams.q ?? '').trim();
  const { profile } = await requireMember();
  const canAccess = await userHasProjectAccess(profile!.id, profile?.role, params.id);

  if (!canAccess) {
    redirect('/dashboard');
  }

  const [project, documents, attempt, searchResults] = await Promise.all([
    getProjectById(params.id),
    getProjectDocuments(params.id),
    getQuizAttemptForProject(profile!.id, params.id),
    documentQuery.length >= 2
      ? searchProjectDocumentChunks(params.id, documentQuery)
      : Promise.resolve([]),
  ]);
  const requiredCount = documents.filter((d) => d.is_required).length;

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1.5 text-sm text-slate-500">
        <Link href="/dashboard" className="transition hover:text-slate-900">
          Dashboard
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-slate-900">{project?.name ?? 'Project'}</span>
      </nav>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle>{project?.name ?? 'Project overview'}</CardTitle>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">
                {project?.description ?? 'No project description available.'}
              </p>
            </div>
            <Badge
              variant={
                attempt?.status === 'submitted'
                  ? 'success'
                  : attempt?.status === 'in_progress'
                    ? 'warning'
                    : 'neutral'
              }
            >
              {attempt?.status === 'submitted'
                ? 'Quiz Completed'
                : attempt?.status === 'in_progress'
                  ? 'Quiz In Progress'
                  : 'Quiz Not Started'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Link href={`/projects/${params.id}/chat`} className={linkButtonClass}>
            Elevate AI
          </Link>
          <Link href={`/projects/${params.id}/quiz`} className={linkButtonSecondaryClass}>
            Take the Quest
          </Link>
          <Link href={`/projects/${params.id}/bookmarks`} className={linkButtonSecondaryClass}>
            Bookmarks
          </Link>
          <Link href={`/projects/${params.id}/flashcards`} className={linkButtonSecondaryClass}>
            Flashcards
          </Link>
          <Link href={`/projects/${params.id}/study`} className={linkButtonSecondaryClass}>
            Study Mode
          </Link>
          {requiredCount > 0 && (
            <p className="self-center text-xs font-medium text-amber-700">
              {requiredCount} required doc{requiredCount === 1 ? '' : 's'} must be read before quiz
              unlock.
            </p>
          )}
        </CardContent>
      </Card>

      <Card id="documents">
        <CardHeader>
          <CardTitle>KT documents</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-5">
            <DebouncedDocumentSearch initialQuery={documentQuery} anchorId="documents" />
          </div>

          {documentQuery.length > 0 && (
            <div className="mb-5 space-y-2 rounded-2xl border border-slate-200 bg-white p-3">
              <p className="text-xs text-slate-600">
                Results for{' '}
                <span className="font-medium text-slate-900">&quot;{documentQuery}&quot;</span> (
                {searchResults.length} match{searchResults.length === 1 ? '' : 'es'})
              </p>
              {searchResults.length > 0 ? (
                <div className="space-y-2">
                  {searchResults.map((result) => (
                    <div
                      key={result.chunk_id}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-slate-900">{result.file_name}</p>
                        <a
                          href={`/api/documents/view?documentId=${result.document_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-medium text-blue-700 hover:underline"
                        >
                          Open source
                        </a>
                      </div>
                      <p className="text-sm leading-6 text-slate-700">
                        <HighlightedSnippet snippet={result.snippet} />
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  No matches found in this project&apos;s documents.
                </p>
              )}
            </div>
          )}

          <div className="space-y-3">
            {documents.length ? (
              documents.map((document) => (
                <div
                  key={document.id}
                  className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-900">{document.file_name}</p>
                      {document.is_required && <Badge variant="warning">Required</Badge>}
                    </div>
                    <p className="text-xs text-slate-500">
                      Uploaded {formatDate(document.uploaded_at, true)} • {document.chunk_count}{' '}
                      chunks
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={`/api/documents/view?documentId=${document.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`View ${document.file_name}`}
                    >
                      <Badge variant="info">{document.file_type.toUpperCase()}</Badge>
                    </a>
                    <Link
                      href={`/projects/${params.id}/documents/${document.id}/threads`}
                      className={linkButtonSecondarySmClass}
                    >
                      Threads
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">
                No KT documents are available yet for this project.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
