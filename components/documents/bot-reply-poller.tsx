'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { MarkdownContent } from '@/components/ui/markdown-content';

/**
 * Rendered for threads that have no bot reply yet.
 * Polls the bot-reply endpoint every 2 seconds and triggers a router.refresh()
 * as soon as the reply is available — no manual page reload needed.
 */
export function BotReplyPoller({ threadId }: { threadId: string }) {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let stopped = false;

    async function check() {
      try {
        const res = await fetch(`/api/threads/${threadId}/bot-reply`);
        if (!res.ok) return;
        const data = (await res.json()) as { reply: { body: string; created_at: string } | null };
        if (data.reply && !stopped) {
          stopped = true;
          if (timerRef.current) clearInterval(timerRef.current);
          router.refresh();
        }
      } catch {
        // network hiccup — keep polling
      }
    }

    // First check after 2 s (LLM takes at least that long)
    const timeout = setTimeout(() => {
      check();
      timerRef.current = setInterval(check, 2000);
    }, 2000);

    return () => {
      stopped = true;
      clearTimeout(timeout);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [threadId, router]);

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50 p-3">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span className="font-medium text-violet-700">NextElevate AI</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
          Bot
        </span>
        <span className="inline-flex gap-1">
          <span className="animate-bounce [animation-delay:0ms]">·</span>
          <span className="animate-bounce [animation-delay:150ms]">·</span>
          <span className="animate-bounce [animation-delay:300ms]">·</span>
        </span>
        <span className="italic">Searching the knowledge base…</span>
      </div>
      {/* Placeholder so layout doesn't jump when the real answer renders */}
      <MarkdownContent content="&nbsp;" size="sm" />
    </div>
  );
}
