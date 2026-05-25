import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

import { DebouncedDocumentSearch } from '@/components/search/debounced-document-search';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { requireMember } from '@/lib/auth';
import { getAssignedProjects, searchAccessibleDocumentChunks } from '@/lib/data';

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

export default async function MemberSearchPage(props: {
  searchParams: Promise<{ q?: string; projectId?: string }>;
}) {
  const searchParams = await props.searchParams;
  const documentQuery = (searchParams.q ?? '').trim();
  const requestedProjectId = (searchParams.projectId ?? '').trim();
  const { profile } = await requireMember();
  const accessibleProjects = await getAssignedProjects(profile!.id, profile?.last_login_at ?? null);
  const projectOptions = accessibleProjects.map((project) => ({
    id: project.id,
    name: project.name,
  }));
  const selectedProjectId = projectOptions.some((project) => project.id === requestedProjectId)
    ? requestedProjectId
    : '';
  const results =
    documentQuery.length >= 2
      ? await searchAccessibleDocumentChunks(
          profile!.id,
          profile?.role,
          documentQuery,
          20,
          selectedProjectId || undefined,
        )
      : [];

  return (
    <div className="space-y-5">
      <nav className="flex items-center gap-1.5 text-sm text-slate-500">
        <Link href="/dashboard" className="transition hover:text-slate-900">
          Dashboard
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-slate-900">Search documents</span>
      </nav>

      <Card id="search-documents">
        <CardHeader className="pb-4">
          <CardTitle>Search Accessible Documents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <DebouncedDocumentSearch
              initialQuery={documentQuery}
              initialProjectId={selectedProjectId}
              projectOptions={projectOptions}
              anchorId="search-documents"
            />
          </div>

          {documentQuery.length > 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">
                Results for{' '}
                <span className="font-medium text-slate-900">&quot;{documentQuery}&quot;</span> (
                {results.length} match{results.length === 1 ? '' : 'es'})
              </p>
              {results.length > 0 ? (
                <div className="grid gap-3 xl:grid-cols-2">
                  {results.map((result) => (
                    <div
                      key={result.chunk_id}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                    >
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{result.file_name}</p>
                          <p className="text-xs text-slate-500">{result.project_name}</p>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-medium">
                          <Link
                            href={`/projects/${result.project_id}`}
                            className="text-brand-700 hover:underline"
                          >
                            Open project
                          </Link>
                          <a
                            href={`/api/documents/view?documentId=${result.document_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-700 hover:underline"
                          >
                            Open source
                          </a>
                        </div>
                      </div>
                      <p className="text-sm leading-5 text-slate-700">
                        <HighlightedSnippet snippet={result.snippet} />
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No matches found in accessible documents.</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              Start typing to search across documents in all projects you can access.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
