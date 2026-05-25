'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Search,
  Zap,
} from 'lucide-react';

import { AnalyticsTable } from '@/components/admin/analytics-table';
import { StatsCard } from '@/components/admin/stats-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import type { ObservabilityMetrics } from '@/lib/data';

const OBSERVABILITY_PAGE_SIZE = 8;

export function ObservabilityPanel({ metrics }: { metrics: ObservabilityMetrics }) {
  const {
    totalRequests,
    retrievalHitRate,
    avgSimilarityScore,
    refusalRate,
    possibleHallucinationCount,
    slowQueryCount,
    tokenUsageByDay,
    topUnansweredQueries,
    possibleHallucinations,
    slowQueries,
  } = metrics;

  const tokenTableRows = tokenUsageByDay.map((row) => ({
    Date: row.date,
    'Prompt Tokens': row.promptTokens,
    'Completion Tokens': row.completionTokens,
    'Total Tokens': row.totalTokens,
  }));

  const [unansweredPage, setUnansweredPage] = useState(0);
  const [hallucinationPage, setHallucinationPage] = useState(0);

  const unansweredTotalPages = Math.max(
    1,
    Math.ceil(topUnansweredQueries.length / OBSERVABILITY_PAGE_SIZE),
  );
  const safeUnansweredPage = Math.min(unansweredPage, unansweredTotalPages - 1);
  const visibleUnanswered = useMemo(
    () =>
      topUnansweredQueries.slice(
        safeUnansweredPage * OBSERVABILITY_PAGE_SIZE,
        safeUnansweredPage * OBSERVABILITY_PAGE_SIZE + OBSERVABILITY_PAGE_SIZE,
      ),
    [safeUnansweredPage, topUnansweredQueries],
  );

  const hallucinationTotalPages = Math.max(
    1,
    Math.ceil(possibleHallucinations.length / OBSERVABILITY_PAGE_SIZE),
  );
  const safeHallucinationPage = Math.min(hallucinationPage, hallucinationTotalPages - 1);
  const visibleHallucinations = useMemo(
    () =>
      possibleHallucinations.slice(
        safeHallucinationPage * OBSERVABILITY_PAGE_SIZE,
        safeHallucinationPage * OBSERVABILITY_PAGE_SIZE + OBSERVABILITY_PAGE_SIZE,
      ),
    [possibleHallucinations, safeHallucinationPage],
  );

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <StatsCard
          label="Total Queries"
          value={totalRequests}
          hint="All chat requests"
          icon={Activity}
        />
        <StatsCard
          label="Retrieval Hit Rate"
          value={`${retrievalHitRate}%`}
          hint="Queries above similarity threshold"
          icon={CheckCircle}
          accent={retrievalHitRate < 60 && totalRequests > 0}
        />
        <StatsCard
          label="Avg Similarity"
          value={`${(avgSimilarityScore * 100).toFixed(1)}%`}
          hint="Mean similarity across requests"
          icon={Search}
        />
        <StatsCard
          label="Refusal Rate"
          value={`${refusalRate}%`}
          hint="No matching context found"
          icon={AlertTriangle}
          accent={refusalRate > 20 && totalRequests > 0}
        />
        <StatsCard
          label="Possible Hallucinations"
          value={possibleHallucinationCount}
          hint="Answered with similarity < 35%"
          icon={Zap}
          accent={possibleHallucinationCount > 0}
        />
        <StatsCard
          label="Slow Queries"
          value={slowQueryCount}
          hint="End-to-end latency > 8 s"
          icon={Clock}
          accent={slowQueryCount > 0}
        />
      </div>

      {/* Token usage over time */}
      {tokenTableRows.length > 0 ? (
        <AnalyticsTable title="Token usage (last 30 days)" rows={tokenTableRows} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Token usage (last 30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-400">
              No token data yet — send some chat messages to see usage.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Unanswered queries + hallucinations */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top unanswered queries</CardTitle>
          </CardHeader>
          <CardContent>
            {topUnansweredQueries.length === 0 ? (
              <p className="text-sm text-slate-400">No refused queries yet.</p>
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Query</TH>
                    <TH>Times asked</TH>
                  </TR>
                </THead>
                <TBody>
                  {visibleUnanswered.map((row, i) => (
                    <TR key={i}>
                      <TD className="max-w-xs truncate text-slate-700">{row.query}</TD>
                      <TD>
                        <Badge variant={row.occurrences >= 5 ? 'danger' : 'warning'}>
                          {row.occurrences}
                        </Badge>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}

            {topUnansweredQueries.length > OBSERVABILITY_PAGE_SIZE && (
              <div className="mt-3 flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  Page {safeUnansweredPage + 1} of {unansweredTotalPages}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={safeUnansweredPage === 0}
                    onClick={() => setUnansweredPage((value) => Math.max(0, value - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={safeUnansweredPage >= unansweredTotalPages - 1}
                    onClick={() =>
                      setUnansweredPage((value) => Math.min(unansweredTotalPages - 1, value + 1))
                    }
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Possible hallucinations</CardTitle>
          </CardHeader>
          <CardContent>
            {possibleHallucinations.length === 0 ? (
              <p className="text-sm text-slate-400">No low-confidence answers detected.</p>
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Query</TH>
                    <TH>Similarity</TH>
                    <TH>When</TH>
                  </TR>
                </THead>
                <TBody>
                  {visibleHallucinations.map((row, i) => (
                    <TR key={i}>
                      <TD className="max-w-[180px] truncate text-slate-700">{row.query}</TD>
                      <TD>
                        <Badge variant="warning">{row.maxSimilarity}</Badge>
                      </TD>
                      <TD className="text-xs text-slate-400">{row.askedAt}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}

            {possibleHallucinations.length > OBSERVABILITY_PAGE_SIZE && (
              <div className="mt-3 flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  Page {safeHallucinationPage + 1} of {hallucinationTotalPages}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={safeHallucinationPage === 0}
                    onClick={() => setHallucinationPage((value) => Math.max(0, value - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={safeHallucinationPage >= hallucinationTotalPages - 1}
                    onClick={() =>
                      setHallucinationPage((value) =>
                        Math.min(hallucinationTotalPages - 1, value + 1),
                      )
                    }
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Slow queries */}
      <Card>
        <CardHeader>
          <CardTitle>Slow queries (&gt; 8 s end-to-end)</CardTitle>
        </CardHeader>
        <CardContent>
          {slowQueries.length === 0 ? (
            <p className="text-sm text-slate-400">No slow queries recorded.</p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Query</TH>
                  <TH>Total (ms)</TH>
                  <TH>Generation (ms)</TH>
                  <TH>When</TH>
                </TR>
              </THead>
              <TBody>
                {slowQueries.map((row, i) => (
                  <TR key={i}>
                    <TD className="max-w-xs truncate text-slate-700">{row.query}</TD>
                    <TD>
                      <Badge variant={row.totalMs > 15000 ? 'danger' : 'warning'}>
                        {row.totalMs.toLocaleString()} ms
                      </Badge>
                    </TD>
                    <TD className="text-slate-600">{row.generationMs.toLocaleString()} ms</TD>
                    <TD className="text-xs text-slate-400">{row.askedAt}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
