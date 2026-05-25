import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

import {
  deleteUserMemoryAction,
  getUserMemoriesForCurrentUser,
  saveUserMemoryAction,
} from '@/app/actions/memory';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SubmitButton } from '@/components/ui/submit-button';
import { requireMember } from '@/lib/auth';

export default async function MemoryPage() {
  await requireMember();
  const memories = await getUserMemoriesForCurrentUser();

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1.5 text-sm text-slate-500">
        <Link href="/dashboard" className="transition hover:text-slate-900">
          Dashboard
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-slate-900">Memory</span>
      </nav>

      <Card>
        <CardHeader>
          <CardTitle>Persistent User Memory</CardTitle>
          <p className="text-sm text-slate-500">
            Save reusable preferences and facts. The chatbot can apply these in future sessions when
            relevant.
          </p>
        </CardHeader>
        <CardContent>
          <form
            action={saveUserMemoryAction}
            className="grid gap-3 rounded-xl border border-slate-200 p-4"
          >
            <div className="grid gap-3 md:grid-cols-2">
              <input
                name="memory_key"
                placeholder="memory key (e.g. response_style)"
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                required
              />
              <input
                name="tags"
                placeholder="tags (comma separated)"
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <textarea
              name="memory_value"
              placeholder="memory value"
              className="min-h-20 rounded-xl border border-slate-300 px-3 py-2 text-sm"
              required
            />
            <div className="grid gap-3 md:grid-cols-[220px_1fr] md:items-center">
              <input
                name="confidence"
                type="number"
                step="0.05"
                min="0"
                max="1"
                defaultValue="0.8"
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
              <p className="text-xs text-slate-500">
                Confidence is between 0 and 1. Higher values are prioritized during retrieval.
              </p>
            </div>
            <div>
              <SubmitButton loadingText="Saving...">Save Memory</SubmitButton>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {memories.length ? (
          memories.map((memory) => (
            <Card key={memory.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{memory.memory_key}</p>
                  <p className="text-xs text-slate-500">
                    confidence {memory.confidence.toFixed(2)}
                  </p>
                </div>
                <p className="text-sm text-slate-700">{memory.memory_value}</p>
                <p className="text-xs text-slate-500">
                  tags: {(memory.tags ?? []).join(', ') || 'none'}
                </p>

                <form
                  action={saveUserMemoryAction}
                  className="grid gap-2 rounded-lg border border-slate-200 p-3"
                >
                  <input type="hidden" name="memory_key" value={memory.memory_key} />
                  <textarea
                    name="memory_value"
                    defaultValue={memory.memory_value}
                    className="min-h-16 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    required
                  />
                  <div className="grid gap-2 md:grid-cols-2">
                    <input
                      name="tags"
                      defaultValue={(memory.tags ?? []).join(', ')}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                    <input
                      name="confidence"
                      type="number"
                      step="0.05"
                      min="0"
                      max="1"
                      defaultValue={memory.confidence}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <SubmitButton loadingText="Updating..." size="sm" variant="secondary">
                      Update
                    </SubmitButton>
                  </div>
                </form>

                <form action={deleteUserMemoryAction}>
                  <input type="hidden" name="memory_id" value={memory.id} />
                  <SubmitButton loadingText="Deleting..." size="sm" variant="danger">
                    Delete
                  </SubmitButton>
                </form>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="p-6 text-sm text-slate-500">
              No memory entries yet. Use &quot;remember ...&quot; in chat or create one manually
              above.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
