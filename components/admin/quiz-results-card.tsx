'use client';

import { useState, useTransition } from 'react';
import {
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsUpDown,
  Download,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const PAGE_SIZE = 5;
const MAX_RESETS = 5;

type SortKey = 'member' | 'score' | 'percentage' | 'setTaken' | 'submittedAt';
type SortDir = 'asc' | 'desc';

export interface QuizResultRow {
  attemptId: string;
  userId: string;
  attemptType?: 'latest' | 'previous';
  member: string;
  email: string;
  score: string;
  percentage: string;
  setTaken: string;
  submittedAt: string;
  submittedAtRaw?: string | null;
  resetCount: number;
  sectionScores?: Record<string, { score: number; total: number }>;
}

interface QuizResultsCardProps {
  projectId: string;
  adminId?: string;
  rows: QuizResultRow[];
  resetAction: (formData: FormData) => Promise<void>;
}

function exportToCsv(rows: QuizResultRow[]) {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;

  // Collect all unique section names across all rows
  const sectionNames: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    for (const sec of Object.keys(row.sectionScores ?? {})) {
      if (!seen.has(sec)) {
        seen.add(sec);
        sectionNames.push(sec);
      }
    }
  }

  const headers = [
    'Member',
    'Email',
    'Score',
    'Percentage',
    'Set Taken',
    'Submitted At',
    'Reset Count',
    ...sectionNames.map((s) => `${s.charAt(0).toUpperCase() + s.slice(1)} Score`),
  ];

  const csvRows = rows.map((row) => {
    const base = [
      esc(row.member),
      esc(row.email),
      esc(row.score),
      esc(row.percentage),
      esc(row.setTaken),
      esc(row.submittedAt),
      String(row.resetCount),
    ];
    for (const sec of sectionNames) {
      const s = row.sectionScores?.[sec];
      base.push(s ? esc(`${s.score}/${s.total}`) : '""');
    }
    return base.join(',');
  });

  const csv = [headers.map(esc).join(','), ...csvRows].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `quiz-results-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown className="ml-1 inline h-3 w-3 text-slate-300" />;
  return sortDir === 'asc' ? (
    <ChevronUp className="text-brand-600 ml-1 inline h-3 w-3" />
  ) : (
    <ChevronDown className="text-brand-600 ml-1 inline h-3 w-3" />
  );
}

export function QuizResultsCard({ projectId, adminId, rows, resetAction }: QuizResultsCardProps) {
  const [filter, setFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('submittedAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);
  const [pendingReset, setPendingReset] = useState<QuizResultRow | null>(null);
  const [reason, setReason] = useState('');
  const [sectionsToReset, setSectionsToReset] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  function toggleSort(col: SortKey) {
    if (col === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(col);
      setSortDir('asc');
    }
    setPage(1);
  }

  const filtered = filter
    ? rows.filter((r) =>
        [
          r.member,
          r.email,
          r.score,
          r.percentage,
          r.setTaken,
          r.submittedAt,
          r.attemptType ?? 'latest',
        ].some((v) => v.toLowerCase().includes(filter.toLowerCase())),
      )
    : rows;

  const sorted = [...filtered].sort((a, b) => {
    if (sortKey === 'submittedAt') {
      const aTs = new Date(a.submittedAtRaw ?? 0).getTime();
      const bTs = new Date(b.submittedAtRaw ?? 0).getTime();
      return sortDir === 'asc' ? aTs - bTs : bTs - aTs;
    }
    let va = a[sortKey];
    let vb = b[sortKey];
    if (sortKey === 'percentage') {
      va = String(parseFloat(va));
      vb = String(parseFloat(vb));
      return sortDir === 'asc' ? parseFloat(va) - parseFloat(vb) : parseFloat(vb) - parseFloat(va);
    }
    return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function openResetModal(row: QuizResultRow) {
    setReason('');
    // Pre-select all sections for reset by default
    const allSections = Object.keys(row.sectionScores ?? {});
    setSectionsToReset(new Set(allSections));
    setPendingReset(row);
  }

  function closeModal() {
    setPendingReset(null);
    setReason('');
    setSectionsToReset(new Set());
  }

  function toggleSection(section: string) {
    setSectionsToReset((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  }

  function handleResetSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!pendingReset) return;
    const fd = new FormData(e.currentTarget);

    // Only send sections_to_reset for partial resets (some but not all sections selected)
    const allSections = Object.keys(pendingReset.sectionScores ?? {});
    const isPartial = allSections.length > 1 && sectionsToReset.size < allSections.length;
    if (isPartial) {
      fd.set('sections_to_reset', JSON.stringify([...sectionsToReset]));
    }

    startTransition(async () => {
      await resetAction(fd);
      closeModal();
    });
  }

  const thCls =
    'pb-3 pr-6 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 cursor-pointer select-none hover:text-slate-800 whitespace-nowrap';

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-slate-400" />
            <CardTitle>Quiz results</CardTitle>
            {rows.length > 0 && (
              <span className="bg-brand-50 text-brand-700 rounded-full px-2.5 py-0.5 text-xs font-semibold">
                {rows.length} records
              </span>
            )}
          </div>
          {rows.length > 0 && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button
                size="sm"
                type="button"
                variant="secondary"
                onClick={() => exportToCsv(rows)}
                className="flex items-center gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </Button>
              <div className="relative w-full sm:w-64">
                <Search className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  className="h-9 w-full rounded-xl border border-slate-200 bg-white pr-4 pl-8 text-sm"
                  onChange={(e) => {
                    setFilter(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Filter by name or set…"
                  value={filter}
                />
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 px-6 py-10 text-center">
              <BookOpen className="mx-auto h-7 w-7 text-slate-300" />
              <p className="mt-3 text-sm text-slate-400">No quiz submissions yet.</p>
              <p className="mt-1 text-xs text-slate-400">
                Results will appear here once members complete their quiz.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className={thCls} onClick={() => toggleSort('member')}>
                        Member <SortIcon col="member" sortKey={sortKey} sortDir={sortDir} />
                      </th>
                      <th className="pr-6 pb-3 text-left text-xs font-semibold tracking-wider text-slate-500 uppercase">
                        Attempt
                      </th>
                      <th className={thCls} onClick={() => toggleSort('score')}>
                        Score <SortIcon col="score" sortKey={sortKey} sortDir={sortDir} />
                      </th>
                      <th className={thCls} onClick={() => toggleSort('percentage')}>
                        % <SortIcon col="percentage" sortKey={sortKey} sortDir={sortDir} />
                      </th>
                      <th className={thCls} onClick={() => toggleSort('setTaken')}>
                        Set taken <SortIcon col="setTaken" sortKey={sortKey} sortDir={sortDir} />
                      </th>
                      <th className={thCls} onClick={() => toggleSort('submittedAt')}>
                        Submitted <SortIcon col="submittedAt" sortKey={sortKey} sortDir={sortDir} />
                      </th>
                      <th className="pb-3 text-left text-xs font-semibold tracking-wider text-slate-500 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {paginated.map((row) => {
                      const atLimit = row.resetCount >= MAX_RESETS;
                      const isPrevious = row.attemptType === 'previous';
                      return (
                        <tr key={row.attemptId}>
                          <td className="py-3 pr-6">
                            <p className="font-medium text-slate-900">{row.member}</p>
                            <p className="text-xs text-slate-400">{row.email}</p>
                          </td>
                          <td className="py-3 pr-6">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                isPrevious
                                  ? 'bg-slate-100 text-slate-600'
                                  : 'bg-blue-50 text-blue-700'
                              }`}
                            >
                              {isPrevious ? 'Previous' : 'Latest'}
                            </span>
                          </td>
                          <td className="py-3 pr-6">
                            <p className="font-semibold text-slate-900">{row.score}</p>
                            {row.sectionScores && Object.keys(row.sectionScores).length > 1 && (
                              <div className="mt-0.5 space-y-0.5">
                                {Object.entries(row.sectionScores).map(([sec, s]) => (
                                  <p key={sec} className="text-xs text-slate-400">
                                    {sec.charAt(0).toUpperCase() + sec.slice(1)}: {s.score}/
                                    {s.total}
                                  </p>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="py-3 pr-6">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                parseFloat(row.percentage) >= 70
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : parseFloat(row.percentage) >= 50
                                    ? 'bg-amber-50 text-amber-700'
                                    : 'bg-rose-50 text-rose-700'
                              }`}
                            >
                              {row.percentage}
                            </span>
                          </td>
                          <td className="py-3 pr-6 text-slate-600">{row.setTaken}</td>
                          <td className="py-3 pr-6 text-slate-400">{row.submittedAt}</td>
                          <td className="py-3">
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                type="button"
                                variant="secondary"
                                disabled={isPrevious || atLimit}
                                title={
                                  isPrevious
                                    ? 'Previous attempts are read-only records'
                                    : atLimit
                                      ? `Reset limit reached (${MAX_RESETS} resets used)`
                                      : undefined
                                }
                                onClick={() => openResetModal(row)}
                                className="flex items-center gap-1.5"
                              >
                                <RotateCcw className="h-3 w-3" />
                                Reset
                              </Button>
                              {row.resetCount > 0 && (
                                <span
                                  className={`text-xs ${atLimit ? 'font-semibold text-rose-500' : 'text-slate-400'}`}
                                >
                                  {row.resetCount}/{MAX_RESETS}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {paginated.length === 0 && (
                  <p className="py-6 text-center text-sm text-slate-400">
                    No results match your filter.
                  </p>
                )}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                  <p className="text-xs text-slate-400">
                    {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, sorted.length)} of{' '}
                    {sorted.length}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={page === 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <span className="px-2 text-xs text-slate-600">
                      {page} / {totalPages}
                    </span>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={page === totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Reset reason modal */}
      {pendingReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <p className="font-semibold text-slate-900">Reset quiz for {pendingReset.member}</p>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-700">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleResetSubmit} className="space-y-4 p-5">
              <input type="hidden" name="attempt_id" value={pendingReset.attemptId} />
              <input type="hidden" name="project_id" value={projectId} />
              <input type="hidden" name="user_id" value={pendingReset.userId} />
              {adminId && <input type="hidden" name="reset_by" value={adminId} />}

              {/* Section selection for partial retake — only shown when there are multiple sections */}
              {pendingReset.sectionScores && Object.keys(pendingReset.sectionScores).length > 1 && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Sections to reset
                    <span className="ml-1 text-xs font-normal text-slate-400">
                      (uncheck to carry score forward)
                    </span>
                  </label>
                  <div className="space-y-2">
                    {Object.entries(pendingReset.sectionScores).map(([sec, s]) => (
                      <label key={sec} className="flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          className="rounded border-slate-300"
                          checked={sectionsToReset.has(sec)}
                          onChange={() => toggleSection(sec)}
                        />
                        <span className="text-sm text-slate-700">
                          {sec.charAt(0).toUpperCase() + sec.slice(1)}
                          <span className="ml-1 text-xs text-slate-400">
                            ({s.score}/{s.total})
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                  {sectionsToReset.size === 0 && (
                    <p className="mt-2 text-xs text-amber-600">
                      Select at least one section to reset.
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Reason for reset <span className="text-rose-500">*</span>
                </label>
                <textarea
                  name="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                  rows={3}
                  placeholder="e.g. Technical issue during submission, admin approved retry…"
                  className="focus:ring-brand-300 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={closeModal} disabled={isPending}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isPending || !reason.trim() || sectionsToReset.size === 0}
                >
                  {isPending ? 'Resetting…' : 'Confirm reset'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
