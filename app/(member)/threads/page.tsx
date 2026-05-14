import Link from 'next/link';
import { BellRing, ChevronRight } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { requireMember } from '@/lib/auth';
import { getOpenThreadsForUser } from '@/lib/data';
import { formatDate } from '@/lib/utils';

export default async function MemberOpenThreadsPage(props: {
  searchParams: Promise<{ project?: string; document?: string; today?: string; status?: string }>;
}) {
  const searchParams = await props.searchParams;
  const projectFilter = (searchParams.project ?? '').trim();
  const documentFilter = (searchParams.document ?? '').trim();
  const updatedTodayOnly = (searchParams.today ?? '') === '1';
  const rawStatus = (searchParams.status ?? 'open').trim().toLowerCase();
  const statusFilter =
    rawStatus === 'resolved' || rawStatus === 'all' || rawStatus === 'open' ? rawStatus : 'open';

  const { profile } = await requireMember();
  const rows = await getOpenThreadsForUser(profile!.id, profile?.role, statusFilter);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const projectOptions = Array.from(
    new Map(rows.map((row) => [row.project_id, row.project_name])).entries(),
  ).map(([id, name]) => ({ id, name }));

  const documentOptions = Array.from(
    new Map(rows.map((row) => [row.document_id, row.document_name])).entries(),
  ).map(([id, name]) => ({ id, name }));

  const filteredRows = rows.filter((row) => {
    if (projectFilter && row.project_id !== projectFilter) return false;
    if (documentFilter && row.document_id !== documentFilter) return false;
    if (updatedTodayOnly && new Date(row.updated_at) < todayStart) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1.5 text-sm text-slate-500">
        <Link href="/dashboard" className="transition hover:text-slate-900">
          Dashboard
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-slate-900">Open Threads</span>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Document Threads</h1>
          <p className="mt-1 text-sm text-slate-500">
            Track open and closed discussions across your assigned projects.
          </p>
        </div>
        <Badge variant={rows.length > 0 ? 'warning' : 'neutral'}>
          <BellRing className="h-3.5 w-3.5" />
          {filteredRows.length}{' '}
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
              <Link href="/threads">
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
          {filteredRows.length ? (
            filteredRows.map((row) => (
              <div
                key={row.thread_id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-slate-900">{row.title}</p>
                  <Link href={`/projects/${row.project_id}/documents/${row.document_id}/threads`}>
                    <Button size="sm" variant="secondary">
                      Open thread
                    </Button>
                  </Link>
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {row.project_name} • {row.document_name}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {row.page_number ? `Page ${row.page_number} • ` : ''}
                  {Number(row.comment_count)} comments • Updated {formatDate(row.updated_at, true)}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">No threads match the selected filters.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
