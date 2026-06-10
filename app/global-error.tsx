'use client';

import { useEffect } from 'react';

import { reportRuntimeError } from '@/components/layout/runtime-error-capture';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportRuntimeError({
      source: 'next-app',
      category: 'global-error-boundary',
      message: error.message || 'Unhandled global app error',
      stack: error.stack ?? null,
      metadata: {
        digest: error.digest ?? null,
      },
    });
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900">
        <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6">
          <div className="w-full rounded-3xl border border-rose-200 bg-white p-8 shadow-sm">
            <h1 className="text-2xl font-semibold">Application error</h1>
            <p className="mt-2 text-sm text-slate-600">
              This failure was captured for review in System Health. Retry once, then inspect the
              error log if it persists.
            </p>
            <button
              type="button"
              onClick={() => reset()}
              className="mt-6 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              Reload
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
