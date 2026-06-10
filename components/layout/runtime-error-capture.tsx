'use client';

import { useEffect } from 'react';

import type { Json } from '@/lib/types/database';

type RuntimeErrorPayload = {
  source: string;
  category: string;
  message: string;
  stack?: string | null;
  metadata?: Record<string, Json> | null;
};

const seenErrors = new Set<string>();

function makeSignature(payload: RuntimeErrorPayload) {
  return JSON.stringify({
    source: payload.source,
    category: payload.category,
    message: payload.message,
    stack: payload.stack ?? null,
    metadata: payload.metadata ?? null,
  });
}

export function reportRuntimeError(payload: RuntimeErrorPayload) {
  const signature = makeSignature(payload);
  if (seenErrors.has(signature)) {
    return;
  }

  seenErrors.add(signature);
  const body = JSON.stringify(payload);

  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    const blob = new Blob([body], { type: 'application/json' });
    navigator.sendBeacon('/api/observability/errors', blob);
    return;
  }

  void fetch('/api/observability/errors', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body,
    keepalive: true,
  }).catch(() => {
    // Ignore transport failures for telemetry.
  });
}

function normalizeUnknownError(reason: unknown) {
  if (reason instanceof Error) {
    return {
      message: reason.message,
      stack: reason.stack ?? null,
    };
  }

  if (typeof reason === 'string') {
    return {
      message: reason,
      stack: null,
    };
  }

  return {
    message: 'Unknown runtime error',
    stack: null,
  };
}

export function RuntimeErrorCapture() {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      reportRuntimeError({
        source: 'client',
        category: 'window.error',
        message: event.message || 'Unhandled client error',
        stack: event.error instanceof Error ? (event.error.stack ?? null) : null,
        metadata: {
          filename: event.filename || null,
          line: typeof event.lineno === 'number' ? event.lineno : null,
          column: typeof event.colno === 'number' ? event.colno : null,
        },
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const normalized = normalizeUnknownError(event.reason);
      reportRuntimeError({
        source: 'client',
        category: 'unhandledrejection',
        message: normalized.message,
        stack: normalized.stack,
      });
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return null;
}
