import { BookmarkButton } from '@/components/chat/bookmark-button';
import { SourceTag } from '@/components/chat/source-tag';
import { cn } from '@/lib/utils';

export interface ChatBubbleMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Array<{ documentName: string; similarity?: number }> | null;
  /** True for messages that were just streamed and have not yet been persisted with a stable DB id. */
  isStreamed?: boolean;
}

export function MessageBubble({
  message,
  projectId,
  isBookmarked,
}: {
  message: ChatBubbleMessage;
  projectId?: string;
  isBookmarked?: boolean;
}) {
  const isUser = message.role === 'user';
  const showBookmark = !isUser && !message.isStreamed && !!projectId;

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div className={cn('max-w-3xl rounded-3xl px-5 py-4 shadow-sm', isUser ? 'bg-brand-700 text-white' : 'bg-white text-slate-900')}>
        <p className="whitespace-pre-wrap text-sm leading-7">{message.content}</p>
        {!isUser && message.sources?.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {message.sources.map((source, index) => (
              <SourceTag key={`${source.documentName}-${index}`} documentName={source.documentName} similarity={source.similarity} />
            ))}
          </div>
        ) : null}
        {showBookmark && (
          <div className="mt-2 flex justify-end">
            <BookmarkButton
              messageId={message.id}
              projectId={projectId}
              initialIsBookmarked={isBookmarked ?? false}
            />
          </div>
        )}
      </div>
    </div>
  );
}
