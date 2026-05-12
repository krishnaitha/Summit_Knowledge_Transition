import { NextResponse } from 'next/server';

import { getCurrentUserContext } from '@/lib/auth';
import { getProjectById, getProjectMembers, logActivity, userHasProjectAccess } from '@/lib/data';
import sql from '@/lib/db';
import { checkRateLimit } from '@/lib/rate-limit';
import { createSectionedQuestions } from '@/lib/quiz/assignment';
import { validateOrigin } from '@/lib/security';
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

    const { userId, profile } = await getCurrentUserContext();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId } = (await request.json()) as { projectId: string };

    if (!profile || profile.role !== 'member') {
      return NextResponse.json({ error: 'Admins cannot take quizzes.' }, { status: 403 });
    }

    const canAccess = await userHasProjectAccess(userId, profile.role, projectId);
    if (!canAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Rate limit: max 5 quiz starts per hour
    const rateCheck = await checkRateLimit(userId, 'quiz_started', 5, 3600);
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: 'Too many quiz attempts. Please wait before trying again.' }, { status: 429 });
    }

    // Already submitted — return the locked attempt
    const submittedRows = await sql`
      SELECT * FROM quiz_attempts
      WHERE user_id = ${userId}
        AND project_id = ${projectId}
        AND status = 'submitted'
      LIMIT 1
    `;
    const submittedAttempt = submittedRows[0] ?? null;

    if (submittedAttempt) {
      return NextResponse.json({ error: 'Quiz already submitted.', attempt: submittedAttempt }, { status: 403 });
    }

    // Resume a valid in_progress attempt that has the new sectioned format
    const inProgressRows = await sql`
      SELECT * FROM quiz_attempts
      WHERE user_id = ${userId}
        AND project_id = ${projectId}
        AND status = 'in_progress'
      LIMIT 1
    `;
    const inProgressAttempt = inProgressRows[0] ?? null;

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

        await sql`DELETE FROM quiz_attempts WHERE id = ${inProgressAttempt.id}`;
      } else if (carried && Object.keys(carried).length > 0) {
        // Partial retake: carried_sections set but questions not yet assigned.
        // Fall through to question assignment below, but remember the attempt ID to update.
        // We'll assign questions for non-carried categories only and update this attempt.
        const carriedCategories = new Set(Object.keys(carried));

        // Load sets, filter out carried categories
        const setsRows = await sql`
          SELECT * FROM quiz_sets
          WHERE project_id = ${projectId}
            AND is_active = true
          ORDER BY set_number ASC
        `;
        const typedSets = setsRows as unknown as QuizSetRecord[];
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
        const allQsRows = await sql`
          SELECT * FROM quiz_questions WHERE quiz_set_id = ANY(${allSetIds})
        `;
        const questionsBySetId = new Map<string, QuizQuestionRecord[]>();
        for (const q of allQsRows as unknown as QuizQuestionRecord[]) {
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
        await sql`
          UPDATE quiz_attempts
          SET assigned_questions = ${sql.json(retakeAssigned)}
          WHERE id = ${inProgressAttempt.id}
        `;

        const sections = retakeSectionOrder.map((cat) => ({
          name: displayName(cat),
          durationSeconds: SECTION_DURATION_SECONDS,
          questions: toClientQuestions(retakeAssigned.filter((q) => q.section === cat)),
        }));

        return NextResponse.json({ attemptId: inProgressAttempt.id, sections });
      } else {
        // Old format or completely empty — delete and start fresh
        await sql`DELETE FROM quiz_attempts WHERE id = ${inProgressAttempt.id}`;
      }
    }

    // Check quiz window
    const projectWindowRows = await sql`
      SELECT quiz_open_at, quiz_close_at FROM projects WHERE id = ${projectId} LIMIT 1
    `;
    const projectWindow = projectWindowRows[0] ?? null;

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
    const setsRows = await sql`
      SELECT * FROM quiz_sets
      WHERE project_id = ${projectId}
        AND is_active = true
      ORDER BY set_number ASC
    `;

    if (!setsRows.length) {
      return NextResponse.json({ error: 'No quiz sets have been created for this project yet.' }, { status: 400 });
    }

    const typedSets = setsRows as unknown as QuizSetRecord[];

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

    // Fetch questions for all sets in all categories
    const allSetIds = typedSets.map((s) => s.id);
    const allQsRows = await sql`
      SELECT * FROM quiz_questions WHERE quiz_set_id = ANY(${allSetIds})
    `;

    const questionsBySetId = new Map<string, QuizQuestionRecord[]>();
    for (const q of allQsRows as unknown as QuizQuestionRecord[]) {
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

    const attemptRows = await sql`
      INSERT INTO quiz_attempts (user_id, project_id, quiz_set_id, assigned_questions, answers_given, status)
      VALUES (
        ${userId},
        ${projectId},
        ${representativeSetId},
        ${sql.json(allAssigned)},
        ${sql.json({})},
        'in_progress'
      )
      RETURNING *
    `;
    const attempt = attemptRows[0];

    if (!attempt) {
      throw new Error('Failed to create quiz attempt');
    }

    await logActivity({
      userId,
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
