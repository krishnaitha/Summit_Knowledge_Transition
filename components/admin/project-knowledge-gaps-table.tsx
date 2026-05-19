'use client';

import { useRef, useState, useTransition } from 'react';
import { FileText, ArrowRight, MessageSquarePlus } from 'lucide-react';
import Link from 'next/link';

import { createKnowledgeGapThreadAction } from '@/app/actions/document-threads';

type GapRow = Record<string, string | number>;

function CreateThreadButton({ query, projectId }: { query: string; projectId: string }) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(async () => {
      await createKnowledgeGapThreadAction(data);
      setDone(true);
    });
  }

  if (done) {
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-green-700">
        <MessageSquarePlus className="h-3 w-3" />
        Thread created
      </span>
    );
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit}>
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="gap_query" value={query} />
      <button
        type="submit"
        disabled={pending}
        className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 transition hover:border-slate-900 hover:text-slate-900 disabled:opacity-60"
        title="Raise a discussion thread for this knowledge gap"
      >
        <MessageSquarePlus className="h-3 w-3" />
        {pending ? 'Creating…' : 'Thread'}
      </button>
    </form>
  );
}

export function ProjectKnowledgeGapsTable({
  rows,
  projectId,
}: {
  rows: GapRow[];
  projectId: string;
}) {
  if (!rows.length) {
    return (
      <p className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-500">
        No unanswered queries in the last 30 days.
      </p>
    );
  }

  const columns = Object.keys(rows[0]);

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            {columns.map((col) => (
              <th
                key={col}
                className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase"
              >
                {col}
              </th>
            ))}
            <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const query = String(row.query ?? '');
            return (
              <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                {columns.map((col) => (
                  <td key={col} className="px-4 py-3 text-slate-700">
                    {String(row[col] ?? '—')}
                  </td>
                ))}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {query && (
                      <>
                        <Link
                          href={`/admin/generate-document?context=${encodeURIComponent(query)}`}
                          className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 transition hover:border-slate-900 hover:text-slate-900"
                          title="Capture knowledge for this topic"
                        >
                          <FileText className="h-3 w-3" />
                          Capture
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                        <CreateThreadButton query={query} projectId={projectId} />
                      </>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
