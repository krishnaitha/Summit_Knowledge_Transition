import 'server-only';

import type {
  ActivityRecord,
  AssignedQuestion,
  ChatBookmarkRecord,
  ChatMessageRecord,
  ChatSessionRecord,
  DocumentRecord,
  ProjectDashboardCard,
  ProjectRecord,
  QuizAttemptRecord,
  QuizOptionKey,
  QuizQuestionRecord,
  QuizSetRecord,
  UserProfile,
} from '@/lib/types/database';

export interface ObservabilityMetrics {
  totalRequests: number;
  retrievalHitRate: number;
  avgSimilarityScore: number;
  refusalRate: number;
  possibleHallucinationCount: number;
  slowQueryCount: number;
  tokenUsageByDay: Array<{ date: string; promptTokens: number; completionTokens: number; totalTokens: number }>;
  topUnansweredQueries: Array<{ query: string; occurrences: number }>;
  possibleHallucinations: Array<{ query: string; maxSimilarity: string; askedAt: string }>;
  slowQueries: Array<{ query: string; totalMs: number; generationMs: number; askedAt: string }>;
}

import sql from '@/lib/db';
import { computeSectionScores } from '@/lib/quiz/scoring';
import { formatDate } from '@/lib/utils';

export async function getProfileById(userId: string) {
  const rows = await sql<UserProfile[]>`SELECT * FROM users WHERE id = ${userId} LIMIT 1`;
  return rows[0] ?? null;
}

export async function getAssignedProjects(userId: string, lastLoginAt?: string | null) {
  const rows = await sql<{ project_id: string }[]>`
    SELECT project_id FROM project_members WHERE user_id = ${userId}
  `;
  const projectIds = rows.map((r) => r.project_id);

  if (!projectIds.length) return [] as ProjectDashboardCard[];

  const [projects, documents, attempts, viewedDocs, newDocRows] = await Promise.all([
    sql<ProjectRecord[]>`SELECT * FROM projects WHERE id = ANY(${projectIds}) ORDER BY created_at DESC`,
    sql<{ project_id: string }[]>`SELECT project_id FROM documents WHERE project_id = ANY(${projectIds})`,
    sql<QuizAttemptRecord[]>`SELECT * FROM quiz_attempts WHERE user_id = ${userId}`,
    sql<{ project_id: string; c: string }[]>`
      SELECT project_id, COUNT(DISTINCT (metadata->>'documentId')) AS c
      FROM activity_log
      WHERE user_id = ${userId} AND action = 'document_viewed' AND project_id = ANY(${projectIds})
      GROUP BY project_id
    `,
    lastLoginAt
      ? sql<{ project_id: string }[]>`
          SELECT DISTINCT project_id FROM documents
          WHERE project_id = ANY(${projectIds}) AND uploaded_at > ${lastLoginAt}
        `
      : Promise.resolve([] as { project_id: string }[]),
  ]);

  const viewedMap = new Map(viewedDocs.map((v) => [v.project_id, Number(v.c)]));
  const newDocProjects = new Set(newDocRows.map((n) => n.project_id));

  return projects
    .filter((project) => project.is_active)
    .map((project) => {
      const projectDocuments = documents.filter((d) => d.project_id === project.id).length;
      const attempt = attempts.find((a) => a.project_id === project.id);

      return {
        ...project,
        documentCount: projectDocuments,
        docsViewedCount: viewedMap.get(project.id) ?? 0,
        isNewDocs: newDocProjects.has(project.id),
        quizCloseAt: project.quiz_close_at ?? null,
        quizStatus: attempt?.status === 'submitted' ? 'Completed' : attempt?.status === 'in_progress' ? 'In Progress' : 'Not Started',
        quizScoreLabel:
          attempt?.status === 'submitted' && attempt.score != null && attempt.total_marks != null
            ? `${attempt.score}/${attempt.total_marks}`
            : null,
        quizPercentage:
          attempt?.status === 'submitted' && attempt.percentage != null ? Number(attempt.percentage) : null,
        quizPassed: attempt?.status === 'submitted' && attempt.passed != null ? attempt.passed : null,
      } satisfies ProjectDashboardCard;
    });
}

export async function getProjectById(projectId: string) {
  const rows = await sql<ProjectRecord[]>`SELECT * FROM projects WHERE id = ${projectId} LIMIT 1`;
  return rows[0] ?? null;
}

export async function getProjectDocuments(projectId: string) {
  return sql<DocumentRecord[]>`
    SELECT * FROM documents WHERE project_id = ${projectId} ORDER BY uploaded_at DESC
  `;
}

export async function getProjectMembers(projectId: string) {
  const rows = await sql`
    SELECT pm.assigned_at, u.*
    FROM project_members pm
    JOIN users u ON u.id = pm.user_id
    WHERE pm.project_id = ${projectId}
    ORDER BY pm.assigned_at ASC
  `;
  return rows as Array<UserProfile & { assigned_at: string }>;
}

export async function getQuizAttemptForProject(userId: string, projectId: string) {
  const rows = await sql<QuizAttemptRecord[]>`
    SELECT * FROM quiz_attempts
    WHERE user_id = ${userId} AND project_id = ${projectId}
    ORDER BY started_at DESC
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function getProjectChatSessions(userId: string, projectId: string) {
  return sql<ChatSessionRecord[]>`
    SELECT * FROM chat_sessions
    WHERE user_id = ${userId} AND project_id = ${projectId}
    ORDER BY last_message_at DESC
  `;
}

export async function getChatMessages(sessionId: string) {
  return sql<ChatMessageRecord[]>`
    SELECT * FROM chat_messages WHERE session_id = ${sessionId} ORDER BY created_at ASC
  `;
}

export async function userHasProjectAccess(userId: string, role: UserProfile['role'] | null | undefined, projectId: string) {
  if (role === 'admin') return true;

  const rows = await sql`
    SELECT id FROM project_members
    WHERE project_id = ${projectId} AND user_id = ${userId}
    LIMIT 1
  `;
  return rows.length > 0;
}

export async function getAdminDashboardStats() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    totalUsersRows,
    activeUsersRows,
    totalMessagesRows,
    totalDocumentsRows,
    completedQuizzesRows,
    totalAttemptsRows,
    pendingRetakeRows,
    recentActivityRows,
  ] = await Promise.all([
    sql`SELECT COUNT(*) as c FROM users`,
    sql`SELECT COUNT(*) as c FROM users WHERE last_login_at >= ${sevenDaysAgo}`,
    sql`SELECT COUNT(*) as c FROM chat_messages`,
    sql`SELECT COUNT(*) as c FROM documents`,
    sql`SELECT COUNT(*) as c FROM quiz_attempts WHERE status = 'submitted'`,
    sql`SELECT COUNT(*) as c FROM quiz_attempts`,
    sql`SELECT COUNT(*) as c FROM quiz_retake_requests WHERE status = 'pending'`,
    sql`
      SELECT al.*, u.full_name as user_full_name, u.email as user_email
      FROM activity_log al
      LEFT JOIN users u ON u.id = al.user_id
      ORDER BY al.created_at DESC
      LIMIT 10
    `,
  ]);

  const totalUsers = Number(totalUsersRows[0]?.c ?? 0);
  const activeUsers = Number(activeUsersRows[0]?.c ?? 0);
  const totalMessages = Number(totalMessagesRows[0]?.c ?? 0);
  const totalDocuments = Number(totalDocumentsRows[0]?.c ?? 0);
  const completedQuizzes = Number(completedQuizzesRows[0]?.c ?? 0);
  const totalAttempts = Number(totalAttemptsRows[0]?.c ?? 0);
  const pendingRetakeRequests = Number(pendingRetakeRows[0]?.c ?? 0);

  const enrichedActivity = recentActivityRows.map((item) => {
    const rawName = item.user_full_name as string | null;
    const name = (rawName && rawName !== 'undefined' && rawName.trim()) ? rawName : (item.user_email as string | null);
    return { ...item, userName: name } as ActivityRecord & { userName: string | null };
  });

  return {
    totalUsers,
    activeUsers,
    totalMessages,
    totalDocuments,
    quizCompletionRate: totalAttempts ? Math.round((completedQuizzes / totalAttempts) * 100) : 0,
    pendingRetakeRequests,
    recentActivity: enrichedActivity,
  };
}

export async function getAllProjects() {
  return sql<ProjectRecord[]>`SELECT * FROM projects ORDER BY created_at DESC`;
}

export async function getPendingRetakeCountsByProject(): Promise<Map<string, number>> {
  const rows = await sql<{ project_id: string; c: string }[]>`
    SELECT project_id, COUNT(*) as c
    FROM quiz_retake_requests
    WHERE status = 'pending'
    GROUP BY project_id
  `;
  return new Map(rows.map((r) => [r.project_id, Number(r.c)]));
}

export async function getProjectQuizSets(projectId: string) {
  const [sets, questions] = await Promise.all([
    sql<QuizSetRecord[]>`SELECT * FROM quiz_sets WHERE project_id = ${projectId} ORDER BY set_number ASC`,
    sql<QuizQuestionRecord[]>`
      SELECT qq.* FROM quiz_questions qq
      JOIN quiz_sets qs ON qs.id = qq.quiz_set_id
      WHERE qs.project_id = ${projectId}
    `,
  ]);

  return sets.map((set) => ({
    ...set,
    questions: questions.filter((q) => q.quiz_set_id === set.id),
  }));
}

export async function getRetakeRequestsForProject(projectId: string) {
  return sql<{
    id: string;
    user_id: string;
    project_id: string;
    attempt_id: string | null;
    reason: string | null;
    status: string;
    created_at: Date;
    resolved_at: Date | null;
    resolved_by: string | null;
    user_name: string;
    user_email: string;
  }[]>`
    SELECT r.*, u.full_name AS user_name, u.email AS user_email
    FROM quiz_retake_requests r
    JOIN users u ON u.id = r.user_id
    WHERE r.project_id = ${projectId}
    ORDER BY r.created_at DESC
  `;
}

export async function getAllUsers() {
  return sql<UserProfile[]>`SELECT * FROM users ORDER BY created_at DESC`;
}

export async function getProjectAnalytics(projectId: string) {
  const memberRows = await sql<{ user_id: string; assigned_at: string }[]>`
    SELECT user_id, assigned_at FROM project_members WHERE project_id = ${projectId}
  `;
  const memberIds = memberRows.map((m) => m.user_id);
  const memberAssignedAt = new Map(memberRows.map((m) => [m.user_id, m.assigned_at]));

  const [sessions, attempts, users, quizSets, resets, gapLogs] = await Promise.all([
    sql<ChatSessionRecord[]>`SELECT * FROM chat_sessions WHERE project_id = ${projectId}`,
    sql<QuizAttemptRecord[]>`SELECT * FROM quiz_attempts WHERE project_id = ${projectId} AND status = 'submitted'`,
    sql<UserProfile[]>`SELECT * FROM users`,
    sql<{ id: string; set_name: string }[]>`SELECT id, set_name FROM quiz_sets WHERE project_id = ${projectId}`,
    sql<{ user_id: string }[]>`SELECT user_id FROM quiz_resets WHERE project_id = ${projectId}`,
    sql<{ metadata: Record<string, unknown>; created_at: string; user_id: string | null }[]>`
      SELECT metadata, created_at, user_id
      FROM activity_log
      WHERE project_id = ${projectId} AND action = 'knowledge_gap'
      ORDER BY created_at DESC
      LIMIT 50
    `,
  ]);

  const resetCounts = new Map<string, number>();
  resets.forEach((r) => { resetCounts.set(r.user_id, (resetCounts.get(r.user_id) ?? 0) + 1); });

  const userIndex = new Map(users.map((u) => [u.id, u]));
  const setIndex = new Map(quizSets.map((s) => [s.id, s.set_name]));

  function resolveDisplayName(userId: string) {
    const user = userIndex.get(userId);
    return (user?.full_name && user.full_name !== 'undefined' && user.full_name.trim())
      ? user.full_name
      : (user?.email ?? userId.slice(0, 8));
  }

  const chatbotUsage = sessions.map((session) => ({
    name: resolveDisplayName(session.user_id),
    email: userIndex.get(session.user_id)?.email ?? '—',
    sessions: 1,
    messages: session.message_count,
    lastActive: formatDate(session.last_message_at ?? session.started_at, true),
  }));

  const quizResults = attempts.map((attempt) => {
    const user = userIndex.get(attempt.user_id);
    const assignedQs = (attempt.assigned_questions ?? []) as Array<{ section?: string }>;
    const sectionSet = [...new Set(assignedQs.map((q) => q.section).filter(Boolean))];
    const carriedKeys = Object.keys(attempt.carried_sections ?? {});
    const allSections = [...new Set([...sectionSet, ...carriedKeys])];
    const sectionLabel = allSections.length > 0
      ? allSections.map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' + ')
      : (setIndex.get(attempt.quiz_set_id) ?? 'Unknown');
    const retakenScores = computeSectionScores(
      attempt.assigned_questions as AssignedQuestion[],
      (attempt.answers_given ?? {}) as Record<string, QuizOptionKey>,
    );
    const sectionScores: Record<string, { score: number; total: number }> = {
      ...retakenScores,
      ...(attempt.carried_sections ?? {}),
    };
    return {
      attemptId: attempt.id,
      userId: attempt.user_id,
      member: resolveDisplayName(attempt.user_id),
      email: user?.email ?? '—',
      score: `${attempt.score ?? 0} / ${attempt.total_marks ?? 0}`,
      percentage: `${attempt.percentage ?? 0}%`,
      setTaken: sectionLabel,
      submittedAt: formatDate(attempt.submitted_at, true),
      resetCount: resetCounts.get(attempt.user_id) ?? 0,
      sectionScores,
    };
  });

  const loginActivity = memberIds.map((userId) => {
    const user = userIndex.get(userId);
    return {
      name: resolveDisplayName(userId),
      email: user?.email ?? '—',
      lastLogin: formatDate(user?.last_login_at, true),
      joinedProject: formatDate(memberAssignedAt.get(userId)),
    };
  });

  const knowledgeGaps = gapLogs.map((log) => {
    const meta = (log.metadata ?? {}) as Record<string, unknown>;
    return {
      query: (meta.query as string) ?? '—',
      confidence: `${(((meta.maxSimilarity as number) ?? 0) * 100).toFixed(0)}%`,
      askedBy: resolveDisplayName(log.user_id ?? ''),
      askedAt: formatDate(log.created_at, true),
    };
  });

  return { chatbotUsage, quizResults, loginActivity, knowledgeGaps };
}

export async function getBookmarkedMessageIds(userId: string, sessionId: string): Promise<string[]> {
  const messages = await sql<{ id: string }[]>`
    SELECT id FROM chat_messages WHERE session_id = ${sessionId}
  `;
  const messageIds = messages.map((m) => m.id);
  if (!messageIds.length) return [];

  const bookmarks = await sql<{ message_id: string }[]>`
    SELECT message_id FROM chat_bookmarks
    WHERE user_id = ${userId} AND message_id = ANY(${messageIds})
  `;
  return bookmarks.map((b) => b.message_id);
}

export async function getProjectBookmarks(
  userId: string,
  projectId: string,
): Promise<Array<ChatBookmarkRecord & { message: ChatMessageRecord }>> {
  const rows = await sql`
    SELECT cb.*, row_to_json(cm) as message
    FROM chat_bookmarks cb
    JOIN chat_messages cm ON cm.id = cb.message_id
    WHERE cb.user_id = ${userId} AND cb.project_id = ${projectId}
    ORDER BY cb.created_at DESC
  `;
  return rows.filter((b) => b.message != null) as Array<ChatBookmarkRecord & { message: ChatMessageRecord }>;
}

export async function logActivity({
  userId,
  projectId,
  action,
  metadata,
}: {
  userId: string | null;
  projectId?: string | null;
  action: string;
  metadata?: Record<string, unknown> | null;
}) {
  await sql`
    INSERT INTO activity_log (user_id, project_id, action, metadata)
    VALUES (${userId}, ${projectId ?? null}, ${action}, ${metadata ? sql.json(metadata) : null})
  `;
}

export async function getMemberDashboardStats(userId: string) {
  const rows = await sql<{ project_id: string }[]>`
    SELECT project_id FROM project_members WHERE user_id = ${userId}
  `;
  const projectIds = rows.map((r) => r.project_id);

  if (!projectIds.length) {
    return {
      totalProjects: 0,
      completedQuizzes: 0,
      inProgressQuizzes: 0,
      pendingQuizProjects: 0,
      totalDocs: 0,
      recentActivity: [] as Array<{ action: string; projectName: string | null; createdAt: string }>,
      recentBookmarks: [] as Array<{ projectName: string; content: string; createdAt: string }>,
    };
  }

  const [docRows, attemptRows, activityRows, bookmarkRows] = await Promise.all([
    sql<{ c: string }[]>`SELECT COUNT(*) as c FROM documents WHERE project_id = ANY(${projectIds})`,
    sql<{ status: string }[]>`SELECT status FROM quiz_attempts WHERE user_id = ${userId} AND project_id = ANY(${projectIds})`,
    sql<{ action: string; project_id: string | null; created_at: string }[]>`
      SELECT al.action, al.project_id, al.created_at
      FROM activity_log al
      WHERE al.user_id = ${userId}
      ORDER BY al.created_at DESC
      LIMIT 8
    `,
    sql<{ project_name: string; content: string; created_at: string }[]>`
      SELECT p.name AS project_name, cm.content, cb.created_at
      FROM chat_bookmarks cb
      JOIN chat_messages cm ON cm.id = cb.message_id
      JOIN projects p ON p.id = cb.project_id
      WHERE cb.user_id = ${userId}
      ORDER BY cb.created_at DESC
      LIMIT 3
    `,
  ]);

  const projectNames = projectIds.length
    ? await sql<{ id: string; name: string }[]>`SELECT id, name FROM projects WHERE id = ANY(${projectIds})`
    : [];
  const nameMap = new Map(projectNames.map((p) => [p.id, p.name]));

  const completedCount = attemptRows.filter((a) => a.status === 'submitted').length;
  const inProgressCount = attemptRows.filter((a) => a.status === 'in_progress').length;

  return {
    totalProjects: projectIds.length,
    completedQuizzes: completedCount,
    inProgressQuizzes: inProgressCount,
    pendingQuizProjects: Math.max(0, projectIds.length - completedCount - inProgressCount),
    totalDocs: Number(docRows[0]?.c ?? 0),
    recentActivity: activityRows.map((a) => ({
      action: a.action,
      projectName: a.project_id ? (nameMap.get(a.project_id) ?? null) : null,
      createdAt: a.created_at,
    })),
    recentBookmarks: bookmarkRows.map((b) => ({
      projectName: b.project_name,
      content: b.content,
      createdAt: b.created_at,
    })),
  };
}

export async function getMemberNotificationCount(userId: string): Promise<number> {
  const rows = await sql<{ c: string }[]>`
    SELECT COUNT(*) AS c
    FROM project_members pm
    JOIN projects p ON p.id = pm.project_id AND p.is_active = true
    WHERE pm.user_id = ${userId}
      AND NOT EXISTS (
        SELECT 1 FROM quiz_attempts qa
        WHERE qa.user_id = pm.user_id AND qa.project_id = pm.project_id AND qa.status = 'submitted'
      )
  `;
  return Number(rows[0]?.c ?? 0);
}

export async function getObservabilityMetrics(projectId: string): Promise<ObservabilityMetrics> {
  const empty: ObservabilityMetrics = {
    totalRequests: 0,
    retrievalHitRate: 0,
    avgSimilarityScore: 0,
    refusalRate: 0,
    possibleHallucinationCount: 0,
    slowQueryCount: 0,
    tokenUsageByDay: [],
    topUnansweredQueries: [],
    possibleHallucinations: [],
    slowQueries: [],
  };

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [summaryRows, unansweredRows, hallucinationRows, slowRows, tokenRows] = await Promise.all([
    sql`SELECT * FROM get_rag_trace_summary(${projectId})`,
    sql`
      SELECT query_text FROM rag_traces
      WHERE project_id = ${projectId} AND answer_refused = true
      ORDER BY created_at DESC LIMIT 200
    `,
    sql`
      SELECT query_text, max_similarity, created_at FROM rag_traces
      WHERE project_id = ${projectId} AND possible_hallucination = true
      ORDER BY created_at DESC LIMIT 50
    `,
    sql`
      SELECT query_text, total_ms, generation_ms, created_at FROM rag_traces
      WHERE project_id = ${projectId} AND is_slow = true
      ORDER BY total_ms DESC LIMIT 50
    `,
    sql`
      SELECT created_at, prompt_tokens, completion_tokens, total_tokens FROM rag_traces
      WHERE project_id = ${projectId} AND total_tokens IS NOT NULL AND created_at >= ${thirtyDaysAgo}
      ORDER BY created_at ASC
    `,
  ]);

  const summary = summaryRows[0];
  if (!summary) return empty;

  const totalRequests = Number(summary.total_requests ?? 0);
  const retrievalHitRate = totalRequests > 0
    ? Math.round((Number(summary.hit_count ?? 0) / totalRequests) * 100)
    : 0;
  const refusalRate = totalRequests > 0
    ? Math.round((Number(summary.refused_count ?? 0) / totalRequests) * 100)
    : 0;

  const dayMap = new Map<string, { promptTokens: number; completionTokens: number; totalTokens: number }>();
  for (const row of tokenRows) {
    const day = new Date(row.created_at as string | Date).toISOString().slice(0, 10);
    const existing = dayMap.get(day) ?? { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    dayMap.set(day, {
      promptTokens: existing.promptTokens + (Number(row.prompt_tokens) || 0),
      completionTokens: existing.completionTokens + (Number(row.completion_tokens) || 0),
      totalTokens: existing.totalTokens + (Number(row.total_tokens) || 0),
    });
  }
  const tokenUsageByDay = [...dayMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, vals]) => ({ date, ...vals }));

  const queryCounts = new Map<string, number>();
  for (const row of unansweredRows) {
    const key = (row.query_text as string).trim().toLowerCase();
    queryCounts.set(key, (queryCounts.get(key) ?? 0) + 1);
  }
  const topUnansweredQueries = [...queryCounts.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, 20)
    .map(([query, occurrences]) => ({ query, occurrences }));

  const possibleHallucinations = hallucinationRows.map((row) => ({
    query: row.query_text as string,
    maxSimilarity: `${(Number(row.max_similarity ?? 0) * 100).toFixed(0)}%`,
    askedAt: formatDate(row.created_at as string, true),
  }));

  const slowQueries = slowRows.map((row) => ({
    query: row.query_text as string,
    totalMs: Number(row.total_ms ?? 0),
    generationMs: Number(row.generation_ms ?? 0),
    askedAt: formatDate(row.created_at as string, true),
  }));

  return {
    totalRequests,
    retrievalHitRate,
    avgSimilarityScore: Number(summary.avg_similarity ?? 0),
    refusalRate,
    possibleHallucinationCount: Number(summary.hallucination_count ?? 0),
    slowQueryCount: Number(summary.slow_count ?? 0),
    tokenUsageByDay,
    topUnansweredQueries,
    possibleHallucinations,
    slowQueries,
  };
}
