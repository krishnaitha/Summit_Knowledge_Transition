import { clsx, type ClassValue } from 'clsx';
import { format } from 'date-fns';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(value?: string | Date | null, withTime = false) {
  if (!value) {
    return 'N/A';
  }

  const date = typeof value === 'string' ? new Date(value) : value;

  return format(date, withTime ? 'dd MMM yyyy, HH:mm' : 'dd MMM yyyy');
}

export function formatPercent(value?: number | null) {
  if (value == null || Number.isNaN(value)) {
    return '0%';
  }

  return `${Math.round(value)}%`;
}

export function safeJsonParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function toCsv<T extends Record<string, unknown>>(rows: T[]) {
  if (!rows.length) {
    return '';
  }

  const headers = Object.keys(rows[0]);
  const escape = (cell: unknown) => {
    const stringValue = String(cell ?? '');
    const escaped = stringValue.replaceAll('"', '""');
    return `"${escaped}"`;
  };

  return [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escape(row[header])).join(',')),
  ].join('\n');
}

export function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
