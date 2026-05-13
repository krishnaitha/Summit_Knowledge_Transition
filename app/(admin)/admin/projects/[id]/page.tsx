import Link from 'next/link';
import { BarChart3, BookOpen, ChevronRight, FileText, MessageSquare, Users } from 'lucide-react';

import { approveRetakeRequestAction, rejectRetakeRequestAction } from '@/app/actions/admin';
import { DocumentUploadPanel } from '@/components/admin/document-upload-panel';
import { RetakeRequestsCard } from '@/components/admin/retake-requests-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { requireAdmin } from '@/lib/auth';
import {
  getProjectById,
  getProjectDocuments,
  getProjectMembers,
  getProjectQuizSets,
  getRetakeRequestsForProject,
} from '@/lib/data';
import { formatDate } from '@/lib/utils';

export default async function AdminProjectDetailPage({ params }: { params: { id: string } }) {
  const { userId } = await requireAdmin();

  const [project, documents, members, sets, retakeRequests] = await Promise.all([
    getProjectById(params.id),
    getProjectDocuments(params.id),
    getProjectMembers(params.id),
    getProjectQuizSets(params.id),
    getRetakeRequestsForProject(params.id),
  ]);

  const recentDocs = documents.slice(0, 5);

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-slate-500">
        <Link href="/admin/projects" className="transition hover:text-slate-900">
          Projects
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
          <Link href={`/admin/projects/${params.id}/chat`}>
            <Button size="sm" variant="secondary">
              <MessageSquare className="h-3.5 w-3.5" />
              Chat
            </Button>
          </Link>
          <Link href={`/admin/projects/${params.id}/members`}>
            <Button size="sm" variant="secondary">
              <Users className="h-3.5 w-3.5" />
              Members
            </Button>
          </Link>
          <Link href={`/admin/projects/${params.id}/quiz`}>
            <Button size="sm" variant="secondary">
              <BookOpen className="h-3.5 w-3.5" />
              Quiz
            </Button>
          </Link>
          <Link href={`/admin/projects/${params.id}/analytics`}>
            <Button size="sm" variant="secondary">
              <BarChart3 className="h-3.5 w-3.5" />
              Analytics
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Documents', value: documents.length },
          { label: 'Members', value: members.length },
          { label: 'Quiz sets', value: sets.length },
          { label: 'Pass threshold', value: `${project?.pass_threshold ?? 60}%` },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                {stat.label}
              </p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                {stat.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

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
                className="text-xs font-medium text-brand-700 transition hover:underline"
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
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50">
                      <FileText className="h-3.5 w-3.5 text-brand-500" />
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
