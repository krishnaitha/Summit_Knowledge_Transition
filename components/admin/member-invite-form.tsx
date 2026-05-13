'use client';

import { useState } from 'react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SubmitButton } from '@/components/ui/submit-button';

export function MemberInviteForm({ projectId }: { projectId: string }) {
  const [inviteLink, setInviteLink] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    setIsSubmitting(true);
    setError(null);
    setMessage(null);
    setInviteLink('');
    setCopied(false);

    try {
      const formData = new FormData(form);
      const payload = {
        projectId,
        fullName: String(formData.get('full_name') ?? '').trim(),
        email: String(formData.get('email') ?? '').trim(),
      };

      const response = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error ?? 'Invite failed');
        return;
      }

      if (data.assigned) {
        setMessage('Existing user was assigned to this project.');
      } else {
        setInviteLink(data.inviteLink ?? '');
        if (data.emailSent) {
          setMessage('Invite email sent. Copy the link below if they do not receive it.');
        } else {
          setMessage('Invite link generated. Share it manually.');
          if (data.emailError) {
            setError(`Email send failed: ${data.emailError}`);
          }
        }
      }

      form.reset();
    } catch {
      setError('Invite failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="grid gap-4 lg:grid-cols-3">
        <input name="project_id" type="hidden" value={projectId} />
        <Input name="full_name" placeholder="Full name" />
        <Input name="email" placeholder="name@company.com" required type="email" />
        <SubmitButton className="lg:w-fit" loadingText="Inviting…" disabled={isSubmitting}>
          Invite with magic link
        </SubmitButton>
      </form>

      {(message || error || inviteLink) && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
          {message && <p className="text-slate-700">{message}</p>}
          {error && <p className="text-rose-600">{error}</p>}
          {inviteLink && (
            <div className="mt-2 space-y-2">
              <p className="break-all text-slate-900">
                Invite link: <Link className="text-brand-700 underline" href={inviteLink} target="_blank">{inviteLink}</Link>
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(inviteLink);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    } catch {
                      setError('Could not copy the invite link. Please copy it manually.');
                    }
                  }}
                >
                  {copied ? 'Copied' : 'Copy link'}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
