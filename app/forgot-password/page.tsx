import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';

export default function ForgotPasswordPage() {
  return (
    <main className="bg-hero-grid min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center gap-12 px-4 py-16 sm:px-6 lg:flex-row lg:gap-20 lg:px-8">
        <div className="flex-1 space-y-6 text-center text-white lg:text-left">
          <p className="text-accent-300 text-xs font-semibold tracking-[0.3em] uppercase">
            NexTElevate
          </p>
          <h1 className="text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
            Forgot your
            <br />
            password?
          </h1>
          <p className="max-w-md text-base leading-relaxed text-slate-300">
            No worries — enter your email and we&apos;ll send you a secure link to set a new one.
          </p>
        </div>

        <div className="w-full max-w-sm shrink-0 lg:max-w-md">
          <ForgotPasswordForm />
        </div>
      </div>
    </main>
  );
}
