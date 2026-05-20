import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BotReplyPoller } from '@/components/documents/bot-reply-poller';

const mockRefresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

vi.mock('@/lib/env.client', () => ({
  clientEnv: { appName: 'Test App', appUrl: 'http://localhost:3000', botName: 'Test Bot AI' },
}));

vi.mock('@/components/ui/markdown-content', () => ({
  MarkdownContent: ({ content }: { content: string }) => <span>{content}</span>,
}));

describe('BotReplyPoller – rendering', () => {
  it('renders the bot name', () => {
    render(<BotReplyPoller threadId="thread-1" />);
    expect(screen.getByText('Test Bot AI')).toBeDefined();
  });

  it('renders the "Bot" badge', () => {
    render(<BotReplyPoller threadId="thread-1" />);
    expect(screen.getByText('Bot')).toBeDefined();
  });

  it('renders the loading message', () => {
    render(<BotReplyPoller threadId="thread-1" />);
    expect(screen.getByText('Searching the knowledge base\u2026')).toBeDefined();
  });
});

describe('BotReplyPoller – polling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockRefresh.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('does not fetch before the 2-second delay', () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ reply: null }) });
    vi.stubGlobal('fetch', fetchMock);

    render(<BotReplyPoller threadId="thread-1" />);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('polls the correct endpoint after the initial delay', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ reply: null }) });
    vi.stubGlobal('fetch', fetchMock);

    render(<BotReplyPoller threadId="thread-42" />);

    act(() => {
      vi.advanceTimersByTime(2100);
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/threads/thread-42/bot-reply');
  });

  it('calls router.refresh() when a reply is returned', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ reply: { body: 'Hello world', created_at: '2026-01-01T00:00:00Z' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<BotReplyPoller threadId="thread-99" />);

    await act(async () => {
      vi.advanceTimersByTime(2100);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockRefresh).toHaveBeenCalledOnce();
  });

  it('does not call router.refresh() when reply is null', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ reply: null }) });
    vi.stubGlobal('fetch', fetchMock);

    render(<BotReplyPoller threadId="thread-0" />);

    await act(async () => {
      vi.advanceTimersByTime(4100);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('does not throw when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    render(<BotReplyPoller threadId="thread-err" />);

    await act(async () => {
      vi.advanceTimersByTime(2100);
      await Promise.resolve();
    });

    expect(mockRefresh).not.toHaveBeenCalled();
  });
});
