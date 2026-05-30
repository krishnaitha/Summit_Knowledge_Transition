import { ChevronRight, Database, ServerCrash } from 'lucide-react';
import Link from 'next/link';

import { SystemHealthErrorsList } from '@/components/admin/system-health-errors-list';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { requireAdmin } from '@/lib/auth';
import { getSystemHealthSnapshot } from '@/lib/data';
import { formatDate } from '@/lib/utils';

function HealthBadge({ ok }: { ok: boolean }) {
  return <Badge variant={ok ? 'success' : 'danger'}>{ok ? 'Healthy' : 'Unhealthy'}</Badge>;
}

export default async function AdminSystemHealthPage() {
  await requireAdmin();
  const snapshot = await getSystemHealthSnapshot();

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1.5 text-sm text-slate-500">
        <Link href="/admin/dashboard" className="transition hover:text-slate-900">
          Dashboard
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-slate-900">System Health</span>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">
            Application Health & Error Stack
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Monitor runtime health and inspect captured application errors with full stack traces.
          </p>
        </div>
        <Badge variant="neutral">Checked {formatDate(snapshot.checkedAt, true)}</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="flex items-start justify-between p-5">
            <div>
              <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                Database
              </p>
              <div className="mt-2">
                <HealthBadge ok={snapshot.databaseHealthy} />
              </div>
            </div>
            <Database className="h-5 w-5 text-slate-400" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-start justify-between p-5">
            <div>
              <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                Worker
              </p>
              <div className="mt-2">
                <HealthBadge ok={snapshot.workerHealthy} />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Last activity: {formatDate(snapshot.lastWorkerActivityAt, true)}
              </p>
            </div>
            <ServerCrash className="h-5 w-5 text-slate-400" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
              Jobs (24h)
            </p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">{snapshot.failedJobs24h}</p>
            <p className="text-xs text-slate-500">failed jobs</p>
            <p className="mt-2 text-xs text-slate-500">
              Pending: {snapshot.pendingJobs} • Running: {snapshot.runningJobs}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
              App Errors (24h)
            </p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">{snapshot.appErrors24h}</p>
            <p className="text-xs text-slate-500">captured runtime errors</p>
            <p className="mt-2 text-xs text-slate-500">
              RAG requests (1h): {snapshot.ragRequestsLastHour} • Avg latency:{' '}
              {snapshot.ragAvgLatencyMsLastHour} ms
            </p>
          </CardContent>
        </Card>
      </div>

      <SystemHealthErrorsList errors={snapshot.errors} />

      <Card>
        <CardHeader>
          <CardTitle>Totals</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
          <p>
            Failed jobs total:{' '}
            <span className="font-semibold text-slate-900">{snapshot.failedJobsTotal}</span>
          </p>
          <p>
            Failed jobs (24h):{' '}
            <span className="font-semibold text-slate-900">{snapshot.failedJobs24h}</span>
          </p>
          <p>
            App errors (24h):{' '}
            <span className="font-semibold text-slate-900">{snapshot.appErrors24h}</span>
          </p>
          <p>
            Captured errors shown:{' '}
            <span className="font-semibold text-slate-900">{snapshot.errors.length}</span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
