'use client';

import { type FormEvent, useRef, useState, useTransition } from 'react';
import { MessageSquarePlus } from 'lucide-react';

import { createKnowledgeGapThreadAction } from '@/app/actions/document-threads';
import { Modal } from '@/components/ui/modal';

export function KnowledgeGapThreadButton({
  query,
  projectIds,
  projectNames,
}: {
  query: string;
  projectIds: string[];
  projectNames: string[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const singleProject = projectIds.length === 1;

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(async () => {
      await createKnowledgeGapThreadAction(data);
      setDone(true);
      setOpen(false);
    });
  }

  if (done) {
    return (
      <span className="flex shrink-0 items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-2.5 py-1.5 text-xs font-medium text-green-700">
        <MessageSquarePlus className="h-3 w-3" />
        Thread created
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-900 hover:text-slate-900"
        title="Raise a discussion thread for this knowledge gap"
      >
        <MessageSquarePlus className="h-3 w-3" />
        Thread
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Create Knowledge Gap Thread">
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          <div>
            <p className="text-sm text-slate-600">
              This will open a discussion thread for the unanswered query so your team can address
              it. Once resolved, you can capture the answer as a knowledge-base document.
            </p>
          </div>

          <div className="rounded-xl border border-amber-100 bg-amber-50 p-3">
            <p className="text-xs font-medium text-amber-700">Unanswered query</p>
            <p className="mt-1 text-sm text-slate-800">{query}</p>
          </div>

          <input type="hidden" name="gap_query" value={query} />

          {singleProject ? (
            <input type="hidden" name="project_id" value={projectIds[0]} />
          ) : (
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Project
              <select
                name="project_id"
                required
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
              >
                <option value="">Select a project…</option>
                {projectIds.map((id, i) => (
                  <option key={id} value={id}>
                    {projectNames[i] ?? id}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="bg-brand-700 hover:bg-brand-800 rounded-xl px-4 py-2 text-sm font-medium text-white transition disabled:opacity-60"
            >
              {pending ? 'Creating…' : 'Create Thread'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
