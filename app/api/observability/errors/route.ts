import { NextResponse } from 'next/server';

import { logApplicationError } from '@/lib/observability';
import type { Json } from '@/lib/types/database';

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function sanitizeMetadata(value: unknown): Record<string, Json> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const metadata: Record<string, Json> = {};

  for (const [key, item] of Object.entries(value)) {
    if (
      item === null ||
      typeof item === 'string' ||
      typeof item === 'number' ||
      typeof item === 'boolean'
    ) {
      metadata[key] = item;
    }
  }

  return Object.keys(metadata).length > 0 ? metadata : null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;

    await logApplicationError({
      source: asString(body.source, 'client'),
      category: asString(body.category, 'runtime'),
      message: asString(body.message, 'Unknown client error'),
      stack: asString(body.stack, '') || null,
      metadata: sanitizeMetadata(body.metadata),
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
