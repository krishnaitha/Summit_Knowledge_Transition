import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.RESEND_FROM_EMAIL ?? 'notifications@summit.app';

export async function sendQuizSubmissionEmail(params: {
  adminEmail: string;
  memberName: string;
  memberEmail: string;
  projectName: string;
  score: number;
  totalMarks: number;
  percentage: number;
  disqualified: boolean;
  disqualifyReason?: string | null;
}) {
  if (!resend) return;

  const {
    adminEmail,
    memberName,
    memberEmail,
    projectName,
    score,
    totalMarks,
    percentage,
    disqualified,
    disqualifyReason,
  } = params;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';

  const subject = disqualified
    ? `[Summit KT] ${memberName} was disqualified — ${projectName}`
    : `[Summit KT] Quiz submitted by ${memberName} — ${projectName}`;

  const html = disqualified
    ? `<p>Hi,</p>
<p><strong>${memberName}</strong> (<a href="mailto:${memberEmail}">${memberEmail}</a>) was <strong>disqualified</strong> during the quiz for <strong>${projectName}</strong>.</p>
<p><strong>Reason:</strong> ${disqualifyReason ?? 'Integrity violation detected during the assessment.'}</p>
<p>Review and reset their attempt in the <a href="${appUrl}/admin/projects">Admin Analytics</a> page.</p>`
    : `<p>Hi,</p>
<p><strong>${memberName}</strong> (<a href="mailto:${memberEmail}">${memberEmail}</a>) has submitted their quiz for <strong>${projectName}</strong>.</p>
<table cellpadding="8" style="border-collapse:collapse;margin-top:8px">
  <tr><td style="font-weight:600">Score</td><td>${score} / ${totalMarks}</td></tr>
  <tr><td style="font-weight:600">Percentage</td><td>${percentage.toFixed(1)}%</td></tr>
</table>
<p style="margin-top:12px">View full results in the <a href="${appUrl}/admin/projects">Admin Analytics</a> page.</p>`;

  try {
    await resend.emails.send({ from: FROM, to: adminEmail, subject, html });
  } catch {
    console.error('[email] Failed to send quiz submission notification');
  }
}
