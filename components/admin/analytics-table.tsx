'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { toCsv } from '@/lib/utils';

const PAGE_SIZE = 10;

export function AnalyticsTable({
  title,
  rows,
}: {
  title: string;
  rows: Array<Record<string, string | number>>;
}) {
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const columns = useMemo(() => Object.keys(rows[0] ?? {}), [rows]);

  const filteredRows = useMemo(() => {
    setPage(1);
    if (!filter) return rows;
    return rows.filter((row) =>
      Object.values(row).some((value) =>
        String(value).toLowerCase().includes(filter.toLowerCase()),
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, rows]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pageRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const exportCsv = () => {
    const blob = new Blob([toCsv(filteredRows)], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${title.toLowerCase().replaceAll(' ', '-')}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <CardTitle>{title}</CardTitle>
        <div className="flex gap-3">
          <input
            className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm"
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter rows"
            value={filter}
          />
          <Button onClick={exportCsv} type="button" variant="secondary">
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <THead>
            <TR>
              {columns.map((column) => (
                <TH key={column}>{column}</TH>
              ))}
            </TR>
          </THead>
          <TBody>
            {pageRows.map((row, rowIndex) => (
              <TR key={rowIndex}>
                {columns.map((column) => (
                  <TD key={column}>{String(row[column])}</TD>
                ))}
              </TR>
            ))}
          </TBody>
        </Table>

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
            <p className="text-xs text-slate-400">
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredRows.length)} of{' '}
              {filteredRows.length}
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
      </CardContent>
    </Card>
  );
}
