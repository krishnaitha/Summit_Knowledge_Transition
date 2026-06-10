'use client';

import { useEffect } from 'react';

import { reportRuntimeError } from '@/components/layout/runtime-error-capture';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportRuntimeError({
      source: 'next-app',
      category: 'route-error-boundary',
      message: error.message || 'Unhandled route error',
      stack: error.stack ?? null,
      metadata: {
        digest: error.digest ?? null,
      },
    });
  }, [error]);

  return (
    <div className="bg-slate-50 text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6">
        <div className="w-full rounded-3xl border border-rose-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold">Something went wrong</h1>
          <p className="mt-2 text-sm text-slate-600">
            The error has been captured in System Health. Retry the action, or inspect the error log
            if it continues.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            className="mt-6 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}
