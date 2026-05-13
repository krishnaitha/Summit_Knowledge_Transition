'use client';

import { useState } from 'react';

import { AnalyticsTable } from '@/components/admin/analytics-table';
import { ObservabilityPanel } from '@/components/admin/observability-panel';
import { QuizResultsCard, type QuizResultRow } from '@/components/admin/quiz-results-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const TAB_ITEMS = [
  { key: 'overview', label: 'Overview' },
  { key: 'learning', label: 'Learning' },
  { key: 'adoption', label: 'Adoption' },
  { key: 'ai', label: 'AI Feedback' },
  { key: 'observability', label: 'Observability' },
] as const;

type TabKey = (typeof TAB_ITEMS)[number]['key'];

type FlatRow = Array<Record<string, string | number>>;

type AnalyticsTabsProps = {
  projectId: string;
  adminId?: string;
  resetAction: (formData: FormData) => Promise<void>;
  observability: Parameters<typeof ObservabilityPanel>[0]['metrics'];
  analytics: {
    onboardingSummary: {
      membersAssigned: number;
      completionRate: number;
      averageCompletionHours: number;
      averageAttemptsPerMember: number;
    };
    quizResults: QuizResultRow[];
    weakTopics: FlatRow;
    dropOffRows: FlatRow;
    chatbotUsage: FlatRow;
    loginActivity: FlatRow;
    knowledgeGaps: FlatRow;
    answerFeedback: FlatRow;
  };
};

function MetricCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
        <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
        <p className="mt-2 text-xs text-slate-500">{hint}</p>
      </CardContent>
    </Card>
  );
}

export function ProjectAnalyticsTabs({
  projectId,
  adminId,
  resetAction,
  analytics,
  observability,
}: AnalyticsTabsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="space-y-3">
          <CardTitle>How to read these analytics</CardTitle>
          <CardDescription>
            Weak topics by score shows section-level accuracy across submitted quizzes (Correct/Total). Lower score means members need coaching in that topic.
          </CardDescription>
          <CardDescription>
            AI answer feedback summary aggregates member thumbs up and thumbs down feedback with reason tags (for example unclear, inaccurate, or missing detail).
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap gap-2">
            {TAB_ITEMS.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    active
                      ? 'bg-brand-700 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                  aria-pressed={active}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </CardHeader>
      </Card>

      {activeTab === 'overview' && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Members assigned"
              value={String(analytics.onboardingSummary.membersAssigned)}
              hint="Members currently mapped to this project"
            />
            <MetricCard
              label="Completion rate"
              value={`${analytics.onboardingSummary.completionRate}%`}
              hint="Members who submitted quiz at least once"
            />
            <MetricCard
              label="Avg completion time"
              value={`${analytics.onboardingSummary.averageCompletionHours}h`}
              hint="From assignment time to first submitted quiz"
            />
            <MetricCard
              label="Avg attempts / member"
              value={String(analytics.onboardingSummary.averageAttemptsPerMember)}
              hint="Includes retakes and in-progress attempts"
            />
          </div>

          <QuizResultsCard
            projectId={projectId}
            adminId={adminId}
            rows={analytics.quizResults}
            resetAction={resetAction}
          />
        </div>
      )}

      {activeTab === 'learning' && (
        <div className="space-y-5">
          <AnalyticsTable rows={analytics.weakTopics} title="Weak topics by score" />
          <AnalyticsTable rows={analytics.dropOffRows} title="Onboarding drop-off points" />
        </div>
      )}

      {activeTab === 'adoption' && (
        <div className="space-y-5">
          <AnalyticsTable rows={analytics.chatbotUsage} title="Chatbot usage" />
          <AnalyticsTable rows={analytics.loginActivity} title="Login activity" />
        </div>
      )}

      {activeTab === 'ai' && (
        <div className="space-y-5">
          <AnalyticsTable rows={analytics.answerFeedback} title="AI answer feedback summary" />
          <AnalyticsTable rows={analytics.knowledgeGaps} title="Knowledge gaps — unanswered queries" />
        </div>
      )}

      {activeTab === 'observability' && (
        <div>
          <h2 className="mb-3 text-xl font-semibold text-slate-900">RAG observability</h2>
          <ObservabilityPanel metrics={observability} />
        </div>
      )}
    </div>
  );
}
