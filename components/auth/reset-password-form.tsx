'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    if (!password || password.length < 8) {
      setMessage('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setMessage('Passwords do not match.');
      return;
    }

    startTransition(async () => {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMessage(data.error ?? 'Something went wrong. Please try again.');
        return;
      }

      setIsSuccess(true);
      setMessage(null);
    });
  };

  return (
    <div className="w-full rounded-2xl bg-white p-8 shadow-2xl ring-1 ring-black/5">
      <div className="mb-6">
        <div className="bg-brand-700 mb-4 flex h-10 w-10 items-center justify-center rounded-xl">
          <span className="text-sm font-bold text-white">N</span>
        </div>
        <h2 className="text-xl font-semibold text-slate-900">Set new password</h2>
        <p className="mt-1 text-sm text-slate-500">Choose a strong password for your account.</p>
      </div>

      {isSuccess ? (
        <div className="space-y-4">
          <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Password updated successfully.
          </div>
          <Link
            href="/login"
            className="bg-brand-700 hover:bg-brand-800 block w-full rounded-lg px-4 py-2 text-center text-sm font-medium text-white"
          >
            Sign in
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700" htmlFor="password">
              New password
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
              autoComplete="new-password"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700" htmlFor="confirm">
              Confirm password
            </label>
            <Input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat your password"
              autoComplete="new-password"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmit();
              }}
            />
          </div>

          {message && (
            <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">{message}</p>
          )}

          <Button className="w-full" disabled={isPending} onClick={handleSubmit} type="button">
            {isPending ? 'Updating…' : 'Update password'}
          </Button>
        </div>
      )}
    </div>
  );
}
