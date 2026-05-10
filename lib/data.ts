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
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server';
import { computeSectionScores } from '@/lib/quiz/scoring';
import { formatDate } from '@/lib/utils';

export async function getProfileById(userId: string) {
  const supabase = createServiceRoleSupabaseClient();

  if (!supabase) {
    return null;
  }

  const { data } = await supabase.from('users').select('*').eq('id', userId).maybeSingle<UserProfile>();
  return data ?? null;
}

export async function getAssignedProjects(userId: string) {
  const supabase = createServiceRoleSupabaseClient();

  if (!supabase) {
    return [] as ProjectDashboardCard[];
  }

  const { data: memberships } = await supabase.from('project_members').select('project_id').eq('user_id', userId);
  const projectIds = (memberships ?? []).map((membership) => membership.project_id);

  if (!projectIds.length) {
    return [] as ProjectDashboardCard[];
  }

  const { data: projects } = await supabase.from('projects').select('*').in('id', projectIds).order('created_at', { ascending: false });
  const { data: documents } = await supabase.from('documents').select('project_id').in('project_id', projectIds);
  const { data: attempts } = await supabase.from('quiz_attempts').select('*').eq('user_id', userId);

  return ((projects ?? []) as ProjectRecord[])
    .filter((project) => project.is_active)
    .map((project) => {
      const projectDocuments = (documents ?? []).filter((document) => document.project_id === project.id).length;
      const attempt = (attempts ?? []).find((entry) => entry.project_id === project.id) as QuizAttemptRecord | undefined;

      return {
        ...project,
        documentCount: projectDocuments,
        quizStatus: attempt?.status === 'submitted' ? 'Completed' : attempt?.status === 'in_progress' ? 'In Progress' : 'Not Started',
        quizScoreLabel:
          attempt?.status === 'submitted' && attempt.score != null && attempt.total_marks != null
            ? `${attempt.score}/${attempt.total_marks}`
            : null,
      } satisfies ProjectDashboardCard;
    });
}

export async function getProjectById(projectId: string) {
  const supabase = createServiceRoleSupabaseClient();

  if (!supabase) {
    return null;
  }

  const { data } = await supabase.from('projects').select('*').eq('id', projectId).maybeSingle<ProjectRecord>();
  return data ?? null;
}

export async function getProjectDocuments(projectId: string) {
  const supabase = createServiceRoleSupabaseClient();

  if (!supabase) {
    return [] as DocumentRecord[];
  }

  const { data } = await supabase
    .from('documents')
    .select('*')
    .eq('project_id', projectId)
    .order('uploaded_at', { ascending: false });

  return (data ?? []) as DocumentRecord[];
}

export async function getProjectMembers(projectId: string) {
  const supabase = createServiceRoleSupabaseClient();

  if (!supabase) {
    return [] as Array<UserProfile & { assigned_at: string }>;
  }

  const { data: members } = await supabase
    .from('project_members')
    .select('assigned_at,user:users(*)')
    .eq('project_id', projectId)
    .order('assigned_at', { ascending: true });

  return (members ?? [])
    .map((member) => {
      const user = Array.isArray(member.user) ? member.user[0] : member.user;
      if (!user) {
        return null;
      }

      return {
        ...(user as UserProfile),
        assigned_at: member.assigned_at as string,
      };
    })
    .filter(Boolean) as Array<UserProfile & { assigned_at: string }>;
}

export async function getQuizAttemptForProject(userId: string, projectId: string) {
  const supabase = createServiceRoleSupabaseClient();

  if (!supabase) {
    return null;
  }

  const { data } = await supabase
    .from('quiz_attempts')
    .select('*')
    .eq('user_id', userId)
    .eq('project_id', projectId)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle<QuizAttemptRecord>();

  return data ?? null;
}

export async function getProjectChatSessions(userId: string, projectId: string) {
  const supabase = createServiceRoleSupabaseClient();

  if (!supabase) {
    return [] as ChatSessionRecord[];
  }

  const { data } = await supabase
    .from('chat_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('project_id', projectId)
    .order('last_message_at', { ascending: false });

  return (data ?? []) as ChatSessionRecord[];
}

export async function getChatMessages(sessionId: string) {
  const supabase = createServiceRoleSupabaseClient();

  if (!supabase) {
    return [] as ChatMessageRecord[];
  }

  const { data } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  return (data ?? []) as ChatMessageRecord[];
}

export async function userHasProjectAccess(userId: string, role: UserProfile['role'] | null | undefined, projectId: string) {
  if (role === 'admin') {
    return true;
  }

  const supabase = createServiceRoleSupabaseClient();

  if (!supabase) {
    return false;
  }

  const { data } = await supabase
    .from('project_members')
    .select('id')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .maybeSingle();

  return Boolean(data);
}

export async function getAdminDashboardStats() {
  const supabase = createServiceRoleSupabaseClient();

  if (!supabase) {
    return {
      totalUsers: 0,
      activeUsers: 0,
      totalMessages: 0,
      quizCompletionRate: 0,
      recentActivity: [] as ActivityRecord[],
    };
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [{ count: totalUsers }, { count: activeUsers }, { count: totalMessages }, { count: totalDocuments }, { count: completedQuizzes }, { count: totalAttempts }, { data: recentActivity }] = await Promise.all([
    supabase.from('users').select('*', { count: 'exact', head: true }),
    supabase.from('users').select('*', { count: 'exact', head: true }).gte('last_login_at', sevenDaysAgo),
    supabase.from('chat_messages').select('*', { count: 'exact', head: true }),
    supabase.from('documents').select('*', { count: 'exact', head: true }),
    supabase.from('quiz_attempts').select('*', { count: 'exact', head: true }).eq('status', 'submitted'),
    supabase.from('quiz_attempts').select('*', { count: 'exact', head: true }),
    supabase.from('activity_log').select('*, user:users(full_name, email)').order('created_at', { ascending: false }).limit(10),
  ]);

  type ActivityWithUser = ActivityRecord & { user: { full_name: string | null; email: string | null } | null };

  const enrichedActivity = ((recentActivity ?? []) as ActivityWithUser[]).map((item) => {
    const rawName = item.user?.full_name;
    const name = (rawName && rawName !== 'undefined' && rawName.trim())
      ? rawName
      : (item.user?.email ?? null);
    return { ...item, userName: name };
  });

  return {
    totalUsers: totalUsers ?? 0,
    activeUsers: activeUsers ?? 0,
    totalMessages: totalMessages ?? 0,
    totalDocuments: totalDocuments ?? 0,
    quizCompletionRate: totalAttempts ? Math.round(((completedQuizzes ?? 0) / totalAttempts) * 100) : 0,
    recentActivity: enrichedActivity,
  };
}

export async function getAllProjects() {
  const supabase = createServiceRoleSupabaseClient();

  if (!supabase) {
    return [] as ProjectRecord[];
  }

  const { data } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
  return (data ?? []) as ProjectRecord[];
}

export async function getProjectQuizSets(projectId: string) {
  const supabase = createServiceRoleSupabaseClient();

  if (!supabase) {
    return [] as Array<QuizSetRecord & { questions: QuizQuestionRecord[] }>;
  }

  const { data: sets } = await supabase
    .from('quiz_sets')
    .select('*')
    .eq('project_id', projectId)
    .order('set_number', { ascending: true });

  const { data: questions } = await supabase.from('quiz_questions').select('*').in(
    'quiz_set_id',
    ((sets ?? []) as QuizSetRecord[]).map((set) => set.id),
  );

  return ((sets ?? []) as QuizSetRecord[]).map((set) => ({
    ...set,
    questions: ((questions ?? []) as QuizQuestionRecord[]).filter((question) => question.quiz_set_id === set.id),
  }));
}

export async function getAllUsers() {
  const supabase = createServiceRoleSupabaseClient();

  if (!supabase) {
    return [] as UserProfile[];
  }

  const { data } = await supabase.from('users').select('*').order('created_at', { ascending: false });
  return (data ?? []) as UserProfile[];
}

export async function getProjectAnalytics(projectId: string) {
  const supabase = createServiceRoleSupabaseClient();

  if (!supabase) {
    return { chatbotUsage: [], quizResults: [], loginActivity: [], knowledgeGaps: [] };
  }

  // Fetch project members first — needed for login activity
  const { data: memberRows } = await supabase
    .from('project_members')
    .select('user_id, assigned_at')
    .eq('project_id', projectId);

  const memberIds = (memberRows ?? []).map((m: { user_id: string; assigned_at: string }) => m.user_id);
  const memberAssignedAt = new Map(
    (memberRows ?? []).map((m: { user_id: string; assigned_at: string }) => [m.user_id, m.assigned_at]),
  );

  const [{ data: sessions }, { data: attempts }, { data: users }, { data: quizSets }, { data: resets }, { data: gapLogs }] = await Promise.all([
    supabase.from('chat_sessions').select('*').eq('project_id', projectId),
    supabase.from('quiz_attempts').select('*').eq('project_id', projectId).eq('status', 'submitted'),
    supabase.from('users').select('*'),
    supabase.from('quiz_sets').select('id,set_name').eq('project_id', projectId),
    supabase.from('quiz_resets').select('user_id').eq('project_id', projectId),
    supabase
      .from('activity_log')
      .select('metadata, created_at, user_id')
      .eq('project_id', projectId)
      .eq('action', 'knowledge_gap')
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  const resetCounts = new Map<string, number>();
  ((resets ?? []) as Array<{ user_id: string }>).forEach((r) => {
    resetCounts.set(r.user_id, (resetCounts.get(r.user_id) ?? 0) + 1);
  });

  const userIndex = new Map(((users ?? []) as UserProfile[]).map((user) => [user.id, user]));
  const setIndex = new Map(((quizSets ?? []) as { id: string; set_name: string }[]).map((s) => [s.id, s.set_name]));

  function resolveDisplayName(userId: string) {
    const user = userIndex.get(userId);
    return (user?.full_name && user.full_name !== 'undefined' && user.full_name.trim())
      ? user.full_name
      : (user?.email ?? userId.slice(0, 8));
  }

  const chatbotUsage = ((sessions ?? []) as ChatSessionRecord[]).map((session) => ({
    name: resolveDisplayName(session.user_id),
    email: userIndex.get(session.user_id)?.email ?? '—',
    sessions: 1,
    messages: session.message_count,
    lastActive: formatDate(session.last_message_at ?? session.started_at, true),
  }));

  const quizResults = ((attempts ?? []) as QuizAttemptRecord[]).map((attempt) => {
    const user = userIndex.get(attempt.user_id);

    // Determine which sections were included by reading assigned_questions directly
    const assignedQs = (attempt.assigned_questions ?? []) as Array<{ section?: string }>;
    const sectionSet = [...new Set(assignedQs.map((q) => q.section).filter(Boolean))];

    // Merge with carried sections for display
    const carriedKeys = Object.keys(attempt.carried_sections ?? {});
    const allSections = [...new Set([...sectionSet, ...carriedKeys])];

    const sectionLabel = allSections.length > 0
      ? allSections.map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' + ')
      : (setIndex.get(attempt.quiz_set_id) ?? 'Unknown');

    // Compute per-section scores (retaken sections from JSONB, carried from carried_sections)
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

  // Login activity is derived from project member profiles (last_login_at from users table)
  const loginActivity = memberIds.map((userId) => {
    const user = userIndex.get(userId);
    return {
      name: resolveDisplayName(userId),
      email: user?.email ?? '—',
      lastLogin: formatDate(user?.last_login_at, true),
      joinedProject: formatDate(memberAssignedAt.get(userId)),
    };
  });

  const knowledgeGaps = (gapLogs ?? []).map((log) => {
    const meta = (log.metadata ?? {}) as Record<string, unknown>;
    return {
      query:      (meta.query as string) ?? '—',
      confidence: `${(((meta.maxSimilarity as number) ?? 0) * 100).toFixed(0)}%`,
      askedBy:    resolveDisplayName(log.user_id ?? ''),
      askedAt:    formatDate(log.created_at, true),
    };
  });

  return { chatbotUsage, quizResults, loginActivity, knowledgeGaps };
}

export async function getBookmarkedMessageIds(userId: string, sessionId: string): Promise<string[]> {
  const supabase = createServiceRoleSupabaseClient();
  if (!supabase) return [];

  // Get message IDs for the session first
  const { data: messages } = await supabase
    .from('chat_messages')
    .select('id')
    .eq('session_id', sessionId);

  const messageIds = (messages ?? []).map((m) => m.id);
  if (!messageIds.length) return [];

  const { data: bookmarks } = await supabase
    .from('chat_bookmarks')
    .select('message_id')
    .eq('user_id', userId)
    .in('message_id', messageIds);

  return (bookmarks ?? []).map((b) => b.message_id);
}

export async function getProjectBookmarks(
  userId: string,
  projectId: string,
): Promise<Array<ChatBookmarkRecord & { message: ChatMessageRecord }>> {
  const supabase = createServiceRoleSupabaseClient();
  if (!supabase) return [];

  const { data: bookmarks } = await supabase
    .from('chat_bookmarks')
    .select('*, message:chat_messages(*)')
    .eq('user_id', userId)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  return ((bookmarks ?? []) as Array<ChatBookmarkRecord & { message: ChatMessageRecord }>).filter(
    (b) => b.message != null,
  );
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
  const supabase = createServiceRoleSupabaseClient();

  if (!supabase) {
    return;
  }

  await supabase.from('activity_log').insert({
    user_id: userId,
    project_id: projectId ?? null,
    action,
    metadata: metadata ?? null,
  });
}