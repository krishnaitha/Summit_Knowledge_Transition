import { BookmarkButton } from '@/components/chat/bookmark-button';
import { FeedbackButtons } from '@/components/chat/feedback-buttons';
import { SourceTag } from '@/components/chat/source-tag';
import { MarkdownContent } from '@/components/ui/markdown-content';
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
      <div
        className={cn(
          'max-w-3xl rounded-3xl px-5 py-4 shadow-sm',
          isUser ? 'bg-brand-700 text-white' : 'bg-white text-slate-900',
        )}
      >
        {isUser ? (
          <p className="text-sm leading-7 whitespace-pre-wrap">{message.content}</p>
        ) : (
          <MarkdownContent content={message.content} />
        )}
        {!isUser && Array.isArray(message.sources) && message.sources.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {message.sources.map((source, index) => (
              <SourceTag
                key={`${source.documentName}-${index}`}
                documentName={source.documentName}
                similarity={source.similarity}
              />
            ))}
          </div>
        ) : null}
        {showBookmark && (
          <div className="mt-2 flex justify-end">
            <div className="flex items-end gap-2">
              <FeedbackButtons messageId={message.id} projectId={projectId!} />
              <BookmarkButton
                messageId={message.id}
                projectId={projectId}
                initialIsBookmarked={isBookmarked ?? false}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
