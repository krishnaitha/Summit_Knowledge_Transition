import { GenerateDocumentForm } from '@/components/admin/generate-document-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { requireAnyAdmin } from '@/lib/auth';
import { getAllProjects, getKnowledgeGapThread } from '@/lib/data';

export default async function GenerateDocumentPage(props: {
  searchParams: Promise<{ context?: string; threadId?: string; projectId?: string }>;
}) {
  const { profile } = await requireAnyAdmin();
  if (!profile) return null;

  const [projects, searchParams] = await Promise.all([getAllProjects(), props.searchParams]);
  const suggestedContext = searchParams.context?.trim() || undefined;

  // If arriving from a knowledge-gap thread, fetch the full conversation and
  // pre-populate the transcript textarea with the structured Q&A exchange.
  let suggestedTranscript: string | undefined;
  let suggestedTitle: string | undefined;
  let preselectedProjectId: string | undefined = searchParams.projectId?.trim() || undefined;

  if (searchParams.threadId) {
    const thread = await getKnowledgeGapThread(searchParams.threadId);
    if (thread) {
      preselectedProjectId = preselectedProjectId ?? thread.project_id;

      const lines: string[] = [
        `Knowledge Gap Thread: ${thread.title}`,
        `Project: ${thread.project_name}`,
        '',
        '--- Original Question ---',
        thread.gap_query ?? thread.title,
        '',
        '--- Conversation ---',
      ];

      for (const comment of thread.comments) {
        const author = comment.author_name?.trim() || comment.author_email || 'Unknown';
        const role = comment.is_answer ? ' [Answer]' : '';
        const bot = comment.is_bot ? ' [AI]' : '';
        lines.push(`${author}${role}${bot}:`);
        lines.push(comment.body);
        lines.push('');
      }

      suggestedTranscript = lines.join('\n').trim();
      suggestedTitle = `Knowledge: ${(thread.gap_query ?? thread.title).slice(0, 60)}`;
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-slate-950">Generate Document from Transcript</h1>
        <p className="mt-2 text-sm text-slate-500">
          Paste a transcript and let AI transform it into a well-structured knowledge document.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upload/Input Section */}
        <GenerateDocumentForm
          projects={projects.map((p) => ({ id: p.id, name: p.name }))}
          suggestedContext={suggestedContext}
          suggestedTranscript={suggestedTranscript}
          suggestedTitle={suggestedTitle}
          preselectedProjectId={preselectedProjectId}
        />

        {/* Info Section */}
        <Card className="bg-slate-50/50">
          <CardHeader>
            <CardTitle className="text-base">How It Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-600">
            <div>
              <h4 className="font-semibold text-slate-900">1. Paste Transcript</h4>
              <p className="mt-1">
                Paste any meeting notes, interview transcript, or conversation content.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-slate-900">2. AI Processing</h4>
              <p className="mt-1">
                Our AI analyzes the content and structures it into clear sections with key insights.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-slate-900">3. Download or Push to KB</h4>
              <p className="mt-1">
                Download the document, or push it directly into a project&apos;s knowledge base — it
                will be chunked, embedded, and made searchable immediately.
              </p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-medium text-amber-900">
                Tip: Clearer transcripts produce better documents. Include speaker names and
                timestamps for best results.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
