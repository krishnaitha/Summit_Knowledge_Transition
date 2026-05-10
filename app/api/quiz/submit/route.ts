import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';

import { getCurrentUserContext } from '@/lib/auth';
import { getProfileById, getProjectById, logActivity } from '@/lib/data';
import { sendQuizSubmissionEmail } from '@/lib/email';
import { scoreQuizSubmission } from '@/lib/quiz/scoring';
import { validateOrigin } from '@/lib/security';
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server';
import type { AssignedQuestion, QuizOptionKey } from '@/lib/types/database';

export async function POST(request: Request) {
  try {
    if (!validateOrigin(request)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { user } = await getCurrentUserContext();
    const supabase = createServiceRoleSupabaseClient();

    if (!user || !supabase) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await getProfileById(user.id);

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

    const { data: attempt } = await supabase
      .from('quiz_attempts')
      .select('*')
      .eq('id', body.attemptId)
      .eq('user_id', user.id)
      .eq('project_id', body.projectId)
      .maybeSingle();

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

    await supabase
      .from('quiz_attempts')
      .update({
        answers_given: body.answers,
        score: finalScore,
        total_marks: finalTotal,
        percentage: isDisqualified ? 0 : finalPercentage,
        passed: isDisqualified ? false : finalPassed,
        submitted_at: new Date().toISOString(),
        status: 'submitted',
      })
      .eq('id', body.attemptId);

    await logActivity({
      userId: user.id,
      projectId: body.projectId,
      action: 'quiz_submitted',
      metadata: {
        score: finalScore,
        percentage: isDisqualified ? 0 : finalPercentage,
        disqualified: isDisqualified,
        disqualifyReason: body.disqualifyReason ?? null,
      },
    });

    // Email the project admin (non-blocking, fire-and-forget)
    if (project?.created_by) {
      const { data: adminUser } = await supabase
        .from('users')
        .select('email')
        .eq('id', project.created_by)
        .maybeSingle();

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
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Quiz submission failed' }, { status: 500 });
  }
}