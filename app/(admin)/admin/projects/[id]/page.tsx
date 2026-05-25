import Link from 'next/link';
import {
  BarChart3,
  BookOpen,
  ChevronRight,
  FileText,
  MessageSquare,
  Settings2,
  Users,
} from 'lucide-react';

import {
  approveRetakeRequestAction,
  rejectRetakeRequestAction,
  sendProjectAnnouncementAction,
  updateProjectSettingsAction,
} from '@/app/actions/admin';
import { DocumentUploadPanel } from '@/components/admin/document-upload-panel';
import { RetakeRequestsCard } from '@/components/admin/retake-requests-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DebouncedDocumentSearch } from '@/components/search/debounced-document-search';
import { SubmitButton } from '@/components/ui/submit-button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { requireProjectAdmin } from '@/lib/auth';
import {
  getProjectAnnouncements,
  getProjectById,
  getProjectDocuments,
  getProjectMembers,
  getProjectQuizSets,
  getRetakeRequestsForProject,
  searchProjectDocumentChunks,
} from '@/lib/data';
import { formatDate } from '@/lib/utils';

function HighlightedSnippet(props: { snippet: string }) {
  const segments = props.snippet
    .split('<<H>>')
    .flatMap((chunk, index) => {
      if (index === 0) {
        return [{ text: chunk, highlighted: false }];
      }

      const [highlightedText = '', ...rest] = chunk.split('<</H>>');

      return [
        { text: highlightedText, highlighted: true },
        { text: rest.join('<</H>>'), highlighted: false },
      ];
    })
    .filter((segment) => segment.text);

  return (
    <>
      {segments.map((segment, index) => {
        return segment.highlighted ? (
          <mark
            key={`${index}-${segment.text.slice(0, 12)}`}
            className="rounded-sm bg-amber-200 px-0.5 text-slate-900"
          >
            {segment.text}
          </mark>
        ) : (
          <span key={`${index}-${segment.text.slice(0, 12)}`}>{segment.text}</span>
        );
      })}
    </>
  );
}

export default async function AdminProjectDetailPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const documentQuery = (searchParams.q ?? '').trim();
  const { userId, profile } = await requireProjectAdmin(params.id);
  const isSuperAdmin = profile?.role === 'admin';

  const [project, documents, members, sets, retakeRequests, announcements, searchResults] =
    await Promise.all([
      getProjectById(params.id),
      getProjectDocuments(params.id),
      getProjectMembers(params.id),
      getProjectQuizSets(params.id),
      getRetakeRequestsForProject(params.id),
      getProjectAnnouncements(params.id, 6),
      documentQuery.length >= 2
        ? searchProjectDocumentChunks(params.id, documentQuery)
        : Promise.resolve([]),
    ]);

  const recentDocs = documents.slice(0, 5);

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-slate-500">
        <Link href="/admin/projects" className="transition hover:text-slate-900">
          Products
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-slate-900">{project?.name ?? 'Project'}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-950">{project?.name ?? 'Project'}</h1>
            <Badge variant={project?.is_active ? 'success' : 'warning'}>
              {project?.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          <p className="mt-1.5 max-w-2xl text-sm text-slate-500">
            {project?.description ?? 'No project description available.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/projects/${params.id}/members`}>
            <Button size="sm" variant="secondary">
              <Users className="h-3.5 w-3.5" />
              Members
            </Button>
          </Link>
          {isSuperAdmin && (
            <Link href={`/admin/projects/${params.id}/chat`}>
              <Button size="sm" variant="secondary">
                <MessageSquare className="h-3.5 w-3.5" />
                Chat
              </Button>
            </Link>
          )}
          {isSuperAdmin && (
            <Link href={`/admin/projects/${params.id}/analytics`}>
              <Button size="sm" variant="secondary">
                <BarChart3 className="h-3.5 w-3.5" />
                Analytics
              </Button>
            </Link>
          )}
          <Link href={`/admin/projects/${params.id}/quiz`}>
            <Button size="sm" variant="secondary">
              <BookOpen className="h-3.5 w-3.5" />
              Quest
            </Button>
          </Link>
          <Link href={`/admin/projects/${params.id}/documents`}>
            <Button size="sm" variant="secondary">
              <FileText className="h-3.5 w-3.5" />
              Documents & connectors
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Documents', value: documents.length },
          { label: 'Members', value: members.length },
          { label: 'Quest sets', value: sets.length },
          { label: 'Pass threshold', value: `${project?.pass_threshold ?? 60}%` },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-5">
              <p className="text-xs font-medium tracking-wider text-slate-500 uppercase">
                {stat.label}
              </p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                {stat.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {isSuperAdmin && (
        <details className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5">
            <div className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <Settings2 className="h-4 w-4" />
              Edit project settings
            </div>
            <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700">
              Open
            </span>
          </summary>
          <div className="border-t border-slate-100 p-5">
            <form action={updateProjectSettingsAction} className="grid gap-3">
              <input type="hidden" name="project_id" value={params.id} />
              <div className="grid gap-3 md:grid-cols-[1fr_180px]">
                <Input
                  name="name"
                  defaultValue={project?.name ?? ''}
                  placeholder="Project name"
                  maxLength={140}
                  required
                />
                <Input
                  name="pass_threshold"
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={String(project?.pass_threshold ?? 60)}
                  placeholder="Pass threshold %"
                  required
                />
              </div>
              <Textarea
                name="description"
                defaultValue={project?.description ?? ''}
                placeholder="Project description"
                rows={4}
                maxLength={5000}
              />
              <div>
                <SubmitButton loadingText="Saving…">Save project settings</SubmitButton>
              </div>
            </form>
          </div>
        </details>
      )}

      {/* Upload + Recent docs */}
      <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
        <DocumentUploadPanel projectId={params.id} />

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-slate-400" />
                <CardTitle>Knowledge base</CardTitle>
              </div>
              <Link
                href={`/admin/projects/${params.id}/documents`}
                className="text-brand-700 text-xs font-medium transition hover:underline"
              >
                {documents.length > 5 ? `View all ${documents.length} →` : 'Manage →'}
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentDocs.length ? (
              <div className="space-y-2">
                {recentDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-2.5"
                  >
                    <div className="bg-brand-50 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                      <FileText className="text-brand-500 h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{doc.file_name}</p>
                      <p className="text-xs text-slate-400">
                        {doc.chunk_count} chunks · {formatDate(doc.uploaded_at)}
                      </p>
                    </div>
                    <Badge variant="info">{doc.file_type.toUpperCase()}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 px-6 py-10 text-center">
                <FileText className="mx-auto h-7 w-7 text-slate-300" />
                <p className="mt-3 text-sm text-slate-400">
                  No documents yet. Upload KT materials using the panel on the left.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card id="search-documents">
        <CardHeader>
          <CardTitle>Search Across Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-5">
            <DebouncedDocumentSearch initialQuery={documentQuery} anchorId="search-documents" />
          </div>

          {documentQuery.length > 0 && (
            <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-3">
              <p className="text-xs text-slate-600">
                Results for{' '}
                <span className="font-medium text-slate-900">&quot;{documentQuery}&quot;</span> (
                {searchResults.length} match{searchResults.length === 1 ? '' : 'es'})
              </p>
              {searchResults.length > 0 ? (
                <div className="space-y-2">
                  {searchResults.map((result) => (
                    <div
                      key={result.chunk_id}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-slate-900">{result.file_name}</p>
                        <a
                          href={`/api/documents/view?documentId=${result.document_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-medium text-blue-700 hover:underline"
                        >
                          Open source
                        </a>
                      </div>
                      <p className="text-sm leading-6 text-slate-700">
                        <HighlightedSnippet snippet={result.snippet} />
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  No matches found in this project&apos;s documents.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Send announcement</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={sendProjectAnnouncementAction} className="space-y-3">
              <input name="project_id" type="hidden" value={params.id} />
              <Input
                name="title"
                placeholder="Subject (e.g., Quiz deadline updated)"
                required
                maxLength={140}
              />
              <Textarea
                name="message"
                placeholder="Message for all project members"
                required
                rows={5}
                maxLength={2000}
              />
              <SubmitButton loadingText="Sending…">Send to all members</SubmitButton>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent announcements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {announcements.length ? (
              announcements.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{item.message}</p>
                  <p className="mt-2 text-xs text-slate-400">
                    {formatDate(item.created_at, true)}
                    {item.sender_name ? ` · ${item.sender_name}` : ''}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">No announcements sent yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quiz re-enable requests — show only when there are requests */}
      {retakeRequests.length > 0 && (
        <RetakeRequestsCard
          projectId={params.id}
          adminId={userId ?? undefined}
          requests={retakeRequests}
          approveAction={approveRetakeRequestAction}
          rejectAction={rejectRetakeRequestAction}
        />
      )}
    </div>
  );
}
