import { redirect } from 'next/navigation';
import { AcceptInviteForm } from '@/components/auth/accept-invite-form';
import sql from '@/lib/db';

export default async function AcceptInvitePage(
  props: {
    searchParams: Promise<{ token?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const token = searchParams.token ?? '';

  if (!token) redirect('/login');

  // Validate token exists and is not expired
  const rows = await sql`
    SELECT email, role FROM invite_tokens
    WHERE token = ${token} AND expires_at > now()
    LIMIT 1
  `;

  if (!rows.length) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl ring-1 ring-black/5 text-center">
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Invalid or expired link</h2>
          <p className="text-sm text-slate-500">
            This invitation link has expired or already been used. Please ask your admin to send a new invite.
          </p>
        </div>
      </div>
    );
  }

  const { email } = rows[0] as { email: string; role: string };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <AcceptInviteForm token={token} email={email} />
    </div>
  );
}
