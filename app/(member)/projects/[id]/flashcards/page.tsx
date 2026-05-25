import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { redirect } from 'next/navigation';

import { generateProjectFlashcardsAction, reviewFlashcardAction } from '@/app/actions/learning';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SubmitButton } from '@/components/ui/submit-button';
import { requireMember } from '@/lib/auth';
import { getProjectById, getProjectFlashcardsForUser, userHasProjectAccess } from '@/lib/data';
import { formatDate } from '@/lib/utils';

export default async function ProjectFlashcardsPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { profile } = await requireMember();
  const canAccess = await userHasProjectAccess(profile!.id, profile?.role, params.id);

  if (!canAccess) {
    redirect('/dashboard');
  }

  const [project, cards] = await Promise.all([
    getProjectById(params.id),
    getProjectFlashcardsForUser(params.id, profile!.id),
  ]);

  const dueCount = cards.filter((card) => card.is_due).length;

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
        <span className="font-medium text-slate-900">Flashcards</span>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">AI Flashcards</h1>
          <p className="mt-1 text-sm text-slate-500">
            Review key concepts with spaced repetition before your next quiz attempt.
          </p>
        </div>
        <Badge variant={dueCount > 0 ? 'warning' : 'neutral'}>{dueCount} due now</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generate Flashcards</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={generateProjectFlashcardsAction} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="project_id" value={params.id} />
            <label className="grid gap-1 text-sm text-slate-600">
              Number of cards
              <Input
                name="count"
                type="number"
                min={5}
                max={40}
                defaultValue={20}
                className="w-40"
              />
            </label>
            <SubmitButton loadingText="Generating…">Generate with AI</SubmitButton>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Study Queue</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {cards.length ? (
            cards.map((card) => (
              <details
                key={card.id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <summary className="cursor-pointer list-none font-semibold text-slate-900">
                  {card.question}
                  <span className="ml-2 text-xs font-medium text-slate-500">{card.difficulty}</span>
                </summary>
                <div className="mt-3 space-y-3">
                  <p className="text-sm leading-6 text-slate-700">{card.answer}</p>
                  {card.snippet && (
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <p className="text-xs font-medium tracking-wider text-slate-500 uppercase">
                        Source chunk
                      </p>
                      <p className="mt-1 text-sm text-slate-600">{card.snippet}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {card.document_name ?? 'Document'}
                        {card.chunk_index != null ? ` • Chunk ${card.chunk_index + 1}` : ''}
                      </p>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    {card.document_id && (
                      <a
                        href={`/api/documents/view?documentId=${card.document_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-700 focus:ring-accent-400 inline-flex h-9 items-center justify-center rounded-lg bg-white px-3 text-sm font-medium ring-1 ring-slate-200 transition hover:bg-slate-50 focus:ring-2 focus:ring-offset-2 focus:outline-none"
                      >
                        Open source
                      </a>
                    )}
                    <span className="text-xs text-slate-500">
                      Due {formatDate(card.due_at, true)}
                      {card.last_reviewed_at
                        ? ` • Reviewed ${formatDate(card.last_reviewed_at, true)}`
                        : ''}
                    </span>
                  </div>
                  <form action={reviewFlashcardAction} className="flex flex-wrap gap-2">
                    <input type="hidden" name="project_id" value={params.id} />
                    <input type="hidden" name="flashcard_id" value={card.id} />
                    <Button type="submit" name="rating" value="again" variant="ghost" size="sm">
                      Again
                    </Button>
                    <Button type="submit" name="rating" value="hard" variant="secondary" size="sm">
                      Hard
                    </Button>
                    <Button type="submit" name="rating" value="good" variant="secondary" size="sm">
                      Good
                    </Button>
                    <Button type="submit" name="rating" value="easy" size="sm">
                      Easy
                    </Button>
                  </form>
                </div>
              </details>
            ))
          ) : (
            <p className="text-sm text-slate-500">
              No flashcards yet. Generate a set to start reviewing.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
