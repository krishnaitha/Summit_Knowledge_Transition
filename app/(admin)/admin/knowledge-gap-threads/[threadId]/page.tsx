import { ArrowLeft, ArrowRight, CheckCircle, FileText } from 'lucide-react';
import Link from 'next/link';

import {
  addDocumentThreadReplyAction,
  updateDocumentThreadStatusAction,
} from '@/app/actions/document-threads';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SubmitButton } from '@/components/ui/submit-button';
import { Textarea } from '@/components/ui/textarea';
import { getProjectAdminIds, requireAnyAdmin } from '@/lib/auth';
import { getKnowledgeGapThread } from '@/lib/data';
import { formatDate } from '@/lib/utils';

function displayName(name: string | null, email: string | null) {
  return name && name !== 'undefined' && name.trim() ? name : (email ?? 'Unknown user');
}

export default async function KnowledgeGapThreadPage(props: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await props.params;
  const { profile } = await requireAnyAdmin();

  const thread = await getKnowledgeGapThread(threadId);
  if (!thread) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-500">Knowledge gap thread not found.</p>
        <Link href="/admin/threads" className="text-brand-700 text-sm font-medium hover:underline">
          Back to thread queue
        </Link>
      </div>
    );
  }

  const adminProjectIds = await getProjectAdminIds(profile!.id);
  const canModerate = profile?.role === 'admin' || adminProjectIds.includes(thread.project_id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/admin/threads"
          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to thread queue
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>{thread.title}</CardTitle>
            <Badge variant={thread.status === 'resolved' ? 'success' : 'warning'}>
              {thread.status === 'resolved' ? 'Resolved' : 'Open'}
            </Badge>
            <Badge variant="info">Knowledge Gap</Badge>
          </div>
          <p className="text-sm text-slate-500">
            Project: <span className="font-medium text-slate-700">{thread.project_name}</span>
          </p>
          <p className="text-xs text-slate-500">
            Started by {displayName(thread.creator_name, thread.creator_email)} •{' '}
            {formatDate(thread.created_at, true)}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {thread.gap_query && (
            <div className="rounded-xl border border-amber-100 bg-amber-50 p-3">
              <p className="text-xs font-medium text-amber-700">Original unanswered query</p>
              <p className="mt-1 text-sm text-slate-800">{thread.gap_query}</p>
            </div>
          )}

          {thread.status === 'resolved' &&
            (thread.kb_document_id ? (
              <div className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
                <CheckCircle className="h-4 w-4" />
                Captured to Knowledge Base
              </div>
            ) : thread.gap_query ? (
              <Link
                href={`/admin/generate-document?projectId=${thread.project_id}&context=${encodeURIComponent(thread.gap_query)}&threadId=${thread.id}`}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-900"
              >
                <FileText className="h-4 w-4" />
                Capture to Knowledge Base
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : null)}

          <div className="space-y-3">
            {thread.comments.length ? (
              thread.comments.map((comment) => (
                <div key={comment.id} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-medium text-slate-700">
                      {displayName(comment.author_name, comment.author_email)}
                    </span>
                    {comment.author_global_role === 'admin' && (
                      <Badge variant="danger">Super Admin</Badge>
                    )}
                    {comment.author_project_role === 'admin' &&
                      comment.author_global_role !== 'admin' && (
                        <Badge variant="warning">Product Admin</Badge>
                      )}
                    {comment.is_answer && <Badge variant="success">Answer</Badge>}
                    <span>• {formatDate(comment.created_at, true)}</span>
                  </div>
                  <p className="mt-1 text-sm whitespace-pre-wrap text-slate-700">{comment.body}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">No replies yet.</p>
            )}
          </div>

          {thread.status === 'open' && (
            <form action={addDocumentThreadReplyAction} className="space-y-2">
              <input type="hidden" name="project_id" value={thread.project_id} />
              <input type="hidden" name="thread_id" value={thread.id} />
              <input type="hidden" name="mark_as_answer" value={canModerate ? 'true' : 'false'} />
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

          {canModerate && (
            <form action={updateDocumentThreadStatusAction}>
              <input type="hidden" name="project_id" value={thread.project_id} />
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
        </CardContent>
      </Card>
    </div>
  );
}
