import { NextResponse } from 'next/server';

import { getCurrentUserContext } from '@/lib/auth';
import { getProfileById, getProjectById, getProjectMembers, logActivity, userHasProjectAccess } from '@/lib/data';
import { checkRateLimit } from '@/lib/rate-limit';
import { createSectionedQuestions } from '@/lib/quiz/assignment';
import { validateOrigin } from '@/lib/security';
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server';
import type { AssignedQuestion, QuizQuestionRecord, QuizSetRecord } from '@/lib/types/database';

const QUESTIONS_PER_SECTION = 20;
const SECTION_DURATION_SECONDS = 900;  // 15 min per section
const ATTEMPT_TIMEOUT_SECONDS  = 3600; // 1 hour — 2× the total intended quiz duration

function toClientQuestions(questions: AssignedQuestion[]) {
  return questions.map((q) => ({
    questionId: q.questionId,
    questionText: q.questionText,
    options: q.options,
  }));
}

/** Capitalise first letter of a category slug for display. */
function displayName(category: string) {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

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
    const { projectId } = (await request.json()) as { projectId: string };

    if (!profile || profile.role !== 'member') {
      return NextResponse.json({ error: 'Admins cannot take quizzes.' }, { status: 403 });
    }

    const canAccess = await userHasProjectAccess(user.id, profile.role, projectId);
    if (!canAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Rate limit: max 5 quiz starts per hour
    const rateCheck = await checkRateLimit(user.id, 'quiz_started', 5, 3600);
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: 'Too many quiz attempts. Please wait before trying again.' }, { status: 429 });
    }

    // Already submitted — return the locked attempt
    const { data: submittedAttempt } = await supabase
      .from('quiz_attempts')
      .select('*')
      .eq('user_id', user.id)
      .eq('project_id', projectId)
      .eq('status', 'submitted')
      .maybeSingle();

    if (submittedAttempt) {
      return NextResponse.json({ error: 'Quiz already submitted.', attempt: submittedAttempt }, { status: 403 });
    }

    // Resume a valid in_progress attempt that has the new sectioned format
    const { data: inProgressAttempt } = await supabase
      .from('quiz_attempts')
      .select('*')
      .eq('user_id', user.id)
      .eq('project_id', projectId)
      .eq('status', 'in_progress')
      .maybeSingle();

    if (inProgressAttempt) {
      const saved = inProgressAttempt.assigned_questions as AssignedQuestion[];
      const carried = inProgressAttempt.carried_sections as Record<string, { score: number; total: number }> | null;

      if (saved?.length && saved[0]?.section) {
        // Normal resume: questions already assigned — check timeout before resuming
        const elapsedSeconds = (Date.now() - new Date(inProgressAttempt.started_at).getTime()) / 1000;

        if (elapsedSeconds <= ATTEMPT_TIMEOUT_SECONDS) {
          const sectionNames = [...new Set(saved.map((q) => q.section))];
          const sections = sectionNames.map((sec) => ({
            name: displayName(sec),
            durationSeconds: SECTION_DURATION_SECONDS,
            questions: toClientQuestions(saved.filter((q) => q.section === sec)),
          }));
          return NextResponse.json({ attemptId: inProgressAttempt.id, sections });
        }

        await supabase.from('quiz_attempts').delete().eq('id', inProgressAttempt.id);
      } else if (carried && Object.keys(carried).length > 0) {
        // Partial retake: carried_sections set but questions not yet assigned.
        // Fall through to question assignment below, but remember the attempt ID to update.
        // We'll assign questions for non-carried categories only and update this attempt.
        const carriedCategories = new Set(Object.keys(carried));

        // Load sets, filter out carried categories
        const { data: sets } = await supabase
          .from('quiz_sets')
          .select('*')
          .eq('project_id', projectId)
          .eq('is_active', true)
          .order('set_number', { ascending: true });

        const typedSets = (sets ?? []) as QuizSetRecord[];
        const retakeSets = typedSets.filter((s) => !carriedCategories.has(s.category ?? 'general'));

        if (!retakeSets.length) {
          return NextResponse.json({ error: 'No sections left to retake.' }, { status: 400 });
        }

        const retakeCategoryMap = new Map<string, typeof typedSets>();
        for (const s of retakeSets) {
          const cat = s.category ?? 'general';
          if (!retakeCategoryMap.has(cat)) retakeCategoryMap.set(cat, []);
          retakeCategoryMap.get(cat)!.push(s);
        }

        const allSetIds = retakeSets.map((s) => s.id);
        const { data: allQs } = await supabase.from('quiz_questions').select('*').in('quiz_set_id', allSetIds);
        const questionsBySetId = new Map<string, QuizQuestionRecord[]>();
        for (const q of (allQs ?? []) as QuizQuestionRecord[]) {
          if (!questionsBySetId.has(q.quiz_set_id)) questionsBySetId.set(q.quiz_set_id, []);
          questionsBySetId.get(q.quiz_set_id)!.push(q);
        }

        const retakeAssigned: AssignedQuestion[] = [];
        const retakeSectionOrder: string[] = [];
        for (const [category, catSets] of retakeCategoryMap) {
          const catQs: QuizQuestionRecord[] = [];
          for (const s of catSets) catQs.push(...(questionsBySetId.get(s.id) ?? []));
          if (!catQs.length) continue;
          retakeAssigned.push(...createSectionedQuestions(catQs, category, QUESTIONS_PER_SECTION));
          retakeSectionOrder.push(category);
        }

        if (!retakeAssigned.length) {
          return NextResponse.json({ error: 'No questions available for the retake sections.' }, { status: 400 });
        }

        // Update the existing in_progress attempt with the assigned questions
        await supabase
          .from('quiz_attempts')
          .update({ assigned_questions: retakeAssigned })
          .eq('id', inProgressAttempt.id);

        const sections = retakeSectionOrder.map((cat) => ({
          name: displayName(cat),
          durationSeconds: SECTION_DURATION_SECONDS,
          questions: toClientQuestions(retakeAssigned.filter((q) => q.section === cat)),
        }));

        return NextResponse.json({ attemptId: inProgressAttempt.id, sections });
      } else {
        // Old format or completely empty — delete and start fresh
        await supabase.from('quiz_attempts').delete().eq('id', inProgressAttempt.id);
      }
    }

    // Check quiz window
    const { data: projectWindow } = await supabase
      .from('projects')
      .select('quiz_open_at, quiz_close_at')
      .eq('id', projectId)
      .maybeSingle();

    const now = new Date();
    if (projectWindow?.quiz_open_at && new Date(projectWindow.quiz_open_at) > now) {
      return NextResponse.json(
        { error: 'Quiz has not opened yet.', opensAt: projectWindow.quiz_open_at },
        { status: 403 },
      );
    }
    if (projectWindow?.quiz_close_at && new Date(projectWindow.quiz_close_at) < now) {
      return NextResponse.json(
        { error: 'The quiz window has closed.', closedAt: projectWindow.quiz_close_at },
        { status: 403 },
      );
    }

    // Load all active sets for this project
    const { data: sets } = await supabase
      .from('quiz_sets')
      .select('*')
      .eq('project_id', projectId)
      .eq('is_active', true)
      .order('set_number', { ascending: true });

    if (!sets?.length) {
      return NextResponse.json({ error: 'No quiz sets have been created for this project yet.' }, { status: 400 });
    }

    const typedSets = sets as QuizSetRecord[];

    // Group sets by category
    const categoryMap = new Map<string, QuizSetRecord[]>();
    for (const s of typedSets) {
      const cat = s.category ?? 'general';
      if (!categoryMap.has(cat)) categoryMap.set(cat, []);
      categoryMap.get(cat)!.push(s);
    }

    if (categoryMap.size === 0) {
      return NextResponse.json({ error: 'No quiz sets have been created for this project yet.' }, { status: 400 });
    }

    // Fetch questions for all sets in all categories in parallel
    const allSetIds = typedSets.map((s) => s.id);
    const { data: allQuestions } = await supabase
      .from('quiz_questions')
      .select('*')
      .in('quiz_set_id', allSetIds);

    const questionsBySetId = new Map<string, QuizQuestionRecord[]>();
    for (const q of (allQuestions ?? []) as QuizQuestionRecord[]) {
      if (!questionsBySetId.has(q.quiz_set_id)) questionsBySetId.set(q.quiz_set_id, []);
      questionsBySetId.get(q.quiz_set_id)!.push(q);
    }

    // Build one section per category
    const allAssigned: AssignedQuestion[] = [];
    const sectionOrder: string[] = [];

    for (const [category, catSets] of categoryMap) {
      // Gather all questions across all sets in this category
      const catQuestions: QuizQuestionRecord[] = [];
      for (const s of catSets) {
        catQuestions.push(...(questionsBySetId.get(s.id) ?? []));
      }

      if (!catQuestions.length) {
        return NextResponse.json(
          { error: `No questions found for category "${category}". Ask your admin to add questions.` },
          { status: 400 },
        );
      }

      const assigned = createSectionedQuestions(catQuestions, category, QUESTIONS_PER_SECTION);
      allAssigned.push(...assigned);
      sectionOrder.push(category);
    }

    const [members, project] = await Promise.all([
      getProjectMembers(projectId),
      getProjectById(projectId),
    ]);

    // Use the first set's id as the representative quiz_set_id
    const representativeSetId = typedSets[0].id;

    const { data: attempt, error } = await supabase
      .from('quiz_attempts')
      .insert({
        user_id: user.id,
        project_id: projectId,
        quiz_set_id: representativeSetId,
        assigned_questions: allAssigned,
        answers_given: {},
        status: 'in_progress',
      })
      .select('*')
      .single();

    if (error) throw error;

    await logActivity({
      userId: user.id,
      projectId,
      action: 'quiz_started',
      metadata: {
        categories: sectionOrder,
        threshold: project?.pass_threshold ?? 60,
        totalMembers: members.length,
      },
    });

    const sections = sectionOrder.map((cat) => ({
      name: displayName(cat),
      durationSeconds: SECTION_DURATION_SECONDS,
      questions: toClientQuestions(allAssigned.filter((q) => q.section === cat)),
    }));

    return NextResponse.json({ attemptId: attempt.id, sections });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Quiz start failed' },
      { status: 500 },
    );
  }
}
