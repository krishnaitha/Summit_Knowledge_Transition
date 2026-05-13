'use client';

import { useMemo, useState, useTransition } from 'react';
import { Plus, Search } from 'lucide-react';

import { MessageBubble, type ChatBubbleMessage } from '@/components/chat/message-bubble';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface ChatInterfaceProps {
  projectId: string;
  projectName: string;
  initialSessionId?: string | null;
  initialSessions: Array<{ id: string; label: string }>;
  initialMessages: ChatBubbleMessage[];
  initialBookmarkedIds?: string[];
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
  const [sessions, setSessions] = useState(initialSessions);
  const [messages, setMessages] = useState(initialMessages);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(
    () => new Set(initialBookmarkedIds),
  );
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canSubmit = useMemo(() => draft.trim().length > 0 && !isPending, [draft, isPending]);

  const createNewChat = () => {
    setSessionId(null);
    setMessages([]);
    setBookmarkedIds(new Set());
    setStatus(null);
  };

  const loadSession = (id: string) => {
    if (id === sessionId) return;
    setSessionId(id);
    setMessages([]);
    setBookmarkedIds(new Set());
    setStatus('Loading chat history…');

    startTransition(async () => {
      const response = await fetch(`/api/chat?sessionId=${encodeURIComponent(id)}`);

      if (response.ok) {
        const data = (await response.json()) as {
          messages: Array<{
            id: string;
            role: 'user' | 'assistant';
            content: string;
            sources: Array<{ documentName: string; similarity?: number }> | null;
          }>;
          bookmarkedMessageIds: string[];
        };
        setMessages(
          data.messages.map((message) => ({
            id: message.id,
            role: message.role,
            content: message.content,
            sources: message.sources ?? [],
          })),
        );
        setBookmarkedIds(new Set(data.bookmarkedMessageIds ?? []));
      }

      setStatus(null);
    });
  };

  const handleSend = () => {
    if (!canSubmit) {
      return;
    }

    const userMessage: ChatBubbleMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: draft,
    };

    const assistantId = crypto.randomUUID();
    const nextMessages = [
      ...messages,
      userMessage,
      { id: assistantId, role: 'assistant' as const, content: '', sources: [], isStreamed: true },
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
        setSessions((current) => [{ id: createdSessionId, label: 'New chat' }, ...current]);
        setSessionId(createdSessionId);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let generated = '';

      while (!done) {
        const chunk = await reader.read();
        done = chunk.done;

        if (chunk.value) {
          const decoded = decoder.decode(chunk.value, { stream: true });

          if (decoded.startsWith('\x00')) {
            setStatus(decoded.slice(1));
          } else {
            generated += decoded;
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantId ? { ...message, content: generated, sources } : message,
              ),
            );
          }
        }
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
          {sessions.length ? (
            sessions.map((item) => (
              <button
                key={item.id}
                className="w-full rounded-2xl bg-slate-50 px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-slate-100"
                onClick={() => loadSession(item.id)}
                type="button"
              >
                {item.label}
              </button>
            ))
          ) : (
            <p className="text-sm text-slate-500">No chat history yet.</p>
          )}
        </div>
      </Card>

      <Card className="flex min-h-[70vh] flex-col overflow-hidden border border-white/40">
        <div className="border-b border-slate-100 px-6 py-5">
          <p className="text-lg font-semibold text-slate-950">Ask Summit AI</p>
          <p className="text-sm text-slate-500">
            Answers stay grounded in this project's KT documents.
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
          {status ? <p className="text-sm font-medium text-accent-700">{status}</p> : null}
        </div>
        <div className="border-t border-slate-100 p-4">
          <div className="flex gap-3">
            <Input
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
        </div>
      </Card>
    </div>
  );
}
