import { redirect } from 'next/navigation';

import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import sql from '@/lib/db';

export default async function ResetPasswordPage(
  props: {
    searchParams: Promise<{ token?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const token = searchParams.token ?? '';

  if (!token) redirect('/forgot-password');

  const rows = await sql`
    SELECT email FROM password_reset_tokens
    WHERE token = ${token} AND expires_at > now()
    LIMIT 1
  `;

  if (!rows.length) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl ring-1 ring-black/5 text-center">
          <h2 className="mb-2 text-xl font-semibold text-slate-900">Link expired</h2>
          <p className="mb-4 text-sm text-slate-500">
            This password reset link has expired or already been used.
          </p>
          <a
            href="/forgot-password"
            className="text-sm font-medium text-brand-700 hover:underline"
          >
            Request a new link
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <ResetPasswordForm token={token} />
    </div>
  );
}
