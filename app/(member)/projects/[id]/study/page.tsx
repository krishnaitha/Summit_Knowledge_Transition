import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { redirect } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { requireMember } from '@/lib/auth';
import { getInteractiveStudyGuide, getProjectById, userHasProjectAccess } from '@/lib/data';

export default async function ProjectStudyModePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { profile } = await requireMember();
  const canAccess = await userHasProjectAccess(profile!.id, profile?.role, params.id);

  if (!canAccess) {
    redirect('/dashboard');
  }

  const [project, guide] = await Promise.all([
    getProjectById(params.id),
    getInteractiveStudyGuide(profile!.id, params.id),
  ]);

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1.5 text-sm text-slate-500">
        <Link href="/dashboard" className="transition hover:text-slate-900">
          Dashboard
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href={`/projects/${params.id}`} className="transition hover:text-slate-900">
          {project?.name ?? 'Project'}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-slate-900">Study Mode</span>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Personalized Study Guide</h1>
          <p className="mt-1 text-sm text-slate-500">
            Interactive weak-area review based on your latest quiz attempt.
          </p>
        </div>
        <Link href={`/projects/${params.id}/flashcards`}>
          <Button variant="secondary">Open Flashcards</Button>
        </Link>
      </div>

      {!guide || guide.recommendations.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-slate-600">
            No coaching plan yet. Complete a quiz attempt first to unlock personalized study mode.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Weak Sections</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {guide.weakSections.map((section) => (
                <Badge key={section.section} variant="warning">
                  {section.section.charAt(0).toUpperCase() + section.section.slice(1)}{' '}
                  {Math.round(section.percentage)}%
                </Badge>
              ))}
            </CardContent>
          </Card>

          {guide.recommendations.map((item) => (
            <Card key={item.section}>
              <CardHeader>
                <CardTitle>
                  {item.section.charAt(0).toUpperCase() + item.section.slice(1)} Focus
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-slate-700">{item.focus}</p>

                {item.documents.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {item.documents.map((doc) => (
                      <a
                        key={doc.id}
                        href={`/api/documents/view?documentId=${doc.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Badge variant="info">{doc.name}</Badge>
                      </a>
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  {item.chunkReferences.length ? (
                    item.chunkReferences.map((ref) => (
                      <div
                        key={ref.chunkId}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                      >
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <p className="text-xs font-medium tracking-wider text-slate-500 uppercase">
                            {ref.documentName} • Chunk {ref.chunkIndex + 1}
                          </p>
                          <a
                            href={`/api/documents/view?documentId=${ref.documentId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-medium text-blue-700 hover:underline"
                          >
                            Open source
                          </a>
                        </div>
                        <p className="text-sm text-slate-700">{ref.snippet}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">
                      No chunk matches found for this section yet.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
