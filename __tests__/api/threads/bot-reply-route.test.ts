import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { UserProfile } from '@/lib/types/database';

const { mockSql } = vi.hoisted(() => {
  type SqlMock = ReturnType<typeof vi.fn> & { json: ReturnType<typeof vi.fn> };
  const fn = vi.fn() as SqlMock;
  fn.json = vi.fn((v: unknown) => v);
  return { mockSql: fn };
});

vi.mock('@/lib/db', () => ({ default: mockSql }));
vi.mock('@/lib/auth', () => ({ getCurrentUserContext: vi.fn() }));
vi.mock('@/lib/data', () => ({ userHasProjectAccess: vi.fn() }));
vi.mock('@/lib/documents/bot-reply', () => ({ processBotThreadReply: vi.fn() }));
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((data: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => data,
    })),
  },
}));

import { GET } from '@/app/api/threads/[threadId]/bot-reply/route';
import { getCurrentUserContext } from '@/lib/auth';
import { userHasProjectAccess } from '@/lib/data';
import { processBotThreadReply } from '@/lib/documents/bot-reply';

type MockResponse = { status: number; json: () => Promise<unknown> };

const THREAD_ID = 'thread-aaa-111';
const PROJECT_ID = 'proj-bbb-222';

const OPEN_THREAD = {
  project_id: PROJECT_ID,
  document_id: 'doc-ccc-333',
  title: 'How does the auth flow work?',
  status: 'open',
};

const BOT_REPLY_ROW = { body: 'Auth uses JWT tokens.', created_at: '2026-01-01T10:00:00Z' };

const STALE_JOB = {
  id: 'job-stale-001',
  created_at: new Date(Date.now() - 60_000).toISOString(),
  job_query: 'How does the auth flow work?',
};

const FRESH_JOB = {
  id: 'job-fresh-001',
  created_at: new Date(Date.now() - 5_000).toISOString(),
  job_query: 'How does the auth flow work?',
};

const mockRequest = new Request(`http://localhost/api/threads/${THREAD_ID}/bot-reply`);

function makeParams(threadId = THREAD_ID) {
  return { params: Promise.resolve({ threadId }) };
}

const MOCK_PROFILE: UserProfile = {
  id: 'user-111',
  email: 'test@example.com',
  full_name: null,
  role: 'member',
  created_at: '2026-01-01T00:00:00Z',
  last_login_at: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockSql.mockResolvedValue([]);
  vi.mocked(getCurrentUserContext).mockResolvedValue({
    user: { email: MOCK_PROFILE.email },
    userId: MOCK_PROFILE.id,
    profile: MOCK_PROFILE,
  });
  vi.mocked(userHasProjectAccess).mockResolvedValue(true);
});

describe('GET /bot-reply – auth and access guards', () => {
  it('returns 401 when the user is not authenticated', async () => {
    vi.mocked(getCurrentUserContext).mockResolvedValue({ user: null, userId: null, profile: null });

    const res = (await GET(mockRequest, makeParams())) as unknown as MockResponse;

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Unauthorized' });
  });

  it('returns 404 when the thread does not exist', async () => {
    mockSql.mockResolvedValueOnce([]); // thread query returns no rows

    const res = (await GET(mockRequest, makeParams())) as unknown as MockResponse;

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Not found' });
  });

  it('returns 403 when the user does not have project access', async () => {
    mockSql.mockResolvedValueOnce([OPEN_THREAD]);
    vi.mocked(userHasProjectAccess).mockResolvedValue(false);

    const res = (await GET(mockRequest, makeParams())) as unknown as MockResponse;

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Forbidden' });
  });
});

describe('GET /bot-reply – existing bot reply', () => {
  it('returns the bot reply immediately when one already exists', async () => {
    mockSql.mockResolvedValueOnce([OPEN_THREAD]);
    mockSql.mockResolvedValueOnce([BOT_REPLY_ROW]);

    const res = (await GET(mockRequest, makeParams())) as unknown as MockResponse;

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reply: BOT_REPLY_ROW });
    expect(mockSql).toHaveBeenCalledTimes(2);
  });
});

describe('GET /bot-reply – non-open thread', () => {
  it('returns { reply: null } without enqueuing a job when thread is not open', async () => {
    mockSql.mockResolvedValueOnce([{ ...OPEN_THREAD, status: 'resolved' }]);

    const res = (await GET(mockRequest, makeParams())) as unknown as MockResponse;

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reply: null });
    expect(mockSql).toHaveBeenCalledTimes(2);
  });
});

describe('GET /bot-reply – no job queued', () => {
  it('enqueues a bot_thread_reply job and returns { reply: null }', async () => {
    mockSql.mockResolvedValueOnce([OPEN_THREAD]);

    const res = (await GET(mockRequest, makeParams())) as unknown as MockResponse;

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reply: null });
    expect(mockSql).toHaveBeenCalledTimes(5);
  });
});

describe('GET /bot-reply – job exists and is fresh', () => {
  it('returns { reply: null } without triggering inline fallback when job is under 30s old', async () => {
    mockSql.mockResolvedValueOnce([OPEN_THREAD]);
    mockSql.mockResolvedValueOnce([]);
    mockSql.mockResolvedValueOnce([FRESH_JOB]);

    const res = (await GET(mockRequest, makeParams())) as unknown as MockResponse;

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reply: null });
    expect(mockSql).toHaveBeenCalledTimes(3);
    expect(vi.mocked(processBotThreadReply)).not.toHaveBeenCalled();
  });
});

describe('GET /bot-reply – stale job inline fallback', () => {
  it('processes the reply inline and returns it when the stale job is successfully claimed', async () => {
    vi.mocked(processBotThreadReply).mockResolvedValue({ threadId: THREAD_ID, chunkCount: 3 });

    mockSql.mockResolvedValueOnce([OPEN_THREAD]);
    mockSql.mockResolvedValueOnce([]);
    mockSql.mockResolvedValueOnce([STALE_JOB]);
    mockSql.mockResolvedValueOnce([{ id: STALE_JOB.id }]);
    mockSql.mockResolvedValueOnce([]);
    mockSql.mockResolvedValueOnce([BOT_REPLY_ROW]);

    const res = (await GET(mockRequest, makeParams())) as unknown as MockResponse;

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reply: BOT_REPLY_ROW });
    expect(vi.mocked(processBotThreadReply)).toHaveBeenCalledOnce();
    expect(vi.mocked(processBotThreadReply)).toHaveBeenCalledWith({
      threadId: THREAD_ID,
      projectId: PROJECT_ID,
      documentId: OPEN_THREAD.document_id,
      query: STALE_JOB.job_query,
    });
  });

  it('returns { reply: null } when the atomic claim fails (concurrent request race)', async () => {
    mockSql.mockResolvedValueOnce([OPEN_THREAD]);
    mockSql.mockResolvedValueOnce([]);
    mockSql.mockResolvedValueOnce([STALE_JOB]);
    mockSql.mockResolvedValueOnce([]);

    const res = (await GET(mockRequest, makeParams())) as unknown as MockResponse;

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reply: null });
    expect(vi.mocked(processBotThreadReply)).not.toHaveBeenCalled();
  });

  it('returns { reply: null } when the job is running and cannot be claimed', async () => {
    const runningJob = { ...STALE_JOB, id: 'job-running-001' };
    mockSql.mockResolvedValueOnce([OPEN_THREAD]);
    mockSql.mockResolvedValueOnce([]);
    mockSql.mockResolvedValueOnce([runningJob]);
    mockSql.mockResolvedValueOnce([]);

    const res = (await GET(mockRequest, makeParams())) as unknown as MockResponse;

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reply: null });
    expect(vi.mocked(processBotThreadReply)).not.toHaveBeenCalled();
  });

  it('marks the job as failed and returns { reply: null } when processBotThreadReply throws', async () => {
    vi.mocked(processBotThreadReply).mockRejectedValue(new Error('LLM unavailable'));

    mockSql.mockResolvedValueOnce([OPEN_THREAD]);
    mockSql.mockResolvedValueOnce([]);
    mockSql.mockResolvedValueOnce([STALE_JOB]);
    mockSql.mockResolvedValueOnce([{ id: STALE_JOB.id }]);
    mockSql.mockResolvedValueOnce([]);

    const res = (await GET(mockRequest, makeParams())) as unknown as MockResponse;

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reply: null });
    expect(mockSql).toHaveBeenCalledTimes(5);
  });
});
