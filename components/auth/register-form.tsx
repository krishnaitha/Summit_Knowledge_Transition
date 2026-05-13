'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function RegisterForm() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleRegister = () => {
    if (!fullName.trim()) { setMessage('Please enter your full name.'); return; }
    if (!email.trim()) { setMessage('Please enter your email address.'); return; }
    if (!password || password.length < 8) { setMessage('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setMessage('Passwords do not match.'); return; }

    startTransition(async () => {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: fullName.trim(), email: email.trim(), password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMessage(data.error ?? 'Registration failed. Please try again.');
        return;
      }

      setIsSuccess(true);
      setMessage(null);
    });
  };

  return (
    <div className="w-full rounded-2xl bg-white p-8 shadow-2xl ring-1 ring-black/5">
      <div className="mb-6">
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-700">
          <span className="text-sm font-bold text-white">S</span>
        </div>
        <h2 className="text-xl font-semibold text-slate-900">Create your account</h2>
        <p className="mt-1 text-sm text-slate-500">
          Register to access your KT workspace.
        </p>
      </div>

      {isSuccess ? (
        <div className="space-y-4">
          <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Account created successfully. You can now sign in.
          </div>
          <Link
            href="/login"
            className="block w-full rounded-lg bg-brand-700 px-4 py-2 text-center text-sm font-medium text-white hover:bg-brand-800"
          >
            Sign in
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700" htmlFor="fullName">
              Full name
            </label>
            <Input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Smith"
              autoComplete="name"
            />
          </div>

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
            <label className="text-sm font-medium text-slate-700" htmlFor="password">
              Password
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
              onKeyDown={(e) => { if (e.key === 'Enter') handleRegister(); }}
            />
          </div>

          {message && (
            <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">{message}</p>
          )}

          <Button className="w-full" disabled={isPending} onClick={handleRegister} type="button">
            {isPending ? 'Creating account…' : 'Create account'}
          </Button>

          <p className="pt-1 text-center text-sm text-slate-500">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-brand-700 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
