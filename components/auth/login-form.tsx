"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AuthProvider } from "@/lib/auth/features";

interface LoginFormProps {
  provider: AuthProvider;
  hasForgotPassword: boolean;
  hasRegistration: boolean;
}

const COGNITO_ERROR_MESSAGES: Record<string, string> = {
  OAuthCallback:
    "Sign-in failed. Please check your SSO configuration and try again.",
  AccessDenied: "Your account is not authorised to access this application.",
  Configuration: "Server configuration error. Contact your administrator.",
};

function CognitoLoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";
  const error = searchParams.get("error");

  useEffect(() => {
    // Do not auto-redirect on error — prevents infinite loop where NextAuth
    // bounces back to /login?error=... and the effect fires again immediately.
    if (error) return;
    signIn("cognito", { callbackUrl });
  }, [callbackUrl, error]);

  return (
    <div className="w-full rounded-2xl bg-white p-8 shadow-2xl ring-1 ring-black/5">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-700">
        <span className="text-sm font-bold text-white">S</span>
      </div>
      {error ? (
        <div className="space-y-4">
          <p className="text-sm text-red-600">
            {COGNITO_ERROR_MESSAGES[error] ??
              "An unexpected error occurred. Please try again."}
          </p>
          <button
            onClick={() => signIn("cognito", { callbackUrl })}
            className="w-full rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
          >
            Try again
          </button>
        </div>
      ) : (
        <p className="text-sm text-slate-600">Redirecting to SSO…</p>
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleLogin = () => {
    if (!email || !password) {
      setMessage("Please enter your email and password.");
      return;
    }

    startTransition(async () => {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setMessage("Invalid email or password. Please try again.");
        return;
      }

      window.location.href = "/dashboard";
    });
  };

  return (
    <div className="w-full rounded-2xl bg-white p-8 shadow-2xl ring-1 ring-black/5">
      {/* Header */}
      <div className="mb-6">
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-700">
          <span className="text-sm font-bold text-white">S</span>
        </div>
        <h2 className="text-xl font-semibold text-slate-900">
          Sign in to Summit
        </h2>
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
            <label
              className="text-sm font-medium text-slate-700"
              htmlFor="password"
            >
              Password
            </label>
            {hasForgotPassword && (
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-brand-700 hover:underline"
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
              if (e.key === "Enter") handleLogin();
            }}
          />
        </div>

        {message && (
          <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            {message}
          </p>
        )}

        <Button
          className="w-full"
          disabled={isPending}
          onClick={handleLogin}
          type="button"
        >
          {isPending ? "Signing in…" : "Sign in"}
        </Button>

        {hasRegistration && (
          <p className="pt-1 text-center text-sm text-slate-500">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="font-medium text-brand-700 hover:underline"
            >
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
}: LoginFormProps) {
  if (provider === "cognito") {
    return <CognitoLoginForm />;
  }

  return (
    <CredentialsLoginForm
      hasForgotPassword={hasForgotPassword}
      hasRegistration={hasRegistration}
    />
  );
}
