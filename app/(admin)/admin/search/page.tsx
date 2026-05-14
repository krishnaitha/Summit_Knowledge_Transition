import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

import { DebouncedDocumentSearch } from '@/components/search/debounced-document-search';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { requireAnyAdmin } from '@/lib/auth';
import { searchAccessibleDocumentChunks } from '@/lib/data';

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

export default async function AdminSearchPage(props: { searchParams: Promise<{ q?: string }> }) {
  const searchParams = await props.searchParams;
  const documentQuery = (searchParams.q ?? '').trim();
  const { profile } = await requireAnyAdmin();
  const results =
    documentQuery.length >= 2
      ? await searchAccessibleDocumentChunks(profile!.id, profile?.role, documentQuery)
      : [];

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1.5 text-sm text-slate-500">
        <Link href="/admin/dashboard" className="transition hover:text-slate-900">
          Dashboard
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-slate-900">Search documents</span>
      </nav>

      <Card id="search-documents">
        <CardHeader>
          <CardTitle>Search Across All Accessible Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-5">
            <DebouncedDocumentSearch initialQuery={documentQuery} anchorId="search-documents" />
          </div>

          {documentQuery.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm text-slate-600">
                Results for{' '}
                <span className="font-medium text-slate-900">&quot;{documentQuery}&quot;</span> (
                {results.length} match{results.length === 1 ? '' : 'es'})
              </p>
              {results.length > 0 ? (
                results.map((result) => (
                  <div
                    key={result.chunk_id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{result.file_name}</p>
                        <p className="text-xs text-slate-500">{result.project_name}</p>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-medium">
                        <Link
                          href={`/admin/projects/${result.project_id}`}
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
                    <p className="text-sm leading-6 text-slate-700">
                      <HighlightedSnippet snippet={result.snippet} />
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">No matches found in accessible documents.</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              Start typing to search across documents in all accessible projects.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
