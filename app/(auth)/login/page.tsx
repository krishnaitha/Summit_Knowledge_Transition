import { BookOpen, FileText, MessageCircle, Sparkles } from 'lucide-react';
import { redirect } from 'next/navigation';

import { LoginForm } from '@/components/auth/login-form';
import { getCurrentUserContext } from '@/lib/auth';
import { authFeatures } from '@/lib/auth/features';

export default async function LoginPage() {
  const { profile } = await getCurrentUserContext();

  if (profile?.role === 'admin') redirect('/admin/dashboard');
  if (profile) redirect('/dashboard');

  return (
    <main className="bg-hero-grid min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center gap-12 px-4 py-16 sm:px-6 lg:flex-row lg:gap-20 lg:px-8">
        {/* Left — brand copy */}
        <div className="flex-1 space-y-6 text-center text-white lg:text-left">
          <p className="text-accent-300 text-xs font-semibold tracking-[0.3em] uppercase">
            NexTElevate
          </p>
          <h1 className="text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
            Structured handovers.
            <br />
            Grounded answers.
            <br />
            One-shot assessment.
          </h1>
          <p className="max-w-md text-base leading-relaxed text-slate-300">
            Centralise KT documents, get AI-assisted answers scoped to your project, and complete
            your readiness Quest — all in one controlled workspace.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2 lg:justify-start">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-sm text-slate-200 backdrop-blur-sm">
              <FileText className="text-accent-300 h-4 w-4" />
              Document search
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-sm text-slate-200 backdrop-blur-sm">
              <Sparkles className="text-accent-300 h-4 w-4" />
              AI chat
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-sm text-slate-200 backdrop-blur-sm">
              <MessageCircle className="text-accent-300 h-4 w-4" />
              Threaded discussions
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-sm text-slate-200 backdrop-blur-sm">
              <BookOpen className="text-accent-300 h-4 w-4" />
              Flashcards &amp; study mode
            </span>
          </div>
        </div>

        {/* Right — form */}
        <div className="w-full max-w-sm shrink-0 lg:max-w-md">
          <LoginForm
            provider={authFeatures.provider}
            hasForgotPassword={authFeatures.hasForgotPassword}
            hasRegistration={authFeatures.hasRegistration}
            oidcProviderId={authFeatures.oidcProviderId}
          />
        </div>
      </div>
    </main>
  );
}
