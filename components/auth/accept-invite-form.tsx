'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function AcceptInviteForm({ token, email }: { token: string; email: string }) {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    if (!fullName.trim()) { setMessage('Please enter your full name.'); return; }
    if (password.length < 8) { setMessage('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setMessage('Passwords do not match.'); return; }

    startTransition(async () => {
      const res = await fetch('/api/auth/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, fullName, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.error ?? 'Something went wrong.');
        return;
      }

      // Auto sign-in after account creation
      const result = await signIn('credentials', { email, password, redirect: false });
      if (result?.ok) {
        router.push('/dashboard');
      } else {
        router.push('/login');
      }
    });
  };

  return (
    <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl ring-1 ring-black/5">
      <div className="mb-6">
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-700">
          <span className="text-sm font-bold text-white">S</span>
        </div>
        <h2 className="text-xl font-semibold text-slate-900">Set up your account</h2>
        <p className="mt-1 text-sm text-slate-500">
          You were invited as <strong>{email}</strong>. Enter your name and choose a password.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700" htmlFor="fullName">Full name</label>
          <Input
            id="fullName"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your full name"
            autoComplete="name"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700" htmlFor="password">Password</label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            autoComplete="new-password"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700" htmlFor="confirm">Confirm password</label>
          <Input
            id="confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Re-enter password"
            autoComplete="new-password"
            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
          />
        </div>

        {message && (
          <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">{message}</p>
        )}

        <Button className="w-full" disabled={isPending} onClick={handleSubmit} type="button">
          {isPending ? 'Creating account…' : 'Create account & sign in'}
        </Button>
      </div>
    </div>
  );
}
