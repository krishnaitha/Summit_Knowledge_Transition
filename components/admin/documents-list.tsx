'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';

import { deleteDocumentAction } from '@/app/actions/admin';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SubmitButton } from '@/components/ui/submit-button';
import type { DocumentRecord } from '@/lib/types/database';
import { formatDate } from '@/lib/utils';

const PAGE_SIZE = 10;

export function DocumentsList({
  documents,
  projectId,
}: {
  documents: DocumentRecord[];
  projectId: string;
}) {
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(0);

  const filtered = documents.filter((d) =>
    d.file_name.toLowerCase().includes(filter.toLowerCase()),
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const visible = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const start = filtered.length === 0 ? 0 : safePage * PAGE_SIZE + 1;
  const end = Math.min(safePage * PAGE_SIZE + PAGE_SIZE, filtered.length);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Uploaded documents</CardTitle>
          {documents.length > PAGE_SIZE && (
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="pl-9"
                placeholder="Filter by file name…"
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value);
                  setPage(0);
                }}
              />
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {visible.length ? (
          visible.map((document) => (
            <div
              key={document.id}
              className="flex flex-col gap-4 rounded-2xl bg-slate-50 p-4 lg:flex-row lg:items-center lg:justify-between"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-slate-900">{document.file_name}</p>
                  <Badge variant="info">{document.file_type.toUpperCase()}</Badge>
                  <Badge
                    variant={
                      document.classification === 'confidential'
                        ? 'danger'
                        : document.classification === 'internal'
                          ? 'warning'
                          : 'success'
                    }
                  >
                    {document.classification.charAt(0).toUpperCase() +
                      document.classification.slice(1)}
                  </Badge>
                  {document.pii_detections > 0 && (
                    <Badge variant="danger">PII &middot; {document.pii_detections}</Badge>
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  Uploaded {formatDate(document.uploaded_at, true)} &bull; {document.chunk_count}{' '}
                  chunks
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`/api/documents/view?documentId=${document.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button type="button" variant="secondary">
                    View
                  </Button>
                </a>
                <form action={deleteDocumentAction}>
                  <input name="project_id" type="hidden" value={projectId} />
                  <input name="document_id" type="hidden" value={document.id} />
                  <input name="file_url" type="hidden" value={document.file_url} />
                  <SubmitButton variant="danger" loadingText="Deleting…">
                    Delete
                  </SubmitButton>
                </form>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-500">
            {filter ? 'No documents match your filter.' : 'No documents uploaded yet.'}
          </p>
        )}

        {filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <p className="text-sm text-slate-500">
              {start}–{end} of {filtered.length}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                disabled={safePage === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="secondary"
                disabled={safePage >= totalPages - 1}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
