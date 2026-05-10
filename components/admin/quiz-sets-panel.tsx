'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Pencil, Trash2, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SubmitButton } from '@/components/ui/submit-button';
import { Textarea } from '@/components/ui/textarea';

interface Question {
  id: string;
  question_text: string;
  question_type: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: string;
  explanation: string | null;
  marks: number;
}

interface QuizSet {
  id: string;
  set_name: string;
  set_number: number;
  category: string;
  is_active: boolean;
  questions: Question[];
}

interface QuizSetsPanelProps {
  projectId: string;
  sets: QuizSet[];
  deleteAction: (formData: FormData) => Promise<void>;
  addQuestionAction: (formData: FormData) => Promise<void>;
  updateQuestionAction: (formData: FormData) => Promise<void>;
  deleteQuestionAction: (formData: FormData) => Promise<void>;
  toggleSetActiveAction: (formData: FormData) => Promise<void>;
  importCsvAction: (formData: FormData) => Promise<void>;
}

function categoryColor(category: string) {
  switch (category?.toLowerCase()) {
    case 'functional': return 'bg-blue-50 text-blue-700';
    case 'technical':  return 'bg-violet-50 text-violet-700';
    default:           return 'bg-slate-100 text-slate-600';
  }
}

function categoryLabel(category: string) {
  if (!category) return 'Other';
  return category.charAt(0).toUpperCase() + category.slice(1);
}


interface AddEditFormProps {
  projectId: string;
  quizSetId: string;
  question?: Question;
  action: (formData: FormData) => Promise<void>;
  onClose: () => void;
}

function AddEditQuestionForm({ projectId, quizSetId, question, action, onClose }: AddEditFormProps) {
  const [qType, setQType] = useState<'mcq' | 'true_false'>(
    (question?.question_type as 'mcq' | 'true_false') ?? 'mcq',
  );
  const isTF = qType === 'true_false';

  return (
    <form
      action={action}
      className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/50 p-4 lg:grid-cols-2"
      onSubmit={() => onClose()}
    >
      <input name="project_id" type="hidden" value={projectId} />
      <input name="quiz_set_id" type="hidden" value={quizSetId} />
      {question && <input name="question_id" type="hidden" value={question.id} />}

      {/* Question type selector */}
      <div className="lg:col-span-2 flex items-center gap-3">
        <label className="text-sm font-medium text-slate-700">Type</label>
        <select
          name="question_type"
          value={qType}
          onChange={(e) => setQType(e.target.value as 'mcq' | 'true_false')}
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-200"
        >
          <option value="mcq">Multiple Choice (MCQ)</option>
          <option value="true_false">True / False</option>
        </select>
      </div>

      {/* Question text */}
      <div className="lg:col-span-2">
        <Textarea
          name="question_text"
          placeholder="Question text"
          defaultValue={question?.question_text}
          required
          rows={2}
        />
      </div>

      {isTF ? (
        <>
          {/* T/F: fixed options, hidden */}
          <input name="option_a" type="hidden" value="True" />
          <input name="option_b" type="hidden" value="False" />
          <input name="option_c" type="hidden" value="" />
          <input name="option_d" type="hidden" value="" />
          <div className="lg:col-span-2 flex items-center gap-4 text-sm text-slate-600">
            <span className="rounded-lg bg-white border border-slate-200 px-3 py-2">A: True</span>
            <span className="rounded-lg bg-white border border-slate-200 px-3 py-2">B: False</span>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Correct answer</label>
            <select
              name="correct_option"
              defaultValue={question?.correct_option ?? 'A'}
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-200"
            >
              <option value="A">A (True)</option>
              <option value="B">B (False)</option>
            </select>
          </div>
          <input name="marks" type="hidden" value="1" />
        </>
      ) : (
        <>
          <Input name="option_a" placeholder="Option A" defaultValue={question?.option_a} required />
          <Input name="option_b" placeholder="Option B" defaultValue={question?.option_b} required />
          <Input name="option_c" placeholder="Option C" defaultValue={question?.option_c} required />
          <Input name="option_d" placeholder="Option D" defaultValue={question?.option_d} required />
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Correct answer</label>
            <select
              name="correct_option"
              defaultValue={question?.correct_option ?? 'A'}
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-200"
            >
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
              <option value="D">D</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Marks</label>
            <Input
              name="marks"
              type="number"
              min={1}
              max={5}
              defaultValue={question?.marks ?? 2}
            />
          </div>
        </>
      )}

      <div className="lg:col-span-2">
        <Textarea
          name="explanation"
          placeholder="Explanation (optional)"
          defaultValue={question?.explanation ?? ''}
          rows={2}
        />
      </div>

      <div className="flex gap-2 lg:col-span-2">
        <SubmitButton className="lg:w-fit" loadingText="Saving…">
          {question ? 'Save changes' : 'Add question'}
        </SubmitButton>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
      </div>
    </form>
  );
}

export function QuizSetsPanel({
  projectId,
  sets,
  deleteAction,
  addQuestionAction,
  updateQuestionAction,
  deleteQuestionAction,
  toggleSetActiveAction,
  importCsvAction,
}: QuizSetsPanelProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {sets.map((set) => {
        const isOpen = expanded === set.id;
        const isAdding = addingTo === set.id;
        const tagClasses = categoryColor(set.category);

        return (
          <Card key={set.id} className="overflow-hidden">
            <CardHeader className="py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold ${tagClasses}`}>
                    {categoryLabel(set.category)}
                  </span>
                  <CardTitle className="truncate text-base">{set.set_name}</CardTitle>
                  <span className="shrink-0 text-sm text-slate-400">{set.questions.length} q</span>
                  <Badge variant={set.is_active ? 'success' : 'warning'}>
                    {set.is_active ? 'Active' : 'Draft'}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  {/* Activate / Deactivate */}
                  <form action={toggleSetActiveAction}>
                    <input type="hidden" name="set_id" value={set.id} />
                    <input type="hidden" name="project_id" value={projectId} />
                    <input type="hidden" name="next_active" value={String(!set.is_active)} />
                    <SubmitButton
                      size="sm"
                      variant={set.is_active ? 'secondary' : 'primary'}
                      loadingText={set.is_active ? 'Deactivating…' : 'Activating…'}
                    >
                      {set.is_active ? 'Deactivate' : 'Activate'}
                    </SubmitButton>
                  </form>

                  {/* Delete set */}
                  <form action={deleteAction}>
                    <input type="hidden" name="set_id" value={set.id} />
                    <input type="hidden" name="project_id" value={projectId} />
                    <SubmitButton
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600"
                      onClick={(e) => {
                        if (!confirm(`Delete "${set.set_name}" and all ${set.questions.length} questions? This cannot be undone.`)) {
                          e.preventDefault();
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </SubmitButton>
                  </form>

                  {/* Expand / collapse */}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    onClick={() => setExpanded(isOpen ? null : set.id)}
                  >
                    {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </CardHeader>

            {isOpen && (
              <CardContent className="space-y-4 border-t border-slate-100 pt-4">
                {/* Questions list */}
                {set.questions.length > 0 ? (
                  <div className="space-y-2">
                    {set.questions.map((q, index) => {
                      const isEditing = editingQuestion === q.id;
                      const isTF = q.question_type === 'true_false';

                      return (
                        <div key={q.id} className="rounded-xl border border-slate-100 bg-slate-50">
                          {isEditing ? (
                            <div className="p-3">
                              <AddEditQuestionForm
                                projectId={projectId}
                                quizSetId={set.id}
                                question={q}
                                action={updateQuestionAction}
                                onClose={() => setEditingQuestion(null)}
                              />
                            </div>
                          ) : (
                            <div className="flex items-start gap-3 px-4 py-3">
                              <span className="mt-0.5 shrink-0 text-xs font-semibold text-slate-400">{index + 1}.</span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-sm font-medium text-slate-900">{q.question_text}</p>
                                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${isTF ? 'bg-amber-50 text-amber-700' : 'bg-sky-50 text-sky-700'}`}>
                                    {isTF ? 'T/F' : 'MCQ'}
                                  </span>
                                </div>
                                {isTF ? (
                                  <div className="mt-1.5 flex gap-4 text-xs text-slate-500">
                                    <span>A: True</span>
                                    <span>B: False</span>
                                  </div>
                                ) : (
                                  <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-slate-500">
                                    <span>A: {q.option_a}</span>
                                    <span>B: {q.option_b}</span>
                                    <span>C: {q.option_c}</span>
                                    <span>D: {q.option_d}</span>
                                  </div>
                                )}
                                <p className="mt-1 text-xs font-semibold text-emerald-600">
                                  Correct: {q.correct_option} · {q.marks} mark{q.marks !== 1 ? 's' : ''}
                                </p>
                                {q.explanation && (
                                  <p className="mt-1 text-xs text-slate-400 italic">{q.explanation}</p>
                                )}
                              </div>
                              <div className="flex shrink-0 items-center gap-1">
                                {/* Edit */}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 text-slate-400 hover:text-brand-700"
                                  onClick={() => setEditingQuestion(q.id)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                {/* Delete question */}
                                <form action={deleteQuestionAction}>
                                  <input type="hidden" name="question_id" value={q.id} />
                                  <input type="hidden" name="project_id" value={projectId} />
                                  <SubmitButton
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600"
                                    onClick={(e) => {
                                      if (!confirm('Delete this question? This cannot be undone.')) {
                                        e.preventDefault();
                                      }
                                    }}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </SubmitButton>
                                </form>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">No questions in this set yet.</p>
                )}

                {/* Add question toggle */}
                {!isAdding && (
                  <Button
                    size="sm"
                    type="button"
                    variant="secondary"
                    onClick={() => { setAddingTo(set.id); setEditingQuestion(null); }}
                  >
                    + Add question
                  </Button>
                )}

                {isAdding && (
                  <>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-700">New question</p>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 text-slate-400"
                        onClick={() => setAddingTo(null)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <AddEditQuestionForm
                      projectId={projectId}
                      quizSetId={set.id}
                      action={addQuestionAction}
                      onClose={() => setAddingTo(null)}
                    />
                  </>
                )}

                {/* CSV import */}
                <details className="rounded-xl border border-slate-100">
                  <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900">
                    Import questions via CSV
                  </summary>
                  <form action={importCsvAction} className="space-y-3 px-4 pb-4 pt-2">
                    <input name="project_id" type="hidden" value={projectId} />
                    <input name="quiz_set_id" type="hidden" value={set.id} />
                    <p className="text-xs text-slate-400">
                      Columns: question_text, option_a, option_b, option_c, option_d, correct_option, explanation, marks
                    </p>
                    <Textarea name="csv_text" placeholder="Paste CSV rows here…" rows={4} />
                    <SubmitButton size="sm" variant="secondary" loadingText="Importing…">Import</SubmitButton>
                  </form>
                </details>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
