'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  LogIn,
  MessageSquare,
  PlayCircle,
  Radio,
  Search,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate } from '@/lib/utils';

const PAGE_SIZE = 5;

const ACTION_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; dot: string; category: string }
> = {
  login: { label: 'Signed in', icon: LogIn, dot: 'bg-brand-400', category: 'auth' },
  chatbot_message: {
    label: 'Asked the AI',
    icon: MessageSquare,
    dot: 'bg-accent-500',
    category: 'ai',
  },
  knowledge_gap: {
    label: 'AI could not answer query',
    icon: MessageSquare,
    dot: 'bg-rose-400',
    category: 'ai',
  },
  document_viewed: {
    label: 'Viewed a document',
    icon: FileText,
    dot: 'bg-slate-400',
    category: 'document',
  },
  quiz_started: { label: 'Started Quest', icon: PlayCircle, dot: 'bg-amber-400', category: 'quiz' },
  quiz_submitted: {
    label: 'Submitted Quest',
    icon: CheckCircle2,
    dot: 'bg-emerald-500',
    category: 'quiz',
  },
  admin_announcement_sent: {
    label: 'Sent admin announcement',
    icon: Radio,
    dot: 'bg-indigo-400',
    category: 'admin',
  },
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'quiz', label: 'Quest' },
  { key: 'document', label: 'Docs' },
  { key: 'ai', label: 'AI' },
  { key: 'auth', label: 'Auth' },
  { key: 'admin', label: 'Admin' },
  { key: 'other', label: 'Other' },
] as const;

function titleFromAction(action: string) {
  return action.replaceAll('_', ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

export function ActivityFeed({
  items,
}: {
  items: Array<{ id: string; action: string; created_at: string; userName?: string | null }>;
}) {
  const [activeFilter, setActiveFilter] = useState<(typeof FILTERS)[number]['key']>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const enriched = useMemo(() => {
    return items.map((item) => {
      const config = ACTION_CONFIG[item.action] ?? {
        label: titleFromAction(item.action),
        icon: Activity,
        dot: 'bg-slate-300',
        category: 'other',
      };
      return {
        ...item,
        config,
      };
    });
  }, [items]);

  const filteredItems = useMemo(() => {
    const base =
      activeFilter === 'all'
        ? enriched
        : enriched.filter((item) => item.config.category === activeFilter);

    const q = search.trim().toLowerCase();
    if (!q) return base;

    return base.filter(
      (item) =>
        (item.userName ?? '').toLowerCase().includes(q) ||
        item.config.label.toLowerCase().includes(q) ||
        item.action.toLowerCase().includes(q),
    );
  }, [activeFilter, enriched, search]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const pageItems = filteredItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const groupedItems = useMemo(() => {
    const map = new Map<string, typeof pageItems>();

    pageItems.forEach((item) => {
      const groupLabel = new Date(item.created_at).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
      const existing = map.get(groupLabel) ?? [];
      existing.push(item);
      map.set(groupLabel, existing);
    });

    return [...map.entries()];
  }, [pageItems]);

  const uniqueUsers = useMemo(() => {
    return new Set(items.map((item) => item.userName).filter(Boolean)).size;
  }, [items]);

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-slate-400" />
            <CardTitle>Recent activity monitor</CardTitle>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info">{items.length} events</Badge>
            <Badge variant="neutral">{uniqueUsers} active users</Badge>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((filter) => {
            const active = activeFilter === filter.key;
            return (
              <button
                key={filter.key}
                type="button"
                onClick={() => {
                  setActiveFilter(filter.key);
                  setPage(1);
                }}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? 'bg-brand-700 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {filter.label}
              </button>
            );
          })}
          <div className="relative ml-auto w-full sm:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              className="h-9 w-full rounded-xl border border-slate-200 bg-white pr-3 pl-8 text-sm"
              placeholder="Search by member name or action"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredItems.length ? (
          <div className="space-y-4">
            {groupedItems.map(([groupLabel, groupItems]) => (
              <div key={groupLabel} className="space-y-1.5">
                <p className="px-3 text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">
                  {groupLabel}
                </p>
                {groupItems.map((item) => {
                  const Icon = item.config.icon;
                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-slate-50"
                    >
                      <div className={`h-2 w-2 shrink-0 rounded-full ${item.config.dot}`} />
                      <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <div className="flex min-w-0 flex-1 items-baseline gap-2 overflow-hidden">
                        <p className="shrink-0 text-sm font-medium text-slate-800">
                          {item.config.label}
                        </p>
                        {item.userName && (
                          <p className="truncate text-sm text-slate-500">· {item.userName}</p>
                        )}
                      </div>
                      <p className="shrink-0 text-xs text-slate-400">
                        {formatDate(item.created_at, true)}
                      </p>
                    </div>
                  );
                })}
              </div>
            ))}

            {totalPages > 1 && (
              <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-3">
                <p className="text-xs text-slate-400">
                  {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredItems.length)} of{' '}
                  {filteredItems.length}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    type="button"
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
                    type="button"
                    variant="secondary"
                    disabled={page === totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
            No activity in this category yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
