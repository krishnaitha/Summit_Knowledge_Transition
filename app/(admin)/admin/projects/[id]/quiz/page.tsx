import Link from 'next/link';
import { BookOpen, ChevronRight } from 'lucide-react';

import { createQuizQuestionAction, createQuizSetAction, deleteQuizQuestionAction, deleteQuizSetAction, importQuizCsvAction, toggleQuizSetActiveAction, updateQuizQuestionAction } from '@/app/actions/admin';
import { QuizGenerator } from '@/components/admin/quiz-generator';
import { QuizSetsPanel } from '@/components/admin/quiz-sets-panel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SubmitButton } from '@/components/ui/submit-button';
import { getProjectById, getProjectQuizSets } from '@/lib/data';

export default async function ProjectQuizAdminPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const [project, sets] = await Promise.all([
    getProjectById(params.id),
    getProjectQuizSets(params.id),
  ]);

  const totalQuestions = sets.reduce((sum, s) => sum + s.questions.length, 0);

  return (
    <div className="space-y-8">
      <nav className="flex items-center gap-1.5 text-sm text-slate-500">
        <Link href="/admin/projects" className="transition hover:text-slate-900">Projects</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href={`/admin/projects/${params.id}`} className="transition hover:text-slate-900">{project?.name ?? 'Project'}</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-slate-900">Quiz</span>
      </nav>

      {/* Existing sets */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Quiz sets</h2>
            <p className="text-sm text-slate-500">
              {sets.length === 0
                ? 'No sets yet — generate or create one below.'
                : `${sets.length} set${sets.length !== 1 ? 's' : ''} · ${totalQuestions} questions total`}
            </p>
          </div>
          {sets.length > 0 && (() => {
            const categoryCounts: Record<string, number> = {};
            for (const s of sets) {
              const cat = s.category ?? 'general';
              categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 1;
            }
            const activeSets = sets.filter((s) => s.is_active).length;
            return (
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-2 rounded-xl bg-brand-50 px-4 py-2 text-sm font-medium text-brand-700">
                  <BookOpen className="h-4 w-4" />
                  {Object.entries(categoryCounts).map(([cat, n]) => `${n} ${cat}`).join(' · ')}
                </div>
                {activeSets === 0 && (
                  <p className="text-xs font-medium text-amber-600">
                    ⚠ No active sets — activate at least one set so members can take the quiz.
                  </p>
                )}
              </div>
            );
          })()}
        </div>

        {sets.length > 0 ? (
          <QuizSetsPanel
            projectId={params.id}
            sets={sets}
            deleteAction={deleteQuizSetAction}
            addQuestionAction={createQuizQuestionAction}
            updateQuestionAction={updateQuizQuestionAction}
            deleteQuestionAction={deleteQuizQuestionAction}
            toggleSetActiveAction={toggleQuizSetActiveAction}
            importCsvAction={importQuizCsvAction}
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-12 text-center">
            <BookOpen className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm text-slate-500">No quiz sets have been created yet.</p>
            <p className="mt-1 text-xs text-slate-400">Use the AI generator below or create a set manually.</p>
          </div>
        )}
      </div>

      {/* Generate */}
      <QuizGenerator projectId={params.id} />

      {/* Manual create */}
      <Card>
        <CardHeader>
          <CardTitle>Create quiz set manually</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createQuizSetAction} className="grid gap-4 md:grid-cols-4">
            <input name="project_id" type="hidden" value={params.id} />
            <Input name="set_name" placeholder="Set name" required />
            <Input name="category" placeholder="Category (e.g. functional)" required />
            <Input name="set_number" placeholder="Set number" required type="number" />
            <SubmitButton className="md:w-fit" loadingText="Creating…">Create set</SubmitButton>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
