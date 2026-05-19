'use client';

import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { AuthProvider } from '@/lib/auth/features';

interface LoginFormProps {
  provider: AuthProvider;
  hasForgotPassword: boolean;
  hasRegistration: boolean;
  oidcProviderId?: string;
}

const COGNITO_ERROR_MESSAGES: Record<string, string> = {
  OAuthCallback: 'Sign-in failed. Please check your SSO configuration and try again.',
  AccessDenied: 'Your account is not authorised to access this application.',
  Configuration: 'Server configuration error. Contact your administrator.',
};

const OIDC_ERROR_MESSAGES: Record<string, string> = {
  OAuthCallback: 'Sign-in failed. Please check your identity provider configuration and try again.',
  AccessDenied: 'Your account is not authorised to access this application.',
  Configuration: 'Server configuration error. Contact your administrator.',
};

function OidcLoginForm({ oidcProviderId }: { oidcProviderId: string }) {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') ?? '/dashboard';
  const error = searchParams.get('error');
  const signedOut = searchParams.get('signedout') === '1';

  useEffect(() => {
    if (error || signedOut) return;
    signIn(oidcProviderId, { callbackUrl });
  }, [callbackUrl, error, oidcProviderId, signedOut]);

  return (
    <div className="w-full rounded-2xl bg-white p-8 shadow-2xl ring-1 ring-black/5">
      <div className="bg-brand-700 mb-4 flex h-10 w-10 items-center justify-center rounded-xl">
        <span className="text-sm font-bold text-white">N</span>
      </div>
      {error ? (
        <div className="space-y-4">
          <p className="text-sm text-red-600">
            {OIDC_ERROR_MESSAGES[error] ?? 'An unexpected error occurred. Please try again.'}
          </p>
          <button
            onClick={() => signIn(oidcProviderId, { callbackUrl })}
            className="bg-brand-700 hover:bg-brand-800 w-full rounded-lg px-4 py-2 text-sm font-medium text-white"
          >
            Try again
          </button>
        </div>
      ) : signedOut ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">You have been signed out.</p>
          <button
            onClick={() =>
              signIn(oidcProviderId, { callbackUrl: '/dashboard' }, { prompt: 'login' })
            }
            className="bg-brand-700 hover:bg-brand-800 w-full rounded-lg px-4 py-2 text-sm font-medium text-white"
          >
            Sign in again
          </button>
        </div>
      ) : (
        <p className="text-sm text-slate-600">Redirecting to identity provider…</p>
      )}
    </div>
  );
}

function CognitoLoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') ?? '/dashboard';
  const error = searchParams.get('error');
  const signedOut = searchParams.get('signedout') === '1';

  useEffect(() => {
    // Do not auto-redirect on error — prevents infinite loop where NextAuth
    // bounces back to /login?error=... and the effect fires again immediately.
    // Do not auto-redirect after explicit logout — user must click to re-authenticate.
    if (error || signedOut) return;
    signIn('cognito', { callbackUrl });
  }, [callbackUrl, error, signedOut]);

  return (
    <div className="w-full rounded-2xl bg-white p-8 shadow-2xl ring-1 ring-black/5">
      <div className="bg-brand-700 mb-4 flex h-10 w-10 items-center justify-center rounded-xl">
        <span className="text-sm font-bold text-white">N</span>
      </div>
      {error ? (
        <div className="space-y-4">
          <p className="text-sm text-red-600">
            {COGNITO_ERROR_MESSAGES[error] ?? 'An unexpected error occurred. Please try again.'}
          </p>
          <button
            onClick={() => signIn('cognito', { callbackUrl })}
            className="bg-brand-700 hover:bg-brand-800 w-full rounded-lg px-4 py-2 text-sm font-medium text-white"
          >
            Try again
          </button>
        </div>
      ) : signedOut ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">You have been signed out.</p>
          <button
            onClick={() => signIn('cognito', { callbackUrl: '/dashboard' }, { prompt: 'login' })}
            className="bg-brand-700 hover:bg-brand-800 w-full rounded-lg px-4 py-2 text-sm font-medium text-white"
          >
            Sign in again
          </button>
        </div>
      ) : (
        <p className="text-sm text-slate-600">Redirecting to identity provider…</p>
      )}
    </div>
  );
}

function CredentialsLoginForm({
  hasForgotPassword,
  hasRegistration,
}: {
  hasForgotPassword: boolean;
  hasRegistration: boolean;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleLogin = () => {
    if (!email || !password) {
      setMessage('Please enter your email and password.');
      return;
    }

    startTransition(async () => {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setMessage('Invalid email or password. Please try again.');
        return;
      }

      window.location.href = '/dashboard';
    });
  };

  return (
    <div className="w-full rounded-2xl bg-white p-8 shadow-2xl ring-1 ring-black/5">
      {/* Header */}
      <div className="mb-6">
        <div className="bg-brand-700 mb-4 flex h-10 w-10 items-center justify-center rounded-xl">
          <span className="text-sm font-bold text-white">N</span>
        </div>
        <h2 className="text-xl font-semibold text-slate-900">Sign in to NexTElevate</h2>
        <p className="mt-1 text-sm text-slate-500">
          Use your work email to continue to your KT projects.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700" htmlFor="email">
            Work email
          </label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            autoComplete="email"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-slate-700" htmlFor="password">
              Password
            </label>
            {hasForgotPassword && (
              <Link
                href="/forgot-password"
                className="text-brand-700 text-xs font-medium hover:underline"
              >
                Forgot password?
              </Link>
            )}
          </div>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleLogin();
            }}
          />
        </div>

        {message && (
          <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">{message}</p>
        )}

        <Button className="w-full" disabled={isPending} onClick={handleLogin} type="button">
          {isPending ? 'Signing in…' : 'Sign in'}
        </Button>

        {hasRegistration && (
          <p className="pt-1 text-center text-sm text-slate-500">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-brand-700 font-medium hover:underline">
              Create one
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}

export function LoginForm({
  provider,
  hasForgotPassword,
  hasRegistration,
  oidcProviderId,
}: LoginFormProps) {
  if (provider === 'cognito') {
    return <CognitoLoginForm />;
  }

  if (provider === 'oidc') {
    return <OidcLoginForm oidcProviderId={oidcProviderId ?? 'oidc'} />;
  }

  return (
    <CredentialsLoginForm hasForgotPassword={hasForgotPassword} hasRegistration={hasRegistration} />
  );
}
