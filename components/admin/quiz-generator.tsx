'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type Category = 'functional' | 'technical';

const SET_OPTIONS = [1, 2, 3, 4, 5];
const POLL_INTERVAL_MS = 3000;

export function QuizGenerator({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [category, setCategory] = useState<Category>('functional');
  const [numSets, setNumSets] = useState(3);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ createdSets: number; createdQuestions: number } | null>(
    null,
  );
  const [isPending, setIsPending] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up polling interval on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current !== null) clearInterval(pollRef.current);
    };
  }, []);

  const stopPolling = () => {
    if (pollRef.current !== null) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const startPolling = (jobId: string) => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        if (!res.ok) return;
        const job = await res.json();

        if (job.status === 'done') {
          stopPolling();
          setIsPending(false);
          const r = job.result as { createdSets?: number; createdQuestions?: number } | null;
          setResult({
            createdSets: r?.createdSets ?? 0,
            createdQuestions: r?.createdQuestions ?? 0,
          });
          router.refresh();
        } else if (job.status === 'failed') {
          stopPolling();
          setIsPending(false);
          setError(job.error ?? 'Generation failed. Please try again.');
        }
      } catch {
        // network hiccup — keep polling
      }
    }, POLL_INTERVAL_MS);
  };

  const handleGenerate = async () => {
    setError(null);
    setResult(null);
    setIsPending(true);
    stopPolling();

    const res = await fetch('/api/quiz/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, category, numSets }),
    });

    const data = await res.json();

    if (!res.ok) {
      setIsPending(false);
      setError(data.error ?? 'Generation failed. Please try again.');
      return;
    }

    // Generation queued — start polling for completion
    startPolling(data.jobId);
  };

  return (
    <Card className="border-accent-200 bg-gradient-to-br from-accent-50/60 to-white">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-500">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <CardTitle>Generate questions with AI</CardTitle>
            <p className="mt-0.5 text-xs text-slate-500">
              Groq reads your KT documents and generates medium-to-high complexity questions. Runs
              in the background — you can navigate away.
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Category */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700">Question category</p>
          <div className="flex gap-3">
            {(['functional', 'technical'] as Category[]).map((cat) => (
              <button
                key={cat}
                type="button"
                disabled={isPending}
                onClick={() => setCategory(cat)}
                className={cn(
                  'flex-1 rounded-xl border-2 px-4 py-3 text-left transition',
                  category === cat
                    ? 'border-accent-500 bg-accent-50'
                    : 'border-slate-200 bg-white hover:border-slate-300',
                  isPending && 'pointer-events-none opacity-60',
                )}
              >
                <p
                  className={cn(
                    'text-sm font-semibold capitalize',
                    category === cat ? 'text-accent-700' : 'text-slate-700',
                  )}
                >
                  {cat}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {cat === 'functional'
                    ? 'Business workflows, processes & responsibilities'
                    : 'Architecture, APIs, data models & technical design'}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Number of sets */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700">
            Number of sets <span className="font-normal text-slate-400">(10 questions each)</span>
          </p>
          <div className="flex gap-2">
            {SET_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                disabled={isPending}
                onClick={() => setNumSets(n)}
                className={cn(
                  'h-10 w-10 rounded-xl border-2 text-sm font-semibold transition',
                  numSets === n
                    ? 'border-accent-500 bg-accent-500 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
                  isPending && 'pointer-events-none opacity-60',
                )}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-400">
            Will generate {numSets * 10} questions across {numSets} set{numSets > 1 ? 's' : ''}
          </p>
        </div>

        {/* Error */}
        {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

        {/* Success */}
        {result && (
          <div className="flex items-center gap-3 rounded-xl bg-emerald-50 px-4 py-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            <p className="text-sm text-emerald-800">
              Generated <span className="font-semibold">{result.createdQuestions} questions</span>{' '}
              across <span className="font-semibold">{result.createdSets} sets</span>. Scroll down
              to review and activate them.
            </p>
          </div>
        )}

        {/* Action */}
        <Button
          disabled={isPending}
          onClick={handleGenerate}
          className="gap-2 bg-accent-600 hover:bg-accent-700"
          type="button"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating in background…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Generate {numSets * 10} {category} questions
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
