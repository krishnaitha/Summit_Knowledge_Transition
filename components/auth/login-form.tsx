'use client';

import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

const ERROR_MESSAGES: Record<string, string> = {
  OAuthCallback: 'Sign-in failed. Please check your SSO configuration and try again.',
  AccessDenied: 'Your account is not authorised to access this application.',
  Configuration: 'Server configuration error. Contact your administrator.',
};

export function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') ?? '/dashboard';
  const error = searchParams.get('error');

  useEffect(() => {
    // Do not auto-redirect if there is an error — prevents an infinite loop where
    // NextAuth bounces back to /login?error=... and the effect fires again immediately.
    if (error) return;
    signIn('cognito', { callbackUrl });
  }, [callbackUrl, error]);

  return (
    <div className="w-full rounded-2xl bg-white p-8 shadow-2xl ring-1 ring-black/5">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-700">
        <span className="text-sm font-bold text-white">S</span>
      </div>
      {error ? (
        <div className="space-y-4">
          <p className="text-sm text-red-600">
            {ERROR_MESSAGES[error] ?? 'An unexpected error occurred. Please try again.'}
          </p>
          <button
            onClick={() => signIn('cognito', { callbackUrl })}
            className="w-full rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
          >
            Try again
          </button>
        </div>
      ) : (
        <p className="text-sm text-slate-600">Redirecting to NexTurn SSO…</p>
      )}
    </div>
  );
}
