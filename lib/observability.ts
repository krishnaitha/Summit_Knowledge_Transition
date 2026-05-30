import 'server-only';

import sql from '@/lib/db';
import type { Json } from '@/lib/types/database';

export interface ApplicationErrorInput {
  source: string;
  category: string;
  message: string;
  stack?: string | null;
  metadata?: Record<string, Json> | null;
}

function trimText(value: string | null | undefined, maxLength: number): string | null {
  if (!value) {
    return null;
  }

  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}...`;
}

export async function logApplicationError(event: ApplicationErrorInput): Promise<void> {
  try {
    const metadataJson = event.metadata
      ? (event.metadata as unknown as Parameters<typeof sql.json>[0])
      : null;

    await sql`
      INSERT INTO app_error_events (source, category, message, stack, metadata)
      VALUES (
        ${trimText(event.source, 120) ?? 'unknown'},
        ${trimText(event.category, 180) ?? 'unknown'},
        ${trimText(event.message, 4000) ?? 'Unknown error'},
        ${trimText(event.stack ?? null, 16000)},
        ${metadataJson ? sql.json(metadataJson) : null}
      )
    `;
  } catch {
    // Error logging must not break request or worker flows.
  }
}
