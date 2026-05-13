import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';

import { getCurrentUserContext } from '@/lib/auth';
import { getProjectById, logActivity } from '@/lib/data';
import sql from '@/lib/db';
import { sendQuizSubmissionEmail } from '@/lib/email';
import { computeSectionScores, scoreQuizSubmission } from '@/lib/quiz/scoring';
import { validateOrigin } from '@/lib/security';
import type { AssignedQuestion, QuizOptionKey } from '@/lib/types/database';

function buildCoachingPlan(
  assignedQuestions: AssignedQuestion[],
  answers: Record<string, QuizOptionKey>,
  passThreshold: number,
  docs: Array<{ id: string; file_name: string; is_required: boolean }>,
) {
  const sectionScores = computeSectionScores(assignedQuestions, answers);
  const weakSections = Object.entries(sectionScores)
    .map(([section, value]) => {
      const percentage = value.total > 0 ? (value.score / value.total) * 100 : 0;
      return { section, score: value.score, total: value.total, percentage };
    })
    .filter((s) => s.percentage < passThreshold)
    .sort((a, b) => a.percentage - b.percentage);

  if (!weakSections.length) {
    return {
      weakSections: [],
      recommendations: [],
    };
  }

  const requiredDocs = docs.filter((d) => d.is_required);
  const fallbackDocs = docs.slice(0, 3);

  const recommendations = weakSections.map((weak) => {
    const sectionName = weak.section.charAt(0).toUpperCase() + weak.section.slice(1);
    const sectionKeywords = weak.section.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

    const matchedDocs = docs.filter((doc) => {
      const name = doc.file_name.toLowerCase();
      return sectionKeywords.some((kw) => name.includes(kw));
    });

    const selectedDocs = (matchedDocs.length ? matchedDocs : (requiredDocs.length ? requiredDocs : fallbackDocs))
      .slice(0, 3)
      .map((doc) => ({ id: doc.id, name: doc.file_name }));

    return {
      section: weak.section,
      focus: `Review ${sectionName} concepts and re-check edge-case workflows before retaking.`,
      documents: selectedDocs,
    };
  });

  return {
    weakSections,
    recommendations,
  };
}

export async function POST(request: Request) {
  try {
    if (!validateOrigin(request)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { userId, profile } = await getCurrentUserContext();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!profile || profile.role !== 'member') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = (await request.json()) as {
      projectId: string;
      attemptId: string;
      answers: Record<string, QuizOptionKey>;
      disqualified?: boolean;
      disqualifyReason?: string;
    };

    const attemptRows = await sql`
      SELECT * FROM quiz_attempts
      WHERE id = ${body.attemptId}
        AND user_id = ${userId}
        AND project_id = ${body.projectId}
      LIMIT 1
    `;
    const attempt = attemptRows[0] ?? null;

    if (!attempt) {
      return NextResponse.json({ error: 'Quiz attempt not found' }, { status: 404 });
    }

    if (attempt.status === 'submitted') {
      return NextResponse.json({ error: 'Quiz already submitted' }, { status: 403 });
    }

    const assignedQuestions = attempt.assigned_questions as AssignedQuestion[];
    const assignedIds = new Set(assignedQuestions.map((question) => question.questionId));
    const answerIds = Object.keys(body.answers);

    if (answerIds.some((id) => !assignedIds.has(id))) {
      return NextResponse.json({ error: 'Invalid question set submitted' }, { status: 400 });
    }

    const project = await getProjectById(body.projectId);
    const scored = scoreQuizSubmission(assignedQuestions, body.answers, project?.pass_threshold ?? 60);
    const isDisqualified = body.disqualified === true;
    const coachingDocs = await sql<{ id: string; file_name: string; is_required: boolean }[]>`
      SELECT id, file_name, is_required
      FROM documents
      WHERE project_id = ${body.projectId}
      ORDER BY is_required DESC, uploaded_at DESC
    `;

    // Merge any carried section scores from a partial retake
    const carried = attempt.carried_sections as Record<string, { score: number; total: number }> | null;
    let finalScore = isDisqualified ? 0 : scored.score;
    let finalTotal = scored.totalMarks;
    if (carried) {
      for (const section of Object.values(carried)) {
        if (!isDisqualified) finalScore += section.score;
        finalTotal += section.total;
      }
    }
    const finalPercentage = finalTotal > 0 ? (finalScore / finalTotal) * 100 : 0;
    const finalPassed = finalPercentage >= (project?.pass_threshold ?? 60);
    const coachingPlan = buildCoachingPlan(
      assignedQuestions,
      body.answers,
      project?.pass_threshold ?? 60,
      coachingDocs,
    );

    await sql`
      UPDATE quiz_attempts
      SET
        answers_given = ${sql.json(body.answers)},
        score = ${finalScore},
        total_marks = ${finalTotal},
        percentage = ${isDisqualified ? 0 : finalPercentage},
        passed = ${isDisqualified ? false : finalPassed},
        submitted_at = ${new Date().toISOString()},
        status = 'submitted'
      WHERE id = ${body.attemptId}
    `;

    await logActivity({
      userId,
      projectId: body.projectId,
      action: 'quiz_submitted',
      metadata: {
        score: finalScore,
        percentage: isDisqualified ? 0 : finalPercentage,
        disqualified: isDisqualified,
        disqualifyReason: body.disqualifyReason ?? null,
      },
    });

    await sql`
      INSERT INTO quiz_coaching_plans (attempt_id, user_id, project_id, weak_sections, recommendations)
      VALUES (
        ${body.attemptId},
        ${userId},
        ${body.projectId},
        ${sql.json(coachingPlan.weakSections)},
        ${sql.json(coachingPlan.recommendations)}
      )
      ON CONFLICT (attempt_id)
      DO UPDATE SET
        weak_sections = EXCLUDED.weak_sections,
        recommendations = EXCLUDED.recommendations,
        created_at = now()
    `;

    // Email the project admin (non-blocking, fire-and-forget)
    if (project?.created_by) {
      const adminRows = await sql`
        SELECT email FROM users WHERE id = ${project.created_by} LIMIT 1
      `;
      const adminUser = adminRows[0] ?? null;

      if (adminUser?.email) {
        sendQuizSubmissionEmail({
          adminEmail: adminUser.email,
          memberName: profile.full_name ?? profile.email,
          memberEmail: profile.email,
          projectName: project.name,
          score: finalScore,
          totalMarks: finalTotal,
          percentage: isDisqualified ? 0 : finalPercentage,
          disqualified: isDisqualified,
          disqualifyReason: body.disqualifyReason ?? null,
        });
      }
    }

    revalidatePath(`/projects/${body.projectId}/quiz`);
    revalidatePath(`/projects/${body.projectId}`);
    revalidatePath('/dashboard');
    revalidatePath('/projects');
    revalidatePath(`/admin/projects/${body.projectId}/analytics`);

    return NextResponse.json({
      score: finalScore,
      totalMarks: finalTotal,
      percentage: isDisqualified ? 0 : finalPercentage,
      disqualified: isDisqualified,
      disqualifyReason: body.disqualifyReason ?? null,
      coachingPlan,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Quiz submission failed' }, { status: 500 });
  }
}
