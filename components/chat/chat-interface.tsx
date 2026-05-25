'use client';

import { Download, Plus, Search, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useEffectEvent, useMemo, useState, useTransition } from 'react';

import { MessageBubble, type ChatBubbleMessage } from '@/components/chat/message-bubble';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface SessionItem {
  id: string;
  label: string;
  messageCount?: number;
  lastMessageAt?: string | null;
}

interface ChatInterfaceProps {
  projectId: string;
  projectName: string;
  initialSessionId?: string | null;
  initialSessions: SessionItem[];
  initialMessages: ChatBubbleMessage[];
  initialBookmarkedIds?: string[];
}

type ResponseStyle = 'default' | 'concise' | 'step_by_step' | 'bullet_list';

const STARTER_PROMPTS = [
  "Summarize this product's KT in 5 bullets.",
  'What are the top risks and dependencies I should know?',
  'Give me a first-week onboarding checklist.',
  'remember response style: keep answers short',
] as const;

const RESPONSE_STYLE_OPTIONS: Array<{ value: ResponseStyle; label: string }> = [
  { value: 'default', label: 'Default' },
  { value: 'concise', label: 'Concise' },
  { value: 'step_by_step', label: 'Step-by-step' },
  { value: 'bullet_list', label: 'Bullet list' },
];

function deriveSessionLabel(message: string): string {
  const normalized = message.trim().replace(/\s+/g, ' ');
  if (!normalized) return 'New chat';

  const lower = normalized.toLowerCase();
  if (lower.startsWith('remember ') || lower === 'yes remember' || lower === 'no remember') {
    return 'New chat';
  }

  return normalized.slice(0, 72);
}

function parseFilename(contentDisposition: string | null, fallback: string): string {
  if (!contentDisposition) return fallback;
  const match = contentDisposition.match(/filename="([^"]+)"/i);
  return match?.[1] ?? fallback;
}

function fallbackSessionLabel(index: number): string {
  return index === 0 ? 'Most recent chat' : `Chat ${index + 1}`;
}

export function ChatInterface({
  projectId,
  projectName,
  initialSessionId,
  initialSessions,
  initialMessages,
  initialBookmarkedIds = [],
}: ChatInterfaceProps) {
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId ?? null);
  const [sessions, setSessions] = useState<SessionItem[]>(initialSessions);
  const [messages, setMessages] = useState(initialMessages);
  const [hasLoadedHistory, setHasLoadedHistory] = useState(
    () => initialSessions.length > 0 || Boolean(initialSessionId),
  );
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(
    () => new Set(initialBookmarkedIds),
  );
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [responseStyle, setResponseStyle] = useState<ResponseStyle>('default');
  const [citationsOnly, setCitationsOnly] = useState(false);
  const [clarifyFirst, setClarifyFirst] = useState(false);
  const [isSessionMutating, setIsSessionMutating] = useState(false);
  const [isPending, startTransition] = useTransition();

  const canSubmit = useMemo(() => draft.trim().length > 0 && !isPending, [draft, isPending]);

  const createNewChat = () => {
    setSessionId(null);
    setMessages([]);
    setBookmarkedIds(new Set());
    setStatus(null);
  };

  const loadSession = (id: string, force = false) => {
    if (id === sessionId && !force) return;
    setSessionId(id);
    setMessages([]);
    setBookmarkedIds(new Set());
    setStatus('Loading chat history...');

    startTransition(async () => {
      const response = await fetch(`/api/chat?sessionId=${encodeURIComponent(id)}`);

      if (response.ok) {
        const data = (await response.json()) as {
          messages: Array<{
            id: string;
            role: 'user' | 'assistant';
            content: string;
            sources: Array<{ documentName: string; similarity?: number }> | null;
            created_at?: string;
          }>;
          bookmarkedMessageIds: string[];
        };
        setMessages(
          data.messages.map((message) => ({
            id: message.id,
            role: message.role,
            content: message.content,
            sources: message.sources ?? [],
            createdAt: message.created_at,
          })),
        );
        setBookmarkedIds(new Set(data.bookmarkedMessageIds ?? []));
      }

      setStatus(null);
    });
  };

  const autoloadInitialSession = useEffectEvent((id: string) => {
    loadSession(id, true);
  });

  const refreshSessions = useCallback(async () => {
    setIsHistoryLoading(true);

    try {
      const response = await fetch(`/api/chat/sessions?projectId=${encodeURIComponent(projectId)}`);

      if (!response.ok) {
        setStatus('Could not load previous sessions.');
        return;
      }

      const data = (await response.json()) as {
        sessions: Array<{
          id: string;
          title: string | null;
          last_message_at: string | null;
          message_count: number;
        }>;
      };

      const nextSessions = (data.sessions ?? []).map((session, index) => ({
        id: session.id,
        label: session.title?.trim() || fallbackSessionLabel(index),
        messageCount: session.message_count,
        lastMessageAt: session.last_message_at,
      }));

      setSessions(nextSessions);
      setHasLoadedHistory(true);
      setStatus(null);
    } catch {
      setStatus('Could not load previous sessions.');
    } finally {
      setIsHistoryLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (initialSessionId && initialMessages.length === 0) {
      autoloadInitialSession(initialSessionId);
    }
  }, [initialMessages.length, initialSessionId]);

  const renameCurrentSession = async () => {
    if (!sessionId || isSessionMutating) return;
    const current = sessions.find((item) => item.id === sessionId);
    const currentLabel = current?.label ?? 'Chat';
    const nextLabel = window.prompt('Rename chat session', currentLabel)?.trim();

    if (!nextLabel || nextLabel === currentLabel) return;

    setIsSessionMutating(true);
    try {
      const response = await fetch('/api/chat/sessions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, title: nextLabel }),
      });

      if (!response.ok) {
        setStatus('Could not rename chat session.');
        return;
      }

      setSessions((currentSessions) =>
        currentSessions.map((item) =>
          item.id === sessionId
            ? {
                ...item,
                label: nextLabel,
              }
            : item,
        ),
      );
    } catch {
      setStatus('Could not rename chat session.');
    } finally {
      setIsSessionMutating(false);
    }
  };

  const deleteCurrentSession = async () => {
    if (!sessionId || isSessionMutating) return;
    const confirmed = window.confirm('Delete this chat session permanently?');
    if (!confirmed) return;

    setIsSessionMutating(true);
    try {
      const response = await fetch(
        `/api/chat/sessions?sessionId=${encodeURIComponent(sessionId)}`,
        {
          method: 'DELETE',
        },
      );

      if (!response.ok) {
        setStatus('Could not delete chat session.');
        return;
      }

      const remaining = sessions.filter((item) => item.id !== sessionId);
      setSessions(remaining);
      setSessionId(null);
      setMessages([]);
      setBookmarkedIds(new Set());

      const fallbackSession = remaining[0];
      if (fallbackSession) {
        loadSession(fallbackSession.id);
      }
    } catch {
      setStatus('Could not delete chat session.');
    } finally {
      setIsSessionMutating(false);
    }
  };

  const exportCurrentSession = async (format: 'markdown' | 'pdf') => {
    if (!sessionId || isSessionMutating) return;

    if (format === 'pdf') {
      window.open(
        `/api/chat/export?sessionId=${encodeURIComponent(sessionId)}&format=pdf`,
        '_blank',
        'noopener,noreferrer',
      );
      return;
    }

    setIsSessionMutating(true);
    try {
      const response = await fetch(
        `/api/chat/export?sessionId=${encodeURIComponent(sessionId)}&format=markdown`,
      );

      if (!response.ok) {
        setStatus('Could not export chat.');
        return;
      }

      const blob = await response.blob();
      const filename = parseFilename(response.headers.get('content-disposition'), 'chat-export.md');
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setStatus('Could not export chat.');
    } finally {
      setIsSessionMutating(false);
    }
  };

  const handleSend = () => {
    if (!canSubmit) {
      return;
    }

    const sentAt = new Date().toISOString();
    const userMessage: ChatBubbleMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: draft,
      createdAt: sentAt,
    };

    const assistantId = crypto.randomUUID();
    const nextMessages = [
      ...messages,
      userMessage,
      {
        id: assistantId,
        role: 'assistant' as const,
        content: '',
        sources: [],
        isStreamed: true,
        createdAt: sentAt,
      },
    ];
    setMessages(nextMessages);
    setDraft('');
    setStatus('Searching documents...');

    startTransition(async () => {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          projectName,
          sessionId,
          message: userMessage.content,
          responseStyle,
          citationsOnly,
          clarifyFirst,
        }),
      });

      if (!response.ok || !response.body) {
        setStatus('Chat request failed.');
        return;
      }

      const createdSessionId = response.headers.get('x-session-id');
      const sourcesHeader = response.headers.get('x-sources');
      const sources = sourcesHeader
        ? (JSON.parse(sourcesHeader) as Array<{ documentName: string; similarity?: number }>)
        : [];

      if (createdSessionId && !sessions.some((item) => item.id === createdSessionId)) {
        setSessions((current) => [
          {
            id: createdSessionId,
            label: deriveSessionLabel(userMessage.content),
            messageCount: 2,
            lastMessageAt: sentAt,
          },
          ...current,
        ]);
        setHasLoadedHistory(true);
        setSessionId(createdSessionId);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let generated = '';
      let inStatusFrame = false;
      let statusBuffer = '';
      let lastStatus: string | null = null;

      while (!done) {
        const chunk = await reader.read();
        done = chunk.done;

        if (chunk.value) {
          const decoded = decoder.decode(chunk.value, { stream: true });

          let hasGeneratedDelta = false;

          for (const char of decoded) {
            if (char === '\x00') {
              inStatusFrame = !inStatusFrame;
              if (!inStatusFrame) {
                lastStatus = statusBuffer || null;
                setStatus(lastStatus);
                statusBuffer = '';
              }
              continue;
            }

            if (inStatusFrame) {
              statusBuffer += char;
              continue;
            }

            generated += char;
            hasGeneratedDelta = true;
          }

          if (hasGeneratedDelta) {
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantId ? { ...message, content: generated, sources } : message,
              ),
            );
          }
        }
      }

      if (!generated.trim()) {
        const fallback = lastStatus ?? 'No response received from AI. Please try again.';
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId ? { ...message, content: fallback, sources } : message,
          ),
        );
      }

      setStatus(null);
    });
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
      <Card className="overflow-hidden border border-white/40">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">Previous sessions</p>
            <p className="text-xs text-slate-500">Scoped to {projectName}</p>
          </div>
          <Button onClick={createNewChat} size="sm" type="button" variant="ghost">
            <Plus className="h-4 w-4" />
            New Chat
          </Button>
        </div>
        <div className="space-y-2 p-4">
          {!hasLoadedHistory ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center">
              <p className="text-sm font-medium text-slate-700">Keep this page clean by default</p>
              <p className="mt-1 text-xs text-slate-500">
                Load older chats only when you want to revisit them.
              </p>
              <Button
                className="mt-3"
                onClick={() => refreshSessions()}
                size="sm"
                type="button"
                variant="secondary"
                disabled={isHistoryLoading}
              >
                {isHistoryLoading ? 'Loading history...' : 'Load previous sessions'}
              </Button>
            </div>
          ) : sessions.length ? (
            sessions.map((item) => (
              <button
                key={item.id}
                className="w-full rounded-2xl bg-slate-50 px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-slate-100"
                onClick={() => loadSession(item.id)}
                type="button"
              >
                <p className="line-clamp-1 font-medium text-slate-800">{item.label}</p>
                {typeof item.messageCount === 'number' ? (
                  <p className="mt-1 text-xs text-slate-500">{item.messageCount} messages</p>
                ) : null}
              </button>
            ))
          ) : (
            <div className="space-y-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center">
              <p className="text-sm text-slate-500">No chat history yet.</p>
              <Button
                onClick={() => refreshSessions()}
                size="sm"
                type="button"
                variant="ghost"
                disabled={isHistoryLoading}
              >
                {isHistoryLoading ? 'Refreshing...' : 'Refresh'}
              </Button>
            </div>
          )}
        </div>
      </Card>

      <Card className="flex min-h-[70vh] flex-col overflow-hidden border border-white/40">
        <div className="border-b border-slate-100 px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-lg font-semibold text-slate-950">Ask Summit AI</p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                type="button"
                variant="secondary"
                disabled={!sessionId || isSessionMutating}
                onClick={renameCurrentSession}
              >
                Rename
              </Button>
              <Button
                size="sm"
                type="button"
                variant="secondary"
                disabled={!sessionId || isSessionMutating}
                onClick={() => exportCurrentSession('markdown')}
              >
                <Download className="h-3.5 w-3.5" />
                MD
              </Button>
              <Button
                size="sm"
                type="button"
                variant="secondary"
                disabled={!sessionId || isSessionMutating}
                onClick={() => exportCurrentSession('pdf')}
              >
                PDF
              </Button>
              <Button
                size="sm"
                type="button"
                variant="danger"
                disabled={!sessionId || isSessionMutating}
                onClick={deleteCurrentSession}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </Button>
            </div>
          </div>
          <p className="text-sm text-slate-500">
            Answers stay grounded in this project&apos;s KT documents.
          </p>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
          {messages.length ? (
            messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                projectId={projectId}
                isBookmarked={bookmarkedIds.has(message.id)}
              />
            ))
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
              <Search className="mx-auto h-8 w-8 text-slate-400" />
              <p className="mt-4 text-sm text-slate-500">
                Ask about runbooks, dependencies, handover tasks, environments, or support
                procedures.
              </p>
            </div>
          )}
          {status ? <p className="text-accent-700 text-sm font-medium">{status}</p> : null}
        </div>
        <div className="border-t border-slate-100 p-4">
          <div className="mb-3 flex flex-wrap gap-2">
            {STARTER_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => setDraft(prompt)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
              >
                {prompt}
              </button>
            ))}
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {RESPONSE_STYLE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setResponseStyle(option.value)}
                className={
                  responseStyle === option.value
                    ? 'rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white'
                    : 'rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200'
                }
              >
                {option.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCitationsOnly((value) => !value)}
              className={
                citationsOnly
                  ? 'rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700'
                  : 'rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200'
              }
            >
              With citations only
            </button>
            <button
              type="button"
              onClick={() => setClarifyFirst((value) => !value)}
              className={
                clarifyFirst
                  ? 'rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-700'
                  : 'rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200'
              }
            >
              Clarify first
            </button>
          </div>
          <div className="flex gap-3">
            <Input
              id="chat-message"
              name="chatMessage"
              autoComplete="off"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask a question about this project's KT docs"
            />
            <Button disabled={!canSubmit} onClick={handleSend} type="button">
              Send
            </Button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Memory tip: Use &quot;remember key: value&quot; (example: &quot;remember response style:
            keep answers short&quot;), then confirm with &quot;yes remember&quot; or cancel with
            &quot;no remember&quot;.
          </p>
        </div>
      </Card>
    </div>
  );
}
