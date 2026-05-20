import {
  addDocumentThreadReplyAction,
  createDocumentThreadAction,
  updateDocumentThreadStatusAction,
} from '@/app/actions/document-threads';
import { BotReplyPoller } from '@/components/documents/bot-reply-poller';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { MarkdownContent } from '@/components/ui/markdown-content';
import { SubmitButton } from '@/components/ui/submit-button';
import { Textarea } from '@/components/ui/textarea';
import type { DocumentThreadView } from '@/lib/data';
import type { DocumentRecord } from '@/lib/types/database';
import { formatDate } from '@/lib/utils';

function displayName(name: string | null, email: string | null) {
  return name && name !== 'undefined' && name.trim() ? name : (email ?? 'Unknown user');
}

export function DocumentThreadsBoard({
  projectId,
  document,
  threads,
  canModerate,
}: {
  projectId: string;
  document: DocumentRecord;
  threads: DocumentThreadView[];
  canModerate: boolean;
}) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Start a Discussion</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createDocumentThreadAction} className="space-y-3">
            <input type="hidden" name="project_id" value={projectId} />
            <input type="hidden" name="document_id" value={document.id} />
            <Input
              name="title"
              placeholder="Question title (e.g., Clarify onboarding sequence)"
              maxLength={160}
              required
            />
            <div className="grid gap-3 md:grid-cols-[180px_1fr]">
              <Input
                name="page_number"
                type="number"
                min={1}
                step={1}
                placeholder="Page (optional)"
              />
              <Textarea
                name="body"
                placeholder="Describe the exact issue or question for this document page."
                rows={4}
                maxLength={5000}
                required
              />
            </div>
            <SubmitButton loadingText="Posting…">Post thread</SubmitButton>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Discussion Threads</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {threads.length ? (
            threads.map((thread) => (
              <div key={thread.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold text-slate-900">{thread.title}</p>
                      <Badge variant={thread.status === 'resolved' ? 'success' : 'warning'}>
                        {thread.status === 'resolved' ? 'Resolved' : 'Open'}
                      </Badge>
                      {thread.page_number && (
                        <Badge variant="info">Page {thread.page_number}</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Started by {displayName(thread.creator_name, thread.creator_email)} •{' '}
                      {formatDate(thread.created_at, true)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={`/api/documents/view?documentId=${document.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button type="button" variant="secondary" size="sm">
                        Open document
                      </Button>
                    </a>
                    {canModerate && (
                      <form action={updateDocumentThreadStatusAction}>
                        <input type="hidden" name="project_id" value={projectId} />
                        <input type="hidden" name="document_id" value={document.id} />
                        <input type="hidden" name="thread_id" value={thread.id} />
                        <input
                          type="hidden"
                          name="next_status"
                          value={thread.status === 'open' ? 'resolved' : 'open'}
                        />
                        <SubmitButton
                          variant={thread.status === 'open' ? 'secondary' : 'ghost'}
                          size="sm"
                          loadingText="Saving…"
                        >
                          {thread.status === 'open' ? 'Mark resolved' : 'Reopen'}
                        </SubmitButton>
                      </form>
                    )}
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  {thread.comments.map((comment) => (
                    <div
                      key={comment.id}
                      className={`rounded-xl border p-3 ${comment.is_bot ? 'border-violet-200 bg-violet-50' : 'border-slate-200 bg-white'}`}
                    >
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="font-medium text-slate-700">
                          {comment.is_bot
                            ? 'NextElevate AI'
                            : displayName(comment.author_name, comment.author_email)}
                        </span>
                        {comment.is_bot && <Badge variant="info">Bot</Badge>}
                        {!comment.is_bot && comment.author_global_role === 'admin' && (
                          <Badge variant="danger">Super Admin</Badge>
                        )}
                        {!comment.is_bot &&
                          comment.author_project_role === 'admin' &&
                          comment.author_global_role !== 'admin' && (
                            <Badge variant="warning">Product Admin</Badge>
                          )}
                        {comment.is_answer && <Badge variant="success">Answer</Badge>}
                        <span>• {formatDate(comment.created_at, true)}</span>
                      </div>
                      {comment.is_bot ? (
                        <>
                          <MarkdownContent content={comment.body} size="sm" />
                          {(comment.sources?.length ?? 0) > 0 && (
                            <div className="mt-2 flex flex-wrap items-center justify-end gap-1.5">
                              <span className="text-xs text-slate-400">Sources:</span>
                              {(comment.sources ?? []).map((src) => (
                                <span
                                  key={src.document_name}
                                  className="inline-flex items-center rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-700"
                                >
                                  {src.document_name}
                                </span>
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="mt-1 text-sm whitespace-pre-wrap text-slate-700">
                          {comment.body}
                        </p>
                      )}
                    </div>
                  ))}
                  {thread.status === 'open' && !thread.comments.some((c) => c.is_bot) && (
                    <BotReplyPoller threadId={thread.id} />
                  )}
                </div>

                {thread.status === 'open' && (
                  <form action={addDocumentThreadReplyAction} className="mt-3 space-y-2">
                    <input type="hidden" name="project_id" value={projectId} />
                    <input type="hidden" name="document_id" value={document.id} />
                    <input type="hidden" name="thread_id" value={thread.id} />
                    <input
                      type="hidden"
                      name="mark_as_answer"
                      value={canModerate ? 'true' : 'false'}
                    />
                    <Textarea
                      name="body"
                      placeholder={
                        canModerate
                          ? 'Post an official answer for this thread'
                          : 'Add a reply to this thread'
                      }
                      rows={3}
                      maxLength={5000}
                      required
                    />
                    <SubmitButton loadingText="Replying…" size="sm">
                      {canModerate ? 'Post answer' : 'Post reply'}
                    </SubmitButton>
                  </form>
                )}
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">No discussion threads yet for this document.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
