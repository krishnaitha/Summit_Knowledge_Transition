import Link from 'next/link';
import { Activity, CheckCircle2, FileText, MessageSquare, RefreshCw, Users } from 'lucide-react';

import { ActivityFeed } from '@/components/admin/activity-feed';
import { StatsCard } from '@/components/admin/stats-card';
import { getAdminDashboardStats } from '@/lib/data';
import { formatPercent } from '@/lib/utils';

export default async function AdminDashboardPage() {
  const stats = await getAdminDashboardStats();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">Admin dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Monitor usage, completion, and transition progress across Summit projects.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatsCard
          icon={Users}
          hint="All authenticated portal users"
          label="Total users"
          value={stats.totalUsers}
        />
        <StatsCard
          icon={Activity}
          hint="Users active in the last 7 days"
          label="Active users"
          value={stats.activeUsers}
          accent
        />
        <StatsCard
          icon={FileText}
          hint="KT documents across all projects"
          label="Documents"
          value={stats.totalDocuments ?? 0}
        />
        <StatsCard
          icon={MessageSquare}
          hint="All chatbot prompts and answers"
          label="Chatbot messages"
          value={stats.totalMessages}
        />
        <StatsCard
          icon={CheckCircle2}
          hint="Submitted attempts across all projects"
          label="Quiz completion"
          value={formatPercent(stats.quizCompletionRate)}
          accent
        />
        {stats.pendingRetakeRequests > 0 ? (
          <Link href="/admin/projects" className="block transition hover:opacity-90">
            <StatsCard
              icon={RefreshCw}
              hint="Click to go to Projects and review"
              label="Quiz re-enable requests"
              value={stats.pendingRetakeRequests}
              accent
            />
          </Link>
        ) : (
          <StatsCard
            icon={RefreshCw}
            hint="No pending quiz re-enable requests"
            label="Quiz re-enable requests"
            value={0}
          />
        )}
      </div>

      <ActivityFeed items={stats.recentActivity} />
    </div>
  );
}
