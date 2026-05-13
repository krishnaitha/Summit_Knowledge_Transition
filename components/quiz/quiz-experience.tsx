'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { AlertCircle, CheckCircle2, Clock, Maximize2, ShieldAlert } from 'lucide-react';

import { QuestionView, type QuizQuestionViewModel } from '@/components/quiz/question-view';
import { QuizCard } from '@/components/quiz/quiz-card';
import { ResultSummary } from '@/components/quiz/result-summary';
import { RetakeRequestButton } from '@/components/quiz/retake-request-button';
import { Button } from '@/components/ui/button';

const SECTION_DURATION = 900; // 15 minutes in seconds

interface QuizSection {
  name: string;
  durationSeconds: number;
  questions: QuizQuestionViewModel[];
}

interface QuizResult {
  score: number;
  totalMarks: number;
  percentage: number;
  disqualified?: boolean;
  disqualifyReason?: string | null;
}

type Phase = 'start' | 'in_section' | 'section_done' | 'submitting' | 'submitted';

interface QuizExperienceProps {
  projectId: string;
  projectName: string;
  lockedAttempt?: QuizResult | null;
  hasPendingRetakeRequest?: boolean;
}

export function QuizExperience({
  projectId,
  projectName,
  lockedAttempt,
  hasPendingRetakeRequest = false,
}: QuizExperienceProps) {
  // Quiz flow state
  const [phase, setPhase] = useState<Phase>('start');
  const [sections, setSections] = useState<QuizSection[]>([]);
  const [currentSectionIdx, setCurrentSectionIdx] = useState(0);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, 'A' | 'B' | 'C' | 'D'>>({});
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [result, setResult] = useState<QuizResult | null>(lockedAttempt ?? null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Start screen
  const [confirmed, setConfirmed] = useState(false);
  const [checkboxWarning, setCheckboxWarning] = useState(false);

  // Timer
  const [timeLeft, setTimeLeft] = useState(SECTION_DURATION);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Anti-cheating
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [showTabWarning, setShowTabWarning] = useState(false);
  const [showFullscreenWarning, setShowFullscreenWarning] = useState(false);

  // Refs to avoid stale closures in timer/event callbacks
  const phaseRef = useRef<Phase>('start');
  const answersRef = useRef<Record<string, 'A' | 'B' | 'C' | 'D'>>({});
  const attemptIdRef = useRef<string | null>(null);
  const sectionsRef = useRef<QuizSection[]>([]);
  const currentSectionIdxRef = useRef(0);
  const tabSwitchCountRef = useRef(0);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);
  useEffect(() => {
    attemptIdRef.current = attemptId;
  }, [attemptId]);
  useEffect(() => {
    sectionsRef.current = sections;
  }, [sections]);
  useEffect(() => {
    currentSectionIdxRef.current = currentSectionIdx;
  }, [currentSectionIdx]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
      .toString()
      .padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  // ── Submit ──────────────────────────────────────────────────────────────
  const submitQuiz = useCallback(
    async (
      finalAnswers: Record<string, 'A' | 'B' | 'C' | 'D'>,
      id: string,
      disqualified = false,
      disqualifyReason = '',
    ) => {
      setPhase('submitting');
      try {
        const res = await fetch('/api/quiz/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            attemptId: id,
            answers: finalAnswers,
            disqualified,
            disqualifyReason,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? 'Unable to submit quiz.');
          setPhase('in_section');
          return;
        }
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        setResult(data);
        setPhase('submitted');
      } catch {
        setError('Network error — please try again.');
        setPhase('in_section');
      }
    },
    [projectId],
  );

  // ── Timer expiry handler (uses refs — no stale closure) ─────────────────
  const handleTimerExpiry = useCallback(() => {
    const sectionIdx = currentSectionIdxRef.current;
    const allSections = sectionsRef.current;
    if (sectionIdx < allSections.length - 1) {
      setCurrentSectionIdx(sectionIdx + 1);
      setCurrentQuestionIdx(0);
      setPhase('section_done');
    } else {
      submitQuiz(answersRef.current, attemptIdRef.current ?? '');
    }
  }, [submitQuiz]);

  // ── Timer effect — starts fresh whenever entering a section ─────────────
  useEffect(() => {
    if (phase !== 'in_section') {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    setTimeLeft(SECTION_DURATION);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setTimeout(() => handleTimerExpiry(), 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase, currentSectionIdx, handleTimerExpiry]);

  // ── Tab-switch detection ────────────────────────────────────────────────
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && phaseRef.current === 'in_section') {
        tabSwitchCountRef.current += 1;
        setTabSwitchCount(tabSwitchCountRef.current);

        if (tabSwitchCountRef.current >= 2) {
          // Second violation — auto-fail immediately
          if (timerRef.current) clearInterval(timerRef.current);
          submitQuiz(
            answersRef.current,
            attemptIdRef.current ?? '',
            true,
            'Switched tabs more than once during the assessment.',
          );
        } else {
          // First violation — warn and allow resume
          setShowTabWarning(true);
        }
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [submitQuiz]);

  // ── Fullscreen-exit detection ───────────────────────────────────────────
  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement && phaseRef.current === 'in_section') {
        setShowFullscreenWarning(true);
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // ── Start quiz ──────────────────────────────────────────────────────────
  const startQuiz = () => {
    if (!confirmed) {
      setCheckboxWarning(true);
      return;
    }
    setCheckboxWarning(false);
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/quiz/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId }),
        });
        const data = await res.json();
        if (!res.ok) {
          if (data.attempt) {
            setResult(data.attempt);
            return;
          }
          setError(data.error ?? 'Unable to start quiz.');
          return;
        }
        if (!data.sections?.[0]?.questions?.length) {
          setError('No quiz questions found. Ask your admin to add questions first.');
          return;
        }
        setSections(data.sections);
        setAttemptId(data.attemptId);
        setCurrentSectionIdx(0);
        setCurrentQuestionIdx(0);
        setAnswers({});
        try {
          await document.documentElement.requestFullscreen();
        } catch {}
        setPhase('in_section');
      } catch {
        setError('Network error — please try again.');
      }
    });
  };

  // ── Advance question / section ──────────────────────────────────────────
  const advance = () => {
    const section = sections[currentSectionIdx];
    if (!section) return;
    if (currentQuestionIdx < section.questions.length - 1) {
      setCurrentQuestionIdx((i) => i + 1);
    } else if (currentSectionIdx < sections.length - 1) {
      // End of functional → go to between-sections screen
      if (timerRef.current) clearInterval(timerRef.current);
      setCurrentSectionIdx(currentSectionIdx + 1);
      setCurrentQuestionIdx(0);
      setPhase('section_done');
    } else {
      // End of last section → submit
      if (timerRef.current) clearInterval(timerRef.current);
      submitQuiz(answers, attemptId ?? '');
    }
  };

  // ==================== RENDER =============================================

  // Already submitted (page-load locked attempt or just submitted)
  if (result || phase === 'submitted') {
    return (
      <div className="space-y-6">
        {result && (
          <ResultSummary
            score={result.score}
            totalMarks={result.totalMarks}
            percentage={result.percentage}
            disqualified={result.disqualified}
            disqualifyReason={result.disqualifyReason}
          />
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/dashboard">
            <Button>Back to Dashboard</Button>
          </Link>
          <RetakeRequestButton projectId={projectId} hasPendingRequest={hasPendingRetakeRequest} />
        </div>
      </div>
    );
  }

  // Submitting spinner
  if (phase === 'submitting') {
    return (
      <QuizCard title={`${projectName} — Readiness Quiz`} description="Submitting your answers…">
        <div className="flex items-center justify-center gap-3 py-8 text-slate-500">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-accent-400 border-t-transparent" />
          <span className="text-sm">Saving your results…</span>
        </div>
      </QuizCard>
    );
  }

  // Between-sections transition
  if (phase === 'section_done') {
    const nextSection = sections[currentSectionIdx];
    return (
      <QuizCard
        title="Functional section complete"
        description="Your answers have been saved. Start the Technical section when you're ready."
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 p-4">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            <div>
              <p className="font-semibold text-emerald-800">Functional — done</p>
              <p className="text-xs text-emerald-700">
                {
                  Object.keys(answers).filter((id) =>
                    sections[0]?.questions.some((q) => q.questionId === id),
                  ).length
                }{' '}
                of {sections[0]?.questions.length ?? 20} questions answered
              </p>
            </div>
          </div>
          <div className="rounded-2xl bg-violet-50 p-4">
            <p className="text-sm font-semibold text-violet-900">Technical section up next</p>
            <p className="mt-0.5 text-xs text-violet-700">
              {nextSection?.questions.length ?? 20} questions · 15 minutes · timer starts
              immediately
            </p>
          </div>
          <Button onClick={() => setPhase('in_section')} type="button">
            Start Technical Section →
          </Button>
        </div>
      </QuizCard>
    );
  }

  // Start screen
  if (phase === 'start') {
    return (
      <QuizCard
        title={`${projectName} — Readiness Quiz`}
        description="Two sections: Functional and Technical. 20 questions each. 15 minutes per section."
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-blue-50 p-4">
              <p className="text-sm font-semibold text-blue-900">Functional Section</p>
              <p className="mt-1 text-xs text-blue-700">
                20 questions · 15 minutes · business processes &amp; workflows
              </p>
            </div>
            <div className="rounded-2xl bg-violet-50 p-4">
              <p className="text-sm font-semibold text-violet-900">Technical Section</p>
              <p className="mt-1 text-xs text-violet-700">
                20 questions · 15 minutes · architecture, APIs &amp; design
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-800">
            <p className="text-base font-semibold">One attempt only — read before starting</p>
            <ul className="mt-2 space-y-1 text-sm">
              <li>• You cannot go back to a previous question</li>
              <li>
                • Each section has a 15-minute countdown — it auto-advances when time runs out
              </li>
              <li>• The quiz runs in fullscreen — do not exit or switch tabs</li>
              <li>• Both sections must be completed in a single session</li>
            </ul>
          </div>

          <label
            className={`flex cursor-pointer items-start gap-3 rounded-2xl border-2 px-4 py-3 text-sm transition ${
              checkboxWarning
                ? 'border-amber-400 bg-amber-50 text-amber-900'
                : confirmed
                  ? 'border-emerald-300 bg-emerald-50 text-slate-700'
                  : 'border-slate-200 bg-slate-50 text-slate-700'
            }`}
          >
            <input
              checked={confirmed}
              className="mt-0.5 h-4 w-4 accent-brand-700"
              type="checkbox"
              onChange={(e) => {
                setConfirmed(e.target.checked);
                if (e.target.checked) setCheckboxWarning(false);
              }}
            />
            <span>
              I understand this is a one-time attempt with a 15-minute timer per section. I will not
              switch tabs or exit fullscreen during the quiz.
            </span>
          </label>

          {checkboxWarning && (
            <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Please tick the checkbox before starting.
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <Button disabled={isPending} onClick={startQuiz} type="button">
            {isPending ? 'Preparing quiz…' : 'Start Quiz'}
          </Button>
        </div>
      </QuizCard>
    );
  }

  // Active quiz section
  const section = sections[currentSectionIdx];
  const question = section?.questions[currentQuestionIdx];
  if (!section || !question) return null;

  const isFunctional = currentSectionIdx === 0;
  const isLastQuestion = currentQuestionIdx === section.questions.length - 1;
  const isLastSection = currentSectionIdx === sections.length - 1;
  const isTimeLow = timeLeft <= 120;
  const isTimeCritical = timeLeft <= 30;

  return (
    <div className="relative space-y-3">
      {/* Tab-switch warning overlay */}
      {showTabWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm">
          <div className="mx-4 max-w-sm rounded-3xl bg-white p-8 text-center shadow-2xl">
            <ShieldAlert className="mx-auto h-12 w-12 text-rose-500" />
            <h2 className="mt-4 text-xl font-bold text-slate-900">Tab switch detected</h2>
            <p className="mt-2 text-sm text-slate-600">
              You switched away from the quiz <strong>{tabSwitchCount}</strong> time
              {tabSwitchCount !== 1 ? 's' : ''}. This is recorded. Please stay on this page during
              the assessment.
            </p>
            <Button className="mt-6 w-full" onClick={() => setShowTabWarning(false)} type="button">
              Resume Quiz
            </Button>
          </div>
        </div>
      )}

      {/* Fullscreen-lost warning overlay */}
      {showFullscreenWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm">
          <div className="mx-4 max-w-sm rounded-3xl bg-white p-8 text-center shadow-2xl">
            <Maximize2 className="mx-auto h-12 w-12 text-amber-500" />
            <h2 className="mt-4 text-xl font-bold text-slate-900">Fullscreen exited</h2>
            <p className="mt-2 text-sm text-slate-600">
              This quiz should be taken in fullscreen. Please return to fullscreen to continue.
            </p>
            <Button
              className="mt-6 w-full"
              type="button"
              onClick={async () => {
                try {
                  await document.documentElement.requestFullscreen();
                } catch {}
                setShowFullscreenWarning(false);
              }}
            >
              Re-enter Fullscreen
            </Button>
          </div>
        </div>
      )}

      {/* Top bar: section badge + timer */}
      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
        <div
          className={`rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white ${isFunctional ? 'bg-blue-500' : 'bg-violet-600'}`}
        >
          {section.name}
        </div>
        <div
          className={`flex items-center gap-2 text-lg font-bold tabular-nums ${isTimeCritical ? 'text-rose-600' : isTimeLow ? 'text-amber-600' : 'text-slate-700'}`}
        >
          <Clock className={`h-5 w-5 ${isTimeCritical ? 'animate-pulse' : ''}`} />
          {formatTime(timeLeft)}
        </div>
      </div>

      {/* Question card */}
      <QuizCard
        title={`${projectName} — ${section.name} Section`}
        description={isTimeLow ? 'Less than 2 minutes remaining — answer and advance.' : ''}
      >
        <div className="space-y-6">
          <QuestionView
            currentIndex={currentQuestionIdx}
            question={question}
            selected={answers[question.questionId]}
            total={section.questions.length}
            onSelect={(value) => setAnswers((curr) => ({ ...curr, [question.questionId]: value }))}
          />

          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <Button disabled={!answers[question.questionId]} onClick={advance} type="button">
            {isLastQuestion
              ? isLastSection
                ? 'Submit Quiz'
                : `Complete ${section.name} Section →`
              : 'Next Question →'}
          </Button>
        </div>
      </QuizCard>
    </div>
  );
}
