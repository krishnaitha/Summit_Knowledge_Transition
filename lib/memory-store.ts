import 'server-only';

import sql from '@/lib/db';
import type { ParsedMemoryIntent } from '@/lib/memory';
import type { UserMemoryPendingRecord, UserMemoryRecord } from '@/lib/types/database';

export async function ensureUserMemorySchema() {
  await sql`
    create table if not exists user_memories (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references users(id) on delete cascade,
      project_id uuid references projects(id) on delete set null,
      memory_key text not null,
      memory_value text not null,
      tags text[] not null default '{}',
      confidence numeric(4,2) not null default 0.80,
      source text not null default 'explicit' check (source in ('explicit', 'manual')),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      last_used_at timestamptz,
      unique(user_id, memory_key)
    )
  `;

  await sql`
    create table if not exists user_memory_pending_confirmations (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references users(id) on delete cascade,
      session_id uuid not null references chat_sessions(id) on delete cascade,
      project_id uuid references projects(id) on delete cascade,
      memory_key text not null,
      memory_value text not null,
      tags text[] not null default '{}',
      is_sensitive boolean not null default false,
      allows_sensitive_storage boolean not null default false,
      expires_at timestamptz not null default (now() + interval '10 minutes'),
      created_at timestamptz not null default now(),
      unique(user_id, session_id)
    )
  `;
}

export async function createPendingMemoryConfirmation(
  userId: string,
  sessionId: string,
  projectId: string,
  intent: ParsedMemoryIntent,
) {
  await sql`
    insert into user_memory_pending_confirmations (
      user_id,
      session_id,
      project_id,
      memory_key,
      memory_value,
      tags,
      is_sensitive,
      allows_sensitive_storage,
      expires_at
    )
    values (
      ${userId},
      ${sessionId},
      ${projectId},
      ${intent.key},
      ${intent.value},
      ${intent.tags},
      ${intent.isSensitive},
      ${intent.allowsSensitiveStorage},
      now() + interval '10 minutes'
    )
    on conflict (user_id, session_id) do update
      set memory_key = excluded.memory_key,
          memory_value = excluded.memory_value,
          tags = excluded.tags,
          is_sensitive = excluded.is_sensitive,
          allows_sensitive_storage = excluded.allows_sensitive_storage,
          expires_at = now() + interval '10 minutes',
          created_at = now()
  `;
}

export async function getPendingMemoryConfirmation(
  userId: string,
  sessionId: string,
): Promise<UserMemoryPendingRecord | null> {
  const rows = await sql<UserMemoryPendingRecord[]>`
    select *
    from user_memory_pending_confirmations
    where user_id = ${userId}
      and session_id = ${sessionId}
      and expires_at > now()
    order by created_at desc
    limit 1
  `;

  return rows[0] ?? null;
}

export async function clearPendingMemoryConfirmation(userId: string, sessionId: string) {
  await sql`
    delete from user_memory_pending_confirmations
    where user_id = ${userId} and session_id = ${sessionId}
  `;
}

export async function upsertUserMemory(args: {
  userId: string;
  projectId?: string | null;
  memoryKey: string;
  memoryValue: string;
  tags?: string[];
  confidence?: number;
  source?: 'explicit' | 'manual';
}) {
  const confidence = Number.isFinite(args.confidence ?? NaN)
    ? Math.min(1, Math.max(0, args.confidence ?? 0.8))
    : 0.8;

  const rows = await sql<UserMemoryRecord[]>`
    insert into user_memories (
      user_id,
      project_id,
      memory_key,
      memory_value,
      tags,
      confidence,
      source,
      updated_at
    )
    values (
      ${args.userId},
      ${args.projectId ?? null},
      ${args.memoryKey},
      ${args.memoryValue},
      ${args.tags ?? []},
      ${confidence},
      ${args.source ?? 'explicit'},
      now()
    )
    on conflict (user_id, memory_key) do update
      set memory_value = excluded.memory_value,
          tags = excluded.tags,
          confidence = excluded.confidence,
          source = excluded.source,
          updated_at = now()
    returning *
  `;

  return rows[0] ?? null;
}

export async function listUserMemories(
  userId: string,
  options?: {
    projectId?: string;
    limit?: number;
  },
): Promise<UserMemoryRecord[]> {
  const limit = Math.min(Math.max(options?.limit ?? 40, 1), 200);

  if (options?.projectId) {
    return sql<UserMemoryRecord[]>`
      select *
      from user_memories
      where user_id = ${userId}
        and (project_id = ${options.projectId} or project_id is null)
      order by updated_at desc
      limit ${limit}
    `;
  }

  return sql<UserMemoryRecord[]>`
    select *
    from user_memories
    where user_id = ${userId}
    order by updated_at desc
    limit ${limit}
  `;
}

export async function deleteUserMemory(userId: string, memoryId: string) {
  await sql`
    delete from user_memories
    where id = ${memoryId} and user_id = ${userId}
  `;
}

export async function touchUserMemories(memoryIds: string[]) {
  if (!memoryIds.length) return;

  await sql`
    update user_memories
    set last_used_at = now()
    where id = any(${memoryIds})
  `;
}
