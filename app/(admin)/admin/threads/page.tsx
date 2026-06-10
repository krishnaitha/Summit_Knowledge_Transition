import Link from 'next/link';
import { BellRing, ChevronLeft, ChevronRight } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { requireAnyAdmin } from '@/lib/auth';
import { getAdminThreadQueuePage } from '@/lib/data';
import { formatDate } from '@/lib/utils';

const PAGE_SIZE = 20;

function buildThreadsHref(params: {
  projectFilter: string;
  documentFilter: string;
  updatedTodayOnly: boolean;
  statusFilter: 'open' | 'resolved' | 'all';
  page: number;
}) {
  const searchParams = new URLSearchParams();

  if (params.projectFilter) searchParams.set('project', params.projectFilter);
  if (params.documentFilter) searchParams.set('document', params.documentFilter);
  if (params.updatedTodayOnly) searchParams.set('today', '1');
  if (params.statusFilter !== 'open') searchParams.set('status', params.statusFilter);
  if (params.page > 1) searchParams.set('page', String(params.page));

  const query = searchParams.toString();
  return query ? `/admin/threads?${query}` : '/admin/threads';
}

export default async function AdminOpenThreadsPage(props: {
  searchParams: Promise<{
    project?: string;
    document?: string;
    today?: string;
    status?: string;
    page?: string;
  }>;
}) {
  const searchParams = await props.searchParams;
  const projectFilter = (searchParams.project ?? '').trim();
  const documentFilter = (searchParams.document ?? '').trim();
  const updatedTodayOnly = (searchParams.today ?? '') === '1';
  const page = Math.max(Number.parseInt((searchParams.page ?? '1').trim(), 10) || 1, 1);
  const rawStatus = (searchParams.status ?? 'open').trim().toLowerCase();
  const statusFilter =
    rawStatus === 'resolved' || rawStatus === 'all' || rawStatus === 'open' ? rawStatus : 'open';

  await requireAnyAdmin();
  const { rows, totalCount, projectOptions, documentOptions } = await getAdminThreadQueuePage({
    statusFilter,
    projectFilter,
    documentFilter,
    updatedTodayOnly,
    page,
    pageSize: PAGE_SIZE,
  });
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = totalCount === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const pageEnd = totalCount === 0 ? 0 : pageStart + rows.length - 1;

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1.5 text-sm text-slate-500">
        <Link href="/admin/dashboard" className="transition hover:text-slate-900">
          Dashboard
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-slate-900">Open Threads</span>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Document Threads</h1>
          <p className="mt-1 text-sm text-slate-500">
            Track open and closed discussions across accessible projects.
          </p>
        </div>
        <Badge variant={totalCount > 0 ? 'warning' : 'neutral'}>
          <BellRing className="h-3.5 w-3.5" />
          {totalCount}{' '}
          {statusFilter === 'all' ? 'shown' : statusFilter === 'resolved' ? 'closed' : 'open'}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            method="get"
            className="grid gap-3 md:grid-cols-[1fr_1fr_180px_auto_auto] md:items-end"
          >
            <label className="grid gap-1 text-sm text-slate-600">
              Project
              <select
                name="project"
                defaultValue={projectFilter}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
              >
                <option value="">All projects</option>
                {projectOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm text-slate-600">
              Document
              <select
                name="document"
                defaultValue={documentFilter}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
              >
                <option value="">All documents</option>
                {documentOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm text-slate-600">
              Status
              <select
                name="status"
                defaultValue={statusFilter}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
              >
                <option value="open">Open</option>
                <option value="resolved">Closed</option>
                <option value="all">All</option>
              </select>
            </label>
            <label className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm text-slate-700">
              <input type="checkbox" name="today" value="1" defaultChecked={updatedTodayOnly} />
              Updated today
            </label>
            <div className="flex gap-2">
              <Button type="submit" variant="secondary">
                Apply
              </Button>
              <Link href="/admin/threads">
                <Button type="button" variant="ghost">
                  Clear
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Thread Queue</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {rows.length ? (
            rows.map((row) => (
              <div
                key={row.thread_id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-slate-900">{row.title}</p>
                  <Link
                    href={
                      row.source === 'knowledge_gap'
                        ? `/admin/knowledge-gap-threads/${row.thread_id}`
                        : `/admin/projects/${row.project_id}/documents/${row.document_id}/threads`
                    }
                  >
                    <Button size="sm" variant="secondary">
                      Open thread
                    </Button>
                  </Link>
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {row.project_name} • {row.document_name ?? 'Knowledge gap discussion'}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {row.source === 'knowledge_gap' ? 'Knowledge gap • ' : ''}
                  {row.page_number ? `Page ${row.page_number} • ` : ''}
                  {Number(row.comment_count)} comments • Updated {formatDate(row.updated_at, true)}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">No threads match the selected filters.</p>
          )}

          {totalCount > PAGE_SIZE && (
            <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">
                Showing {pageStart}-{pageEnd} of {totalCount} threads
              </p>
              <div className="flex items-center gap-2">
                <Link
                  href={buildThreadsHref({
                    projectFilter,
                    documentFilter,
                    updatedTodayOnly,
                    statusFilter,
                    page: Math.max(1, currentPage - 1),
                  })}
                  aria-disabled={currentPage === 1}
                  className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''}
                >
                  <Button type="button" variant="secondary" disabled={currentPage === 1}>
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                </Link>
                <span className="text-sm text-slate-600">
                  Page {currentPage} of {totalPages}
                </span>
                <Link
                  href={buildThreadsHref({
                    projectFilter,
                    documentFilter,
                    updatedTodayOnly,
                    statusFilter,
                    page: Math.min(totalPages, currentPage + 1),
                  })}
                  aria-disabled={currentPage === totalPages}
                  className={currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}
                >
                  <Button type="button" variant="secondary" disabled={currentPage === totalPages}>
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
