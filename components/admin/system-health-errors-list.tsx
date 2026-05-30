'use client';

import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SystemErrorEvent } from '@/lib/data';
import { formatDate } from '@/lib/utils';

const ITEMS_PER_PAGE = 15;

export function SystemHealthErrorsList({ errors: allErrors }: { errors: SystemErrorEvent[] }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);

  // Extract unique sources and categories for filtering
  const uniqueSources = useMemo(() => [...new Set(allErrors.map((e) => e.source))], [allErrors]);
  const uniqueCategories = useMemo(
    () => [...new Set(allErrors.map((e) => e.category))],
    [allErrors],
  );

  // Apply filters
  const filteredErrors = useMemo(() => {
    return allErrors.filter((error) => {
      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          error.message.toLowerCase().includes(q) ||
          error.category.toLowerCase().includes(q) ||
          error.source.toLowerCase().includes(q) ||
          (error.stack?.toLowerCase().includes(q) ?? false);
        if (!matches) return false;
      }

      // Source filter
      if (selectedSource && error.source !== selectedSource) return false;

      // Category filter
      if (selectedCategory && error.category !== selectedCategory) return false;

      // Date range filter
      const errorDate = new Date(error.createdAt);
      if (dateFrom) {
        const fromDate = new Date(dateFrom);
        if (errorDate < fromDate) return false;
      }
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (errorDate > toDate) return false;
      }

      return true;
    });
  }, [allErrors, searchQuery, selectedSource, selectedCategory, dateFrom, dateTo]);

  // Pagination
  const totalPages = Math.ceil(filteredErrors.length / ITEMS_PER_PAGE);
  const validPage = Math.min(currentPage, Math.max(1, totalPages));
  const paginatedErrors = filteredErrors.slice(
    (validPage - 1) * ITEMS_PER_PAGE,
    validPage * ITEMS_PER_PAGE,
  );

  const handleReset = () => {
    setSearchQuery('');
    setSelectedSource(null);
    setSelectedCategory(null);
    setDateFrom('');
    setDateTo('');
    setCurrentPage(1);
  };

  const hasActiveFilters = searchQuery || selectedSource || selectedCategory || dateFrom || dateTo;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Filters
            {hasActiveFilters && (
              <button
                onClick={handleReset}
                className="text-xs font-medium text-slate-500 transition hover:text-slate-900"
              >
                Clear all
              </button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by message, category, source, or stack trace..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pr-3 pl-9 text-sm text-slate-900 placeholder-slate-400 transition focus:border-slate-900 focus:outline-none"
            />
          </div>

          {/* Filters Grid */}
          <div className="grid gap-3 md:grid-cols-5">
            {/* Source Filter */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase">Source</label>
              <select
                value={selectedSource ?? ''}
                onChange={(e) => {
                  setSelectedSource(e.target.value || null);
                  setCurrentPage(1);
                }}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 transition focus:border-slate-900 focus:outline-none"
              >
                <option value="">All sources</option>
                {uniqueSources.map((source) => (
                  <option key={source} value={source}>
                    {source}
                  </option>
                ))}
              </select>
            </div>

            {/* Category Filter */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase">
                Category
              </label>
              <select
                value={selectedCategory ?? ''}
                onChange={(e) => {
                  setSelectedCategory(e.target.value || null);
                  setCurrentPage(1);
                }}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 transition focus:border-slate-900 focus:outline-none"
              >
                <option value="">All categories</option>
                {uniqueCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            {/* Date From */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase">
                From Date
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setCurrentPage(1);
                }}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 transition focus:border-slate-900 focus:outline-none"
              />
            </div>

            {/* Date To */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase">
                To Date
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setCurrentPage(1);
                }}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 transition focus:border-slate-900 focus:outline-none"
              />
            </div>

            {/* Results Count */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase">
                Results
              </label>
              <div className="mt-1 flex h-9 items-center rounded-lg border border-slate-200 bg-slate-50 px-3">
                <span className="text-sm font-medium text-slate-900">{filteredErrors.length}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Events List */}
      <Card>
        <CardHeader>
          <CardTitle>
            Error Events{' '}
            {filteredErrors.length > 0 && (
              <span className="text-sm font-normal text-slate-500">
                ({filteredErrors.length} total)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {filteredErrors.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center">
              <p className="text-sm text-slate-600">
                {hasActiveFilters ? 'No errors match your filters.' : 'No recent errors captured.'}
              </p>
            </div>
          ) : (
            <>
              {paginatedErrors.map((error) => (
                <div key={error.id} className="rounded-xl border border-slate-200 p-4">
                  {/* Header with badges and timestamp */}
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="danger" className="px-2 py-0.5 text-[11px]">
                        {error.source}
                      </Badge>
                      <Badge variant="warning" className="px-2 py-0.5 text-[11px]">
                        {error.category}
                      </Badge>
                    </div>
                    <span className="text-xs font-medium text-slate-500">
                      {formatDate(error.createdAt, true)}
                    </span>
                  </div>

                  {/* Error message */}
                  <div className="mt-3">
                    <p className="font-mono text-sm text-slate-900">{error.message}</p>
                  </div>

                  {/* Stack trace expandable */}
                  {error.stack && (
                    <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50">
                      <summary className="flex cursor-pointer items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                        <span>↳ Stack Trace</span>
                      </summary>
                      <pre className="overflow-x-auto border-t border-slate-200 px-4 py-3 font-mono text-[11px] text-slate-700">
                        {error.stack}
                      </pre>
                    </details>
                  )}

                  {/* Metadata expandable */}
                  {error.metadata &&
                    Object.keys(error.metadata as Record<string, unknown>).length > 0 && (
                      <details className="mt-2 rounded-lg border border-slate-200 bg-slate-50">
                        <summary className="flex cursor-pointer items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                          <span>↳ Metadata</span>
                        </summary>
                        <pre className="overflow-x-auto border-t border-slate-200 px-4 py-3 font-mono text-[11px] text-slate-700">
                          {JSON.stringify(error.metadata, null, 2)}
                        </pre>
                      </details>
                    )}
                </div>
              ))}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4">
                  <p className="text-xs text-slate-600">
                    Page {validPage} of {totalPages} • Showing{' '}
                    {Math.min(ITEMS_PER_PAGE, paginatedErrors.length)} of {filteredErrors.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, validPage - 1))}
                      disabled={validPage === 1}
                      className="rounded-lg border border-slate-200 bg-white p-2 text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                      title="Previous page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }).map((_, i) => {
                        const page = i + 1;
                        const isActive = page === validPage;
                        const isVisible =
                          Math.abs(page - validPage) <= 1 || page === 1 || page === totalPages;

                        if (!isVisible && Math.abs(page - validPage) === 2) {
                          return (
                            <span key={`ellipsis-${page}`} className="text-slate-400">
                              …
                            </span>
                          );
                        }

                        if (!isVisible) return null;

                        return (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                              isActive
                                ? 'bg-slate-900 text-white'
                                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            {page}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, validPage + 1))}
                      disabled={validPage === totalPages}
                      className="rounded-lg border border-slate-200 bg-white p-2 text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                      title="Next page"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
