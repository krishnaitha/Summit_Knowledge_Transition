'use server';

import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { parse } from 'csv-parse/sync';
import { revalidatePath, revalidateTag } from 'next/cache';

import { requireAdmin } from '@/lib/auth';
import sql from '@/lib/db';
import { isR2Configured } from '@/lib/env';
import { computeSectionScores } from '@/lib/quiz/scoring';
import { deleteFile } from '@/lib/storage/local';
import { deleteFromR2 } from '@/lib/storage/r2';
import type { AssignedQuestion, QuizOptionKey } from '@/lib/types/database';

export async function createProjectAction(formData: FormData) {
  const payload = {
    name: String(formData.get('name') ?? ''),
    description: String(formData.get('description') ?? ''),
    created_by: String(formData.get('created_by') ?? ''),
    pass_threshold: Number(formData.get('pass_threshold') ?? 60),
  };

  await sql`
    INSERT INTO projects (name, description, created_by, pass_threshold, is_active)
    VALUES (${payload.name}, ${payload.description}, ${payload.created_by}, ${payload.pass_threshold}, true)
  `;
  revalidatePath('/admin/projects');
}

export async function toggleProjectStatusAction(formData: FormData) {
  const projectId = String(formData.get('project_id') ?? '');
  const nextState = String(formData.get('next_state') ?? 'true') === 'true';

  await sql`UPDATE projects SET is_active = ${nextState} WHERE id = ${projectId}`;
  revalidatePath('/admin/projects');
  revalidatePath(`/admin/projects/${projectId}`);
  revalidateTag(`project:${projectId}`, 'max');
}

export async function deleteDocumentAction(formData: FormData) {
  const documentId = String(formData.get('document_id') ?? '');
  const projectId = String(formData.get('project_id') ?? '');
  const storagePath = String(formData.get('file_url') ?? '');

  if (storagePath) {
    try {
      if (isR2Configured()) {
        await deleteFromR2(storagePath);
      } else {
        await deleteFile(storagePath);
      }
    } catch {
      // Non-fatal if file already removed
    }
  }

  await sql`DELETE FROM documents WHERE id = ${documentId}`;
  await sql`DELETE FROM document_chunks WHERE document_id = ${documentId}`;

  revalidatePath(`/admin/projects/${projectId}/documents`);
  revalidateTag(`project-docs:${projectId}`, 'max');
}

export async function toggleDocumentRequiredAction(formData: FormData) {
  const projectId = String(formData.get('project_id') ?? '');
  const documentId = String(formData.get('document_id') ?? '');
  const nextState = String(formData.get('next_required') ?? 'false') === 'true';

  if (!projectId || !documentId) return;

  await sql`
    UPDATE documents
    SET is_required = ${nextState}
    WHERE id = ${documentId} AND project_id = ${projectId}
  `;

  revalidatePath(`/admin/projects/${projectId}/documents`);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/quiz`);
}

export async function inviteProjectMemberAction(formData: FormData) {
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const fullName = String(formData.get('full_name') ?? '').trim();
  const projectId = String(formData.get('project_id') ?? '');

  if (!email || !projectId) return;

  // Check if user already exists
  const existing = await sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
  const userId = existing[0]?.id as string | undefined;

  if (!userId) {
    // Create invite token and send email
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    await sql`
      INSERT INTO invite_tokens (email, token, role, project_id, expires_at)
      VALUES (${email}, ${token}, 'member', ${projectId}, ${expiresAt})
      ON CONFLICT (token) DO NOTHING
    `;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const inviteLink = `${appUrl}/auth/accept-invite?token=${token}`;

    // Send invite email via Resend (fire-and-forget; if Resend not configured, skip)
    if (process.env.RESEND_API_KEY) {
      const { Resend } = await import('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);
      const from = process.env.RESEND_FROM_EMAIL ?? 'notifications@summit.app';
      try {
        await resend.emails.send({
          from,
          to: email,
          subject: 'You have been invited to Summit KT Portal',
          html: `
            <p>Hi${fullName ? ` ${fullName}` : ''},</p>
            <p>You have been invited to join <strong>Summit KT Portal</strong>.</p>
            <p>Click the link below to set your password and access your account:</p>
            <p><a href="${inviteLink}">${inviteLink}</a></p>
            <p>This link expires in 7 days.</p>
          `,
        });
      } catch {
        // Email failure is non-fatal
      }
    }

    revalidatePath(`/admin/projects/${projectId}/members`);
    revalidateTag(`project-members:${projectId}`, 'max');
    return;
  }

  // User exists — add to project directly
  await sql`
    INSERT INTO project_members (project_id, user_id)
    VALUES (${projectId}, ${userId})
    ON CONFLICT (project_id, user_id) DO NOTHING
  `;
  revalidatePath(`/admin/projects/${projectId}/members`);
  revalidateTag(`project-members:${projectId}`, 'max');
}

export async function sendProjectAnnouncementAction(formData: FormData) {
  const { profile } = await requireAdmin();

  const projectId = String(formData.get('project_id') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim();
  const message = String(formData.get('message') ?? '').trim();

  if (!projectId || !title || !message) return;

  await sql`
    INSERT INTO project_announcements (project_id, title, message, sent_by)
    VALUES (${projectId}, ${title.slice(0, 140)}, ${message.slice(0, 2000)}, ${profile?.id ?? null})
  `;

  await sql`
    INSERT INTO activity_log (user_id, project_id, action, metadata)
    VALUES (
      ${profile?.id ?? null},
      ${projectId},
      'admin_announcement_sent',
      ${sql.json({ title: title.slice(0, 140) })}
    )
  `;

  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath('/dashboard');
}

export async function removeProjectMemberAction(formData: FormData) {
  const userId = String(formData.get('user_id') ?? '');
  const projectId = String(formData.get('project_id') ?? '');

  await sql`
    DELETE FROM project_members WHERE project_id = ${projectId} AND user_id = ${userId}
  `;
  revalidatePath(`/admin/projects/${projectId}/members`);
  revalidateTag(`project-members:${projectId}`, 'max');
}

export async function updateProjectMemberRoleAction(formData: FormData) {
  const userId = String(formData.get('user_id') ?? '');
  const projectId = String(formData.get('project_id') ?? '');
  const role = String(formData.get('role') ?? 'member');

  if (!userId || !projectId || !['admin', 'member'].includes(role)) return;

  await sql`
    UPDATE project_members SET role = ${role} WHERE project_id = ${projectId} AND user_id = ${userId}
  `;
  revalidatePath(`/admin/projects/${projectId}/members`);
  revalidateTag(`project-members:${projectId}`, 'max');
}

const MAX_QUIZ_RESETS = 2;

export async function resetQuizAttemptAction(formData: FormData) {
  const attemptId = String(formData.get('attempt_id') ?? '');
  const projectId = String(formData.get('project_id') ?? '');
  const userId = String(formData.get('user_id') ?? '');
  const reason = String(formData.get('reason') ?? '').trim() || 'Reset by admin';
  const resetBy = String(formData.get('reset_by') ?? '') || null;
  const sectionsJson = String(formData.get('sections_to_reset') ?? '');

  const resetCountRows = await sql`
    SELECT COUNT(*) as c FROM quiz_resets WHERE user_id = ${userId} AND project_id = ${projectId}
  `;
  if (Number(resetCountRows[0]?.c ?? 0) >= MAX_QUIZ_RESETS) return;

  const sectionsToReset: string[] | null = sectionsJson
    ? (JSON.parse(sectionsJson) as string[])
    : null;

  if (sectionsToReset && sectionsToReset.length > 0) {
    const attemptRows = await sql`
      SELECT assigned_questions, answers_given, quiz_set_id
      FROM quiz_attempts WHERE id = ${attemptId} LIMIT 1
    `;
    const attempt = attemptRows[0];

    if (attempt) {
      const assignedQs = (attempt.assigned_questions ?? []) as AssignedQuestion[];
      const answersGiven = (attempt.answers_given ?? {}) as Record<string, QuizOptionKey>;
      const allSectionScores = computeSectionScores(assignedQs, answersGiven);

      const carriedSections: Record<string, { score: number; total: number }> = {};
      for (const [sec, scores] of Object.entries(allSectionScores)) {
        if (!sectionsToReset.includes(sec)) {
          carriedSections[sec] = scores;
        }
      }

      await sql`DELETE FROM quiz_attempts WHERE id = ${attemptId}`;
      await sql`
        INSERT INTO quiz_attempts (user_id, project_id, quiz_set_id, assigned_questions, answers_given, status, carried_sections)
        VALUES (${userId}, ${projectId}, ${attempt.quiz_set_id}, ${sql.json([])}, ${sql.json({})}, 'in_progress', ${Object.keys(carriedSections).length > 0 ? sql.json(carriedSections) : null})
      `;
    } else {
      await sql`DELETE FROM quiz_attempts WHERE id = ${attemptId}`;
    }
  } else {
    await sql`DELETE FROM quiz_attempts WHERE id = ${attemptId}`;
  }

  await sql`
    INSERT INTO quiz_resets (user_id, project_id, reset_by, reason)
    VALUES (${userId}, ${projectId}, ${resetBy}, ${reason})
  `;

  revalidatePath(`/admin/projects/${projectId}/analytics`);
}

export async function setQuizWindowAction(formData: FormData) {
  const projectId = String(formData.get('project_id') ?? '');
  const openAtRaw = (formData.get('quiz_open_at') as string | null) || '';
  const closeAtRaw = (formData.get('quiz_close_at') as string | null) || '';

  await sql`
    UPDATE projects SET
      quiz_open_at = ${openAtRaw ? new Date(openAtRaw).toISOString() : null},
      quiz_close_at = ${closeAtRaw ? new Date(closeAtRaw).toISOString() : null}
    WHERE id = ${projectId}
  `;

  revalidatePath(`/admin/projects/${projectId}/analytics`);
  revalidatePath(`/projects/${projectId}/quiz`);
  revalidateTag(`project:${projectId}`, 'max');
}

export async function deleteQuizSetAction(formData: FormData) {
  const setId = String(formData.get('set_id') ?? '');
  const projectId = String(formData.get('project_id') ?? '');

  await sql`DELETE FROM quiz_questions WHERE quiz_set_id = ${setId}`;
  await sql`DELETE FROM quiz_sets WHERE id = ${setId}`;
  revalidatePath(`/admin/projects/${projectId}/quiz`);
  revalidateTag(`project-quiz:${projectId}`, 'max');
}

export async function deleteQuizQuestionAction(formData: FormData) {
  const questionId = String(formData.get('question_id') ?? '');
  const projectId = String(formData.get('project_id') ?? '');

  await sql`DELETE FROM quiz_questions WHERE id = ${questionId}`;
  revalidatePath(`/admin/projects/${projectId}/quiz`);
  revalidateTag(`project-quiz:${projectId}`, 'max');
}

export async function createQuizSetAction(formData: FormData) {
  const projectId = String(formData.get('project_id') ?? '');
  const setName = String(formData.get('set_name') ?? '');
  const setNumber = Number(formData.get('set_number') ?? 1);
  const category =
    String(formData.get('category') ?? 'general')
      .trim()
      .toLowerCase() || 'general';

  await sql`
    INSERT INTO quiz_sets (project_id, set_name, set_number, category, is_active)
    VALUES (${projectId}, ${setName}, ${setNumber}, ${category}, true)
  `;
  revalidatePath(`/admin/projects/${projectId}/quiz`);
  revalidateTag(`project-quiz:${projectId}`, 'max');
}

export async function createQuizQuestionAction(formData: FormData) {
  const projectId = String(formData.get('project_id') ?? '');
  const quizSetId = String(formData.get('quiz_set_id') ?? '');
  const questionType = String(formData.get('question_type') ?? 'mcq');
  const isTrueFalse = questionType === 'true_false';

  await sql`
    INSERT INTO quiz_questions
      (quiz_set_id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, marks, question_type)
    VALUES (
      ${quizSetId},
      ${String(formData.get('question_text') ?? '')},
      ${String(formData.get('option_a') ?? '')},
      ${String(formData.get('option_b') ?? '')},
      ${isTrueFalse ? '' : String(formData.get('option_c') ?? '')},
      ${isTrueFalse ? '' : String(formData.get('option_d') ?? '')},
      ${String(formData.get('correct_option') ?? 'A')},
      ${String(formData.get('explanation') ?? '')},
      ${Number(formData.get('marks') ?? 1)},
      ${questionType}
    )
  `;
  revalidatePath(`/admin/projects/${projectId}/quiz`);
  revalidateTag(`project-quiz:${projectId}`, 'max');
}

export async function updateQuizQuestionAction(formData: FormData) {
  const questionId = String(formData.get('question_id') ?? '');
  const projectId = String(formData.get('project_id') ?? '');
  const questionType = String(formData.get('question_type') ?? 'mcq');
  const isTrueFalse = questionType === 'true_false';

  await sql`
    UPDATE quiz_questions SET
      question_text  = ${String(formData.get('question_text') ?? '')},
      option_a       = ${String(formData.get('option_a') ?? '')},
      option_b       = ${String(formData.get('option_b') ?? '')},
      option_c       = ${isTrueFalse ? '' : String(formData.get('option_c') ?? '')},
      option_d       = ${isTrueFalse ? '' : String(formData.get('option_d') ?? '')},
      correct_option = ${String(formData.get('correct_option') ?? 'A')},
      explanation    = ${String(formData.get('explanation') ?? '')},
      marks          = ${Number(formData.get('marks') ?? 1)},
      question_type  = ${questionType}
    WHERE id = ${questionId}
  `;
  revalidatePath(`/admin/projects/${projectId}/quiz`);
  revalidateTag(`project-quiz:${projectId}`, 'max');
}

export async function toggleQuizSetActiveAction(formData: FormData) {
  const setId = String(formData.get('set_id') ?? '');
  const projectId = String(formData.get('project_id') ?? '');
  const nextActive = formData.get('next_active') === 'true';

  await sql`UPDATE quiz_sets SET is_active = ${nextActive} WHERE id = ${setId}`;
  revalidatePath(`/admin/projects/${projectId}/quiz`);
  revalidateTag(`project-quiz:${projectId}`, 'max');
}

export async function importQuizCsvAction(formData: FormData) {
  const projectId = String(formData.get('project_id') ?? '');
  const quizSetId = String(formData.get('quiz_set_id') ?? '');
  const csvText = String(formData.get('csv_text') ?? '');

  if (!csvText.trim()) return;

  const rows = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Array<Record<string, string>>;
  if (!rows.length) return;

  for (const row of rows) {
    await sql`
      INSERT INTO quiz_questions
        (quiz_set_id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, marks)
      VALUES (
        ${quizSetId}, ${row.question_text}, ${row.option_a}, ${row.option_b},
        ${row.option_c}, ${row.option_d}, ${row.correct_option}, ${row.explanation}, ${Number(row.marks ?? 1)}
      )
    `;
  }

  revalidatePath(`/admin/projects/${projectId}/quiz`);
  revalidateTag(`project-quiz:${projectId}`, 'max');
}

export async function createDemoUserAction(formData: FormData) {
  await requireAdmin();

  const projectId = String(formData.get('project_id') ?? '').trim();

  const DEMO_EMAIL = 'demo@summit.app';
  const DEMO_PASSWORD = 'Demo@Summit1';
  const DEMO_NAME = 'Demo Member';

  const existing = await sql`SELECT id FROM users WHERE email = ${DEMO_EMAIL} LIMIT 1`;
  let userId = existing[0]?.id as string | undefined;

  if (!userId) {
    const hash = await bcrypt.hash(DEMO_PASSWORD, 12);
    const newUser = await sql`
      INSERT INTO users (email, full_name, role, password_hash, is_active)
      VALUES (${DEMO_EMAIL}, ${DEMO_NAME}, 'member', ${hash}, true)
      RETURNING id
    `;
    userId = newUser[0]?.id as string;
  }

  if (projectId && userId) {
    await sql`
      INSERT INTO project_members (project_id, user_id)
      VALUES (${projectId}, ${userId})
      ON CONFLICT (project_id, user_id) DO NOTHING
    `;
  }

  revalidatePath('/admin/users');
}

export async function updateUserRoleAction(formData: FormData) {
  await requireAdmin();

  const userId = String(formData.get('user_id') ?? '');
  const role = String(formData.get('role') ?? 'member');

  await sql`UPDATE users SET role = ${role} WHERE id = ${userId}`;
  revalidatePath('/admin/users');
}

export async function toggleUserActiveAction(formData: FormData) {
  await requireAdmin();

  const userId = String(formData.get('user_id') ?? '');
  const nextState = String(formData.get('next_state') ?? 'true') === 'true';

  await sql`UPDATE users SET is_active = ${nextState} WHERE id = ${userId}`;
  revalidatePath('/admin/users');
}

export async function bulkToggleUserActiveAction(formData: FormData) {
  await requireAdmin();

  const userIds = String(formData.get('user_ids') ?? '')
    .split(',')
    .filter(Boolean);
  const nextState = String(formData.get('next_state') ?? 'true') === 'true';

  if (userIds.length === 0) return;

  for (const userId of userIds) {
    await sql`UPDATE users SET is_active = ${nextState} WHERE id = ${userId}`;
  }
  revalidatePath('/admin/users');
}

export async function bulkUpdateUserRoleAction(formData: FormData) {
  await requireAdmin();

  const userIds = String(formData.get('user_ids') ?? '')
    .split(',')
    .filter(Boolean);
  const role = String(formData.get('role') ?? 'member');

  if (userIds.length === 0) return;

  for (const userId of userIds) {
    await sql`UPDATE users SET role = ${role} WHERE id = ${userId}`;
  }
  revalidatePath('/admin/users');
}

export async function bulkAssignToProjectAction(formData: FormData) {
  await requireAdmin();

  const userIds = String(formData.get('user_ids') ?? '')
    .split(',')
    .filter(Boolean);
  const projectId = String(formData.get('project_id') ?? '');

  if (userIds.length === 0 || !projectId) return;

  // Insert project members, ignoring conflicts
  for (const userId of userIds) {
    await sql`
      INSERT INTO project_members (project_id, user_id)
      VALUES (${projectId}, ${userId})
      ON CONFLICT (project_id, user_id) DO NOTHING
    `;
  }

  revalidatePath('/admin/users');
  revalidatePath(`/admin/projects/${projectId}/members`);
}

export async function approveRetakeRequestAction(formData: FormData) {
  await requireAdmin();

  const requestId = String(formData.get('request_id') ?? '');
  const projectId = String(formData.get('project_id') ?? '');
  const memberId = String(formData.get('member_id') ?? '');
  const adminId = String(formData.get('admin_id') ?? '') || null;

  // Delete the existing quiz attempt so the member can retake
  await sql`DELETE FROM quiz_attempts WHERE user_id = ${memberId} AND project_id = ${projectId}`;

  // Mark request as approved
  await sql`
    UPDATE quiz_retake_requests
    SET status = 'approved', resolved_at = NOW(), resolved_by = ${adminId}
    WHERE id = ${requestId}
  `;

  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath(`/admin/projects/${projectId}/analytics`);
}

export async function rejectRetakeRequestAction(formData: FormData) {
  await requireAdmin();

  const requestId = String(formData.get('request_id') ?? '');
  const projectId = String(formData.get('project_id') ?? '');
  const adminId = String(formData.get('admin_id') ?? '') || null;

  await sql`
    UPDATE quiz_retake_requests
    SET status = 'rejected', resolved_at = NOW(), resolved_by = ${adminId}
    WHERE id = ${requestId}
  `;

  revalidatePath(`/admin/projects/${projectId}`);
}
