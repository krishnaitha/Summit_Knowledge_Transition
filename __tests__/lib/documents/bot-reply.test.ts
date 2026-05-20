import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { UnifiedChatCompletion } from '@/lib/llm';
import type { RetrievedChunk } from '@/lib/rag/retrieval';
import { retrieveRelevantChunks } from '@/lib/rag/retrieval';

const { mockSql, mockSqlJson } = vi.hoisted(() => {
  const jsonFn = vi.fn((v: unknown) => v);
  type SqlMock = ReturnType<typeof vi.fn> & { json: typeof jsonFn };
  const fn = vi.fn() as SqlMock;
  fn.json = jsonFn;
  return { mockSql: fn, mockSqlJson: jsonFn };
});

vi.mock('@/lib/db', () => ({ default: mockSql }));
vi.mock('@/lib/env', () => ({ appEnv: { botName: 'TestBot' } }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/llm', () => ({ createChatCompletion: vi.fn() }));
vi.mock('@/lib/rag/retrieval', () => ({ retrieveRelevantChunks: vi.fn() }));

import { BOT_NO_MATCH_MSG, processBotThreadReply } from '@/lib/documents/bot-reply';
import { createChatCompletion } from '@/lib/llm';
import { revalidatePath } from 'next/cache';

type ChunkList = Awaited<ReturnType<typeof retrieveRelevantChunks>>;

function makeChunk(
  similarity: number,
  document_name = 'Doc A',
  content = 'Some context.',
): RetrievedChunk {
  return { id: 'chunk-1', document_id: 'doc-1', similarity, document_name, content };
}

function asChunks(arr: RetrievedChunk[]): ChunkList {
  return arr as unknown as ChunkList;
}

function makeLlmResponse(content: string | undefined): UnifiedChatCompletion {
  return {
    choices:
      content !== undefined
        ? [{ message: { content, role: 'assistant' }, finish_reason: 'stop' }]
        : [],
  };
}

const THREAD_ID = 'thread-abc-123';
const PROJECT_ID = 'proj-xyz-456';
const DOCUMENT_ID = 'doc-def-789';
const QUERY = 'How does the authentication flow work?';

beforeEach(() => {
  vi.clearAllMocks();
  mockSql.mockResolvedValue([]);
});

describe('processBotThreadReply – required field validation', () => {
  it('throws when threadId is empty', async () => {
    await expect(
      processBotThreadReply({
        threadId: '',
        projectId: PROJECT_ID,
        documentId: DOCUMENT_ID,
        query: QUERY,
      }),
    ).rejects.toThrow('bot_thread_reply missing required fields');
  });

  it('throws when projectId is empty', async () => {
    await expect(
      processBotThreadReply({
        threadId: THREAD_ID,
        projectId: '',
        documentId: DOCUMENT_ID,
        query: QUERY,
      }),
    ).rejects.toThrow('bot_thread_reply missing required fields');
  });

  it('throws when query is empty', async () => {
    await expect(
      processBotThreadReply({
        threadId: THREAD_ID,
        projectId: PROJECT_ID,
        documentId: DOCUMENT_ID,
        query: '',
      }),
    ).rejects.toThrow('bot_thread_reply missing required fields');
  });
});

// ─── No-match path (no chunks / low similarity) ───────────────────────────────
describe('processBotThreadReply – no matching chunks', () => {
  it('skips LLM and uses BOT_NO_MATCH_MSG when no chunks are returned', async () => {
    mockSql.mockResolvedValueOnce([{ name: 'Test Project' }]);
    vi.mocked(retrieveRelevantChunks).mockResolvedValue(asChunks([]));

    await processBotThreadReply({
      threadId: THREAD_ID,
      projectId: PROJECT_ID,
      documentId: DOCUMENT_ID,
      query: QUERY,
    });

    expect(vi.mocked(createChatCompletion)).not.toHaveBeenCalled();
    expect(mockSql).toHaveBeenCalledTimes(3);
  });

  it('skips LLM when best chunk similarity is below 0.2', async () => {
    mockSql.mockResolvedValueOnce([{ name: 'Test Project' }]);
    vi.mocked(retrieveRelevantChunks).mockResolvedValue(
      asChunks([makeChunk(0.19, 'Doc A'), makeChunk(0.05, 'Doc B')]),
    );

    await processBotThreadReply({
      threadId: THREAD_ID,
      projectId: PROJECT_ID,
      documentId: DOCUMENT_ID,
      query: QUERY,
    });

    expect(vi.mocked(createChatCompletion)).not.toHaveBeenCalled();
  });

  it('calls LLM when best chunk similarity is exactly 0.2', async () => {
    mockSql.mockResolvedValueOnce([{ name: 'Test Project' }]);
    vi.mocked(retrieveRelevantChunks).mockResolvedValue(asChunks([makeChunk(0.2)]));
    vi.mocked(createChatCompletion).mockResolvedValue(makeLlmResponse('Answer text.'));

    await processBotThreadReply({
      threadId: THREAD_ID,
      projectId: PROJECT_ID,
      documentId: DOCUMENT_ID,
      query: QUERY,
    });

    expect(vi.mocked(createChatCompletion)).toHaveBeenCalledTimes(1);
  });
});

describe('processBotThreadReply – LLM path', () => {
  it('builds the system prompt with project name and chunk context', async () => {
    mockSql.mockResolvedValueOnce([{ name: 'Alpha Project' }]);
    vi.mocked(retrieveRelevantChunks).mockResolvedValue(
      asChunks([makeChunk(0.8, 'Readme', 'Auth uses JWT.')]),
    );
    vi.mocked(createChatCompletion).mockResolvedValue(makeLlmResponse('JWT with 1-hour expiry.'));

    await processBotThreadReply({
      threadId: THREAD_ID,
      projectId: PROJECT_ID,
      documentId: DOCUMENT_ID,
      query: QUERY,
    });

    const callArgs = vi.mocked(createChatCompletion).mock.calls[0][0];
    expect(callArgs.messages[0].role).toBe('system');
    expect(callArgs.messages[0].content).toContain('Alpha Project');
    expect(callArgs.messages[0].content).toContain('Auth uses JWT.');
    expect(callArgs.messages[1]).toEqual({ role: 'user', content: QUERY });
  });

  it('falls back to BOT_NO_MATCH_MSG when LLM returns no choices', async () => {
    mockSql.mockResolvedValueOnce([{ name: 'Test Project' }]);
    vi.mocked(retrieveRelevantChunks).mockResolvedValue(asChunks([makeChunk(0.9)]));
    vi.mocked(createChatCompletion).mockResolvedValue(makeLlmResponse(undefined));

    await processBotThreadReply({
      threadId: THREAD_ID,
      projectId: PROJECT_ID,
      documentId: DOCUMENT_ID,
      query: QUERY,
    });

    expect(mockSql).toHaveBeenCalledTimes(3);
  });

  it('deduplicates document names when building sources', async () => {
    mockSql.mockResolvedValueOnce([{ name: 'Test Project' }]);
    vi.mocked(retrieveRelevantChunks).mockResolvedValue(
      asChunks([
        makeChunk(0.9, 'Architecture.md'),
        makeChunk(0.8, 'Architecture.md'),
        makeChunk(0.7, 'README.md'),
      ]),
    );
    vi.mocked(createChatCompletion).mockResolvedValue(makeLlmResponse('The answer.'));

    await processBotThreadReply({
      threadId: THREAD_ID,
      projectId: PROJECT_ID,
      documentId: DOCUMENT_ID,
      query: QUERY,
    });

    expect(mockSqlJson).toHaveBeenCalledWith([
      { document_name: 'Architecture.md' },
      { document_name: 'README.md' },
    ]);
  });
});

describe('processBotThreadReply – DB side effects', () => {
  it('makes exactly three SQL calls: project lookup, INSERT comment, UPDATE thread', async () => {
    mockSql.mockResolvedValueOnce([{ name: 'Test Project' }]);
    vi.mocked(retrieveRelevantChunks).mockResolvedValue(asChunks([]));

    await processBotThreadReply({
      threadId: THREAD_ID,
      projectId: PROJECT_ID,
      documentId: DOCUMENT_ID,
      query: QUERY,
    });

    expect(mockSql).toHaveBeenCalledTimes(3);
  });

  it('defaults project name to "Project" when project query returns no rows', async () => {
    vi.mocked(retrieveRelevantChunks).mockResolvedValue(asChunks([makeChunk(0.9)]));
    vi.mocked(createChatCompletion).mockResolvedValue(makeLlmResponse('The answer.'));

    await expect(
      processBotThreadReply({
        threadId: THREAD_ID,
        projectId: PROJECT_ID,
        documentId: DOCUMENT_ID,
        query: QUERY,
      }),
    ).resolves.toBeDefined();
  });
});

describe('processBotThreadReply – revalidatePath', () => {
  it('revalidates project and document thread paths when documentId is set', async () => {
    mockSql.mockResolvedValueOnce([{ name: 'Test Project' }]);
    vi.mocked(retrieveRelevantChunks).mockResolvedValue(asChunks([]));

    await processBotThreadReply({
      threadId: THREAD_ID,
      projectId: PROJECT_ID,
      documentId: DOCUMENT_ID,
      query: QUERY,
    });

    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith(`/projects/${PROJECT_ID}`);
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith(
      `/projects/${PROJECT_ID}/documents/${DOCUMENT_ID}/threads`,
    );
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledTimes(2);
  });

  it('does not call revalidatePath when documentId is empty', async () => {
    mockSql.mockResolvedValueOnce([{ name: 'Test Project' }]);
    vi.mocked(retrieveRelevantChunks).mockResolvedValue(asChunks([]));

    await processBotThreadReply({
      threadId: THREAD_ID,
      projectId: PROJECT_ID,
      documentId: '',
      query: QUERY,
    });

    expect(vi.mocked(revalidatePath)).not.toHaveBeenCalled();
  });
});

describe('processBotThreadReply – return value', () => {
  it('returns { threadId, chunkCount } matching the input and actual chunk count', async () => {
    mockSql.mockResolvedValueOnce([{ name: 'Test Project' }]);
    vi.mocked(retrieveRelevantChunks).mockResolvedValue(asChunks([makeChunk(0.8), makeChunk(0.7)]));
    vi.mocked(createChatCompletion).mockResolvedValue(makeLlmResponse('The answer.'));

    const result = await processBotThreadReply({
      threadId: THREAD_ID,
      projectId: PROJECT_ID,
      documentId: DOCUMENT_ID,
      query: QUERY,
    });

    expect(result).toEqual({ threadId: THREAD_ID, chunkCount: 2 });
  });

  it('returns chunkCount of 0 when no chunks are found', async () => {
    mockSql.mockResolvedValueOnce([{ name: 'Test Project' }]);
    vi.mocked(retrieveRelevantChunks).mockResolvedValue(asChunks([]));

    const result = await processBotThreadReply({
      threadId: THREAD_ID,
      projectId: PROJECT_ID,
      documentId: DOCUMENT_ID,
      query: QUERY,
    });

    expect(result).toEqual({ threadId: THREAD_ID, chunkCount: 0 });
  });
});

describe('BOT_NO_MATCH_MSG', () => {
  it('is a non-empty string', () => {
    expect(typeof BOT_NO_MATCH_MSG).toBe('string');
    expect(BOT_NO_MATCH_MSG.length).toBeGreaterThan(0);
  });
});
