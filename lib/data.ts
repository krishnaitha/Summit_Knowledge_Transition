import 'server-only';

import { unstable_cache } from 'next/cache';

import type {
  AccessibleDocumentSearchResult,
  ActivityRecord,
  AssignedQuestion,
  ChatAnswerFeedbackRecord,
  ChatBookmarkRecord,
  ChatMessageRecord,
  ChatSessionRecord,
  DocumentConnectorRecord,
  DocumentRecord,
  DocumentSearchResult,
  DocumentThreadCommentRecord,
  DocumentThreadRecord,
  FlashcardRecord,
  Json,
  ProjectAnnouncementRecord,
  ProjectDashboardCard,
  ProjectRecord,
  QuizAttemptHistoryRecord,
  QuizAttemptRecord,
  QuizCoachingPlanRecord,
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
  tokenUsageByDay: Array<{
    date: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  }>;
  topUnansweredQueries: Array<{ query: string; occurrences: number }>;
  possibleHallucinations: Array<{ query: string; maxSimilarity: string; askedAt: string }>;
  slowQueries: Array<{ query: string; totalMs: number; generationMs: number; askedAt: string }>;
}

export interface SystemErrorEvent {
  id: string;
  source: string;
  category: string;
  message: string;
  stack: string | null;
  metadata: Json | null;
  createdAt: string;
}

export interface SystemHealthSnapshot {
  checkedAt: string;
  databaseHealthy: boolean;
  workerHealthy: boolean;
  pendingJobs: number;
  runningJobs: number;
  failedJobs24h: number;
  failedJobsTotal: number;
  appErrors24h: number;
  lastWorkerActivityAt: string | null;
  ragRequestsLastHour: number;
  ragAvgLatencyMsLastHour: number;
  errors: SystemErrorEvent[];
}

import sql from '@/lib/db';
import { computeSectionScores } from '@/lib/quiz/scoring';
import { formatDate } from '@/lib/utils';

export interface DocumentThreadCommentView extends DocumentThreadCommentRecord {
  author_name: string | null;
  author_email: string | null;
  author_global_role: UserProfile['role'] | null;
  author_project_role: 'admin' | 'member' | null;
}

export interface DocumentThreadView extends DocumentThreadRecord {
  creator_name: string | null;
  creator_email: string | null;
  comment_count: number;
  comments: DocumentThreadCommentView[];
}

export interface FlashcardView extends FlashcardRecord {
  document_id: string | null;
  document_name: string | null;
  chunk_index: number | null;
  snippet: string | null;
  due_at: string;
  repetitions: number;
  interval_days: number;
  ease_factor: number;
  last_reviewed_at: string | null;
  is_due: boolean;
}

export interface InteractiveStudyGuide {
  weakSections: Array<{ section: string; score: number; total: number; percentage: number }>;
  recommendations: Array<{
    section: string;
    focus: string;
    documents: Array<{ id: string; name: string }>;
    chunkReferences: Array<{
      chunkId: string;
      documentId: string;
      documentName: string;
      chunkIndex: number;
      snippet: string;
    }>;
  }>;
}

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

  const [projects, documents, attempts, viewedDocs, newDocRows, openThreadRows] = await Promise.all(
    [
      sql<
        ProjectRecord[]
      >`SELECT * FROM projects WHERE id = ANY(${projectIds}) ORDER BY created_at DESC`,
      sql<
        { project_id: string }[]
      >`SELECT project_id FROM documents WHERE project_id = ANY(${projectIds})`,
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
      sql<{ project_id: string; c: string }[]>`
      SELECT project_id, COUNT(*) AS c
      FROM document_threads
      WHERE project_id = ANY(${projectIds}) AND status = 'open'
      GROUP BY project_id
    `,
    ],
  );

  const viewedMap = new Map(viewedDocs.map((v) => [v.project_id, Number(v.c)]));
  const newDocProjects = new Set(newDocRows.map((n) => n.project_id));
  const openThreadMap = new Map(openThreadRows.map((r) => [r.project_id, Number(r.c)]));

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
        openThreadCount: openThreadMap.get(project.id) ?? 0,
        quizCloseAt: project.quiz_close_at ?? null,
        quizStatus:
          attempt?.status === 'submitted'
            ? 'Completed'
            : attempt?.status === 'in_progress'
              ? 'In Progress'
              : 'Not Started',
        quizScoreLabel:
          attempt?.status === 'submitted' && attempt.score != null && attempt.total_marks != null
            ? `${attempt.score}/${attempt.total_marks}`
            : null,
        quizPercentage:
          attempt?.status === 'submitted' && attempt.percentage != null
            ? Number(attempt.percentage)
            : null,
        quizPassed:
          attempt?.status === 'submitted' && attempt.passed != null ? attempt.passed : null,
      } satisfies ProjectDashboardCard;
    });
}

export async function getProjectById(projectId: string) {
  const rows = await sql<ProjectRecord[]>`SELECT * FROM projects WHERE id = ${projectId} LIMIT 1`;
  return rows[0] ?? null;
}

export async function getProjectDocuments(projectId: string) {
  return sql<DocumentRecord[]>`
    SELECT
      d.id,
      d.project_id,
      d.file_name,
      d.file_url,
      d.file_type,
      d.uploaded_by,
      d.uploaded_at,
      d.chunk_count,
      d.pii_detections,
      d.classification,
      d.is_required,
      d.scan_flags,
      d.source_connector_id,
      d.source_provider,
      d.source_item_id,
      d.source_url,
      d.source_synced_at,
      preview.preview_excerpt
    FROM documents d
    LEFT JOIN LATERAL (
      SELECT LEFT(content, 320) AS preview_excerpt
      FROM document_chunks
      WHERE document_id = d.id
      ORDER BY chunk_index ASC
      LIMIT 1
    ) preview ON true
    WHERE project_id = ${projectId}
    ORDER BY d.uploaded_at DESC
  `;
}

export async function getProjectDocumentConnectors(projectId: string) {
  try {
    return await sql<DocumentConnectorRecord[]>`
      SELECT *
      FROM document_connectors
      WHERE project_id = ${projectId}
      ORDER BY created_at DESC
    `;
  } catch {
    return [];
  }
}

export async function getProjectFlashcardsForUser(projectId: string, userId: string, limit = 40) {
  const safeLimit = Math.min(Math.max(limit, 1), 100);

  return sql<FlashcardView[]>`
    SELECT
      f.*,
      d.id AS document_id,
      d.file_name AS document_name,
      dc.chunk_index,
      CASE WHEN dc.content IS NOT NULL THEN LEFT(dc.content, 280) ELSE NULL END AS snippet,
      COALESCE(fp.due_at, now()) AS due_at,
      COALESCE(fp.repetitions, 0) AS repetitions,
      COALESCE(fp.interval_days, 1) AS interval_days,
      COALESCE(fp.ease_factor, 2.5) AS ease_factor,
      fp.last_reviewed_at,
      COALESCE(fp.due_at, now()) <= now() AS is_due
    FROM flashcards f
    LEFT JOIN flashcard_progress fp
      ON fp.flashcard_id = f.id AND fp.user_id = ${userId}
    LEFT JOIN document_chunks dc ON dc.id = f.source_chunk_id
    LEFT JOIN documents d ON d.id = dc.document_id
    WHERE f.project_id = ${projectId}
    ORDER BY COALESCE(fp.due_at, now()) ASC, f.created_at DESC
    LIMIT ${safeLimit}
  `;
}

export async function getInteractiveStudyGuide(
  userId: string,
  projectId: string,
): Promise<InteractiveStudyGuide | null> {
  const plan = await getLatestCoachingPlan(userId, projectId);

  if (!plan) {
    return null;
  }

  const recommendations = plan.recommendations ?? [];
  if (!recommendations.length) {
    return {
      weakSections: plan.weak_sections ?? [],
      recommendations: [],
    };
  }

  const docIds = [...new Set(recommendations.flatMap((r) => (r.documents ?? []).map((d) => d.id)))];

  const chunkRows = docIds.length
    ? await sql<
        {
          chunk_id: string;
          document_id: string;
          document_name: string;
          chunk_index: number;
          content: string;
        }[]
      >`
        SELECT
          dc.id AS chunk_id,
          dc.document_id,
          d.file_name AS document_name,
          dc.chunk_index,
          dc.content
        FROM document_chunks dc
        JOIN documents d ON d.id = dc.document_id
        WHERE dc.project_id = ${projectId} AND dc.document_id = ANY(${docIds})
        ORDER BY dc.chunk_index ASC
        LIMIT 1200
      `
    : await sql<
        {
          chunk_id: string;
          document_id: string;
          document_name: string;
          chunk_index: number;
          content: string;
        }[]
      >`
        SELECT
          dc.id AS chunk_id,
          dc.document_id,
          d.file_name AS document_name,
          dc.chunk_index,
          dc.content
        FROM document_chunks dc
        JOIN documents d ON d.id = dc.document_id
        WHERE dc.project_id = ${projectId}
        ORDER BY dc.chunk_index ASC
        LIMIT 1200
      `;

  const enrichedRecommendations = recommendations.map((recommendation) => {
    const words = `${recommendation.section} ${recommendation.focus}`
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 3);

    const candidateDocIds = new Set((recommendation.documents ?? []).map((doc) => doc.id));

    const scoredChunks = chunkRows
      .filter((chunk) => candidateDocIds.size === 0 || candidateDocIds.has(chunk.document_id))
      .map((chunk) => {
        const lower = chunk.content.toLowerCase();
        const score = words.reduce((acc, word) => (lower.includes(word) ? acc + 1 : acc), 0);
        return { chunk, score };
      })
      .sort((a, b) => b.score - a.score || a.chunk.chunk_index - b.chunk.chunk_index)
      .slice(0, 5)
      .map((item) => ({
        chunkId: item.chunk.chunk_id,
        documentId: item.chunk.document_id,
        documentName: item.chunk.document_name,
        chunkIndex: item.chunk.chunk_index,
        snippet: item.chunk.content.slice(0, 280),
      }));

    return {
      ...recommendation,
      chunkReferences: scoredChunks,
    };
  });

  return {
    weakSections: plan.weak_sections ?? [],
    recommendations: enrichedRecommendations,
  };
}

export async function getDocumentById(documentId: string) {
  const rows = await sql<DocumentRecord[]>`
    SELECT * FROM documents WHERE id = ${documentId} LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function getDocumentThreads(projectId: string, documentId: string) {
  const threadRows = await sql<
    (DocumentThreadRecord & {
      creator_name: string | null;
      creator_email: string | null;
      comment_count: string;
    })[]
  >`
    SELECT
      t.*,
      u.full_name as creator_name,
      u.email as creator_email,
      COALESCE(c.comment_count, 0)::text as comment_count
    FROM document_threads t
    LEFT JOIN users u ON u.id = t.created_by
    LEFT JOIN (
      SELECT thread_id, COUNT(*) as comment_count
      FROM document_thread_comments
      GROUP BY thread_id
    ) c ON c.thread_id = t.id
    WHERE t.project_id = ${projectId} AND t.document_id = ${documentId}
    ORDER BY t.status ASC, t.updated_at DESC
  `;

  if (!threadRows.length) {
    return [] as DocumentThreadView[];
  }

  const threadIds = threadRows.map((thread) => thread.id);
  const commentRows = await sql<
    (DocumentThreadCommentRecord & {
      author_name: string | null;
      author_email: string | null;
      author_global_role: UserProfile['role'] | null;
      author_project_role: 'admin' | 'member' | null;
    })[]
  >`
    SELECT
      c.*,
      u.full_name as author_name,
      u.email as author_email,
      u.role as author_global_role,
      pm.role as author_project_role
    FROM document_thread_comments c
    LEFT JOIN users u ON u.id = c.author_id
    LEFT JOIN project_members pm ON pm.user_id = c.author_id AND pm.project_id = ${projectId}
    WHERE c.thread_id = ANY(${threadIds})
    ORDER BY c.created_at ASC
  `;

  const commentsByThread = new Map<string, DocumentThreadCommentView[]>();
  for (const comment of commentRows) {
    const next: DocumentThreadCommentView = {
      ...comment,
      author_name: comment.author_name,
      author_email: comment.author_email,
      author_global_role: comment.author_global_role,
      author_project_role: comment.author_project_role,
    };
    const current = commentsByThread.get(comment.thread_id) ?? [];
    current.push(next);
    commentsByThread.set(comment.thread_id, current);
  }

  return threadRows.map((thread) => ({
    ...thread,
    comment_count: Number(thread.comment_count ?? 0),
    comments: commentsByThread.get(thread.id) ?? [],
  }));
}

async function hasDocumentChunkSearchVector() {
  const rows = await sql<{ has_search_vector: boolean }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'document_chunks'
        AND column_name = 'search_vector'
    ) AS has_search_vector
  `;

  return rows[0]?.has_search_vector ?? false;
}

export async function searchProjectDocumentChunks(projectId: string, query: string, limit = 12) {
  const normalizedQuery = query.trim();

  if (normalizedQuery.length < 2) {
    return [] as DocumentSearchResult[];
  }

  const cappedLimit = Math.min(Math.max(limit, 1), 30);
  const hasSearchVector = await hasDocumentChunkSearchVector();

  if (!hasSearchVector) {
    return sql<DocumentSearchResult[]>`
      WITH q AS (
        SELECT
          plainto_tsquery('english', ${normalizedQuery}) AS ts_query,
          lower(${normalizedQuery}) AS raw_query
      ),
      query_terms AS (
        SELECT COALESCE(array_agg(cleaned_term), ARRAY[]::text[]) AS terms
        FROM (
          SELECT DISTINCT cleaned_term
          FROM regexp_split_to_table(lower(${normalizedQuery}), '\\s+') AS raw_term(term)
          CROSS JOIN LATERAL (
            SELECT NULLIF(regexp_replace(raw_term.term, '[^a-z0-9]+', '', 'g'), '') AS cleaned_term
          ) cleaned
          WHERE cleaned_term IS NOT NULL AND char_length(cleaned_term) >= 2
        ) filtered_terms
      )
      SELECT
        dc.id AS chunk_id,
        d.id AS document_id,
        d.file_name,
        CASE
          WHEN numnode(q.ts_query) > 0 AND to_tsvector('english', dc.content) @@ q.ts_query THEN ts_headline(
            'english',
            dc.content,
            q.ts_query,
            'StartSel=<<H>>,StopSel=<</H>>,MaxFragments=2,MinWords=6,MaxWords=24,FragmentDelimiter= ... '
          )
          ELSE LEFT(dc.content, 280)
        END AS snippet,
        (
          CASE
            WHEN numnode(q.ts_query) > 0 AND to_tsvector('english', dc.content) @@ q.ts_query
              THEN 100 + ts_rank_cd(to_tsvector('english', dc.content), q.ts_query)
            WHEN lower(dc.content) LIKE '%' || q.raw_query || '%'
              THEN 10
            ELSE 0
          END
          + COALESCE((
            SELECT COUNT(*)::float8
            FROM unnest(query_terms.terms) AS query_term(term_value)
            WHERE lower(dc.content) LIKE '%' || term_value || '%'
          ), 0)
        ) AS rank
      FROM document_chunks dc
      JOIN documents d ON d.id = dc.document_id
      CROSS JOIN q
      CROSS JOIN query_terms
      WHERE dc.project_id = ${projectId}
        AND (
          (numnode(q.ts_query) > 0 AND to_tsvector('english', dc.content) @@ q.ts_query)
          OR lower(dc.content) LIKE '%' || q.raw_query || '%'
          OR (
            COALESCE(array_length(query_terms.terms, 1), 0) > 0
            AND NOT EXISTS (
              SELECT 1
              FROM unnest(query_terms.terms) AS query_term(term_value)
              WHERE lower(dc.content) NOT LIKE '%' || term_value || '%'
            )
          )
        )
      ORDER BY rank DESC, d.file_name ASC
      LIMIT ${cappedLimit}
    `;
  }

  return sql<DocumentSearchResult[]>`
    WITH q AS (
      SELECT
        plainto_tsquery('english', ${normalizedQuery}) AS ts_query,
        lower(${normalizedQuery}) AS raw_query
    ),
    query_terms AS (
      SELECT COALESCE(array_agg(cleaned_term), ARRAY[]::text[]) AS terms
      FROM (
        SELECT DISTINCT cleaned_term
        FROM regexp_split_to_table(lower(${normalizedQuery}), '\\s+') AS raw_term(term)
        CROSS JOIN LATERAL (
          SELECT NULLIF(regexp_replace(raw_term.term, '[^a-z0-9]+', '', 'g'), '') AS cleaned_term
        ) cleaned
        WHERE cleaned_term IS NOT NULL AND char_length(cleaned_term) >= 2
      ) filtered_terms
    )
    SELECT
      dc.id AS chunk_id,
      d.id AS document_id,
      d.file_name,
      CASE
        WHEN numnode(q.ts_query) > 0 AND dc.search_vector @@ q.ts_query THEN ts_headline(
          'english',
          dc.content,
          q.ts_query,
          'StartSel=<<H>>,StopSel=<</H>>,MaxFragments=2,MinWords=6,MaxWords=24,FragmentDelimiter= ... '
        )
        ELSE LEFT(dc.content, 280)
      END AS snippet,
      (
        CASE
          WHEN numnode(q.ts_query) > 0 AND dc.search_vector @@ q.ts_query
            THEN 100 + ts_rank_cd(dc.search_vector, q.ts_query)
          WHEN lower(dc.content) LIKE '%' || q.raw_query || '%'
            THEN 10
          ELSE 0
        END
        + COALESCE((
          SELECT COUNT(*)::float8
          FROM unnest(query_terms.terms) AS query_term(term_value)
          WHERE lower(dc.content) LIKE '%' || term_value || '%'
        ), 0)
      ) AS rank
    FROM document_chunks dc
    JOIN documents d ON d.id = dc.document_id
    CROSS JOIN q
    CROSS JOIN query_terms
    WHERE dc.project_id = ${projectId}
      AND (
        (numnode(q.ts_query) > 0 AND dc.search_vector @@ q.ts_query)
        OR lower(dc.content) LIKE '%' || q.raw_query || '%'
        OR (
          COALESCE(array_length(query_terms.terms, 1), 0) > 0
          AND NOT EXISTS (
            SELECT 1
            FROM unnest(query_terms.terms) AS query_term(term_value)
            WHERE lower(dc.content) NOT LIKE '%' || term_value || '%'
          )
        )
      )
    ORDER BY rank DESC, d.file_name ASC
    LIMIT ${cappedLimit}
  `;
}

export async function searchAccessibleDocumentChunks(
  userId: string,
  role: UserProfile['role'] | null | undefined,
  query: string,
  limit = 20,
  projectId?: string,
) {
  const normalizedQuery = query.trim();
  const normalizedProjectId = (projectId ?? '').trim();
  const projectFilterId =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      normalizedProjectId,
    )
      ? normalizedProjectId
      : null;

  if (normalizedQuery.length < 2) {
    return [] as AccessibleDocumentSearchResult[];
  }

  const cappedLimit = Math.min(Math.max(limit, 1), 50);
  const hasSearchVector = await hasDocumentChunkSearchVector();

  if (role === 'admin') {
    if (!hasSearchVector) {
      return sql<AccessibleDocumentSearchResult[]>`
        WITH q AS (
          SELECT
            plainto_tsquery('english', ${normalizedQuery}) AS ts_query,
            lower(${normalizedQuery}) AS raw_query
        ),
        query_terms AS (
          SELECT COALESCE(array_agg(cleaned_term), ARRAY[]::text[]) AS terms
          FROM (
            SELECT DISTINCT cleaned_term
            FROM regexp_split_to_table(lower(${normalizedQuery}), '\\s+') AS raw_term(term)
            CROSS JOIN LATERAL (
              SELECT NULLIF(regexp_replace(raw_term.term, '[^a-z0-9]+', '', 'g'), '') AS cleaned_term
            ) cleaned
            WHERE cleaned_term IS NOT NULL AND char_length(cleaned_term) >= 2
          ) filtered_terms
        )
        SELECT
          d.project_id,
          p.name AS project_name,
          dc.id AS chunk_id,
          d.id AS document_id,
          d.file_name,
          CASE
            WHEN numnode(q.ts_query) > 0 AND to_tsvector('english', dc.content) @@ q.ts_query THEN ts_headline(
              'english',
              dc.content,
              q.ts_query,
              'StartSel=<<H>>,StopSel=<</H>>,MaxFragments=2,MinWords=6,MaxWords=24,FragmentDelimiter= ... '
            )
            ELSE LEFT(dc.content, 280)
          END AS snippet,
          (
            CASE
              WHEN numnode(q.ts_query) > 0 AND to_tsvector('english', dc.content) @@ q.ts_query
                THEN 100 + ts_rank_cd(to_tsvector('english', dc.content), q.ts_query)
              WHEN lower(dc.content) LIKE '%' || q.raw_query || '%'
                THEN 10
              ELSE 0
            END
            + COALESCE((
              SELECT COUNT(*)::float8
              FROM unnest(query_terms.terms) AS query_term(term_value)
              WHERE lower(dc.content) LIKE '%' || term_value || '%'
            ), 0)
          ) AS rank
        FROM document_chunks dc
        JOIN documents d ON d.id = dc.document_id
        JOIN projects p ON p.id = d.project_id
        CROSS JOIN q
        CROSS JOIN query_terms
        WHERE (${projectFilterId}::uuid IS NULL OR d.project_id = ${projectFilterId}::uuid)
          AND (
          (numnode(q.ts_query) > 0 AND to_tsvector('english', dc.content) @@ q.ts_query)
          OR lower(dc.content) LIKE '%' || q.raw_query || '%'
          OR (
            COALESCE(array_length(query_terms.terms, 1), 0) > 0
            AND NOT EXISTS (
              SELECT 1
              FROM unnest(query_terms.terms) AS query_term(term_value)
              WHERE lower(dc.content) NOT LIKE '%' || term_value || '%'
            )
          )
        )
        ORDER BY rank DESC, p.name ASC, d.file_name ASC
        LIMIT ${cappedLimit}
      `;
    }

    return sql<AccessibleDocumentSearchResult[]>`
      WITH q AS (
        SELECT
          plainto_tsquery('english', ${normalizedQuery}) AS ts_query,
          lower(${normalizedQuery}) AS raw_query
      ),
      query_terms AS (
        SELECT COALESCE(array_agg(cleaned_term), ARRAY[]::text[]) AS terms
        FROM (
          SELECT DISTINCT cleaned_term
          FROM regexp_split_to_table(lower(${normalizedQuery}), '\\s+') AS raw_term(term)
          CROSS JOIN LATERAL (
            SELECT NULLIF(regexp_replace(raw_term.term, '[^a-z0-9]+', '', 'g'), '') AS cleaned_term
          ) cleaned
          WHERE cleaned_term IS NOT NULL AND char_length(cleaned_term) >= 2
        ) filtered_terms
      )
      SELECT
        d.project_id,
        p.name AS project_name,
        dc.id AS chunk_id,
        d.id AS document_id,
        d.file_name,
        CASE
          WHEN numnode(q.ts_query) > 0 AND dc.search_vector @@ q.ts_query THEN ts_headline(
            'english',
            dc.content,
            q.ts_query,
            'StartSel=<<H>>,StopSel=<</H>>,MaxFragments=2,MinWords=6,MaxWords=24,FragmentDelimiter= ... '
          )
          ELSE LEFT(dc.content, 280)
        END AS snippet,
        (
          CASE
            WHEN numnode(q.ts_query) > 0 AND dc.search_vector @@ q.ts_query
              THEN 100 + ts_rank_cd(dc.search_vector, q.ts_query)
            WHEN lower(dc.content) LIKE '%' || q.raw_query || '%'
              THEN 10
            ELSE 0
          END
          + COALESCE((
            SELECT COUNT(*)::float8
            FROM unnest(query_terms.terms) AS query_term(term_value)
            WHERE lower(dc.content) LIKE '%' || term_value || '%'
          ), 0)
        ) AS rank
      FROM document_chunks dc
      JOIN documents d ON d.id = dc.document_id
      JOIN projects p ON p.id = d.project_id
      CROSS JOIN q
      CROSS JOIN query_terms
      WHERE (${projectFilterId}::uuid IS NULL OR d.project_id = ${projectFilterId}::uuid)
        AND (
        (numnode(q.ts_query) > 0 AND dc.search_vector @@ q.ts_query)
        OR lower(dc.content) LIKE '%' || q.raw_query || '%'
        OR (
          COALESCE(array_length(query_terms.terms, 1), 0) > 0
          AND NOT EXISTS (
            SELECT 1
            FROM unnest(query_terms.terms) AS query_term(term_value)
            WHERE lower(dc.content) NOT LIKE '%' || term_value || '%'
          )
        )
      )
      ORDER BY rank DESC, p.name ASC, d.file_name ASC
      LIMIT ${cappedLimit}
    `;
  }

  if (!hasSearchVector) {
    return sql<AccessibleDocumentSearchResult[]>`
      WITH q AS (
        SELECT
          plainto_tsquery('english', ${normalizedQuery}) AS ts_query,
          lower(${normalizedQuery}) AS raw_query
      ),
      query_terms AS (
        SELECT COALESCE(array_agg(cleaned_term), ARRAY[]::text[]) AS terms
        FROM (
          SELECT DISTINCT cleaned_term
          FROM regexp_split_to_table(lower(${normalizedQuery}), '\\s+') AS raw_term(term)
          CROSS JOIN LATERAL (
            SELECT NULLIF(regexp_replace(raw_term.term, '[^a-z0-9]+', '', 'g'), '') AS cleaned_term
          ) cleaned
          WHERE cleaned_term IS NOT NULL AND char_length(cleaned_term) >= 2
        ) filtered_terms
      )
      SELECT
        d.project_id,
        p.name AS project_name,
        dc.id AS chunk_id,
        d.id AS document_id,
        d.file_name,
        CASE
          WHEN numnode(q.ts_query) > 0 AND to_tsvector('english', dc.content) @@ q.ts_query THEN ts_headline(
            'english',
            dc.content,
            q.ts_query,
            'StartSel=<<H>>,StopSel=<</H>>,MaxFragments=2,MinWords=6,MaxWords=24,FragmentDelimiter= ... '
          )
          ELSE LEFT(dc.content, 280)
        END AS snippet,
        (
          CASE
            WHEN numnode(q.ts_query) > 0 AND to_tsvector('english', dc.content) @@ q.ts_query
              THEN 100 + ts_rank_cd(to_tsvector('english', dc.content), q.ts_query)
            WHEN lower(dc.content) LIKE '%' || q.raw_query || '%'
              THEN 10
            ELSE 0
          END
          + COALESCE((
            SELECT COUNT(*)::float8
            FROM unnest(query_terms.terms) AS query_term(term_value)
            WHERE lower(dc.content) LIKE '%' || term_value || '%'
          ), 0)
        ) AS rank
      FROM document_chunks dc
      JOIN documents d ON d.id = dc.document_id
      JOIN projects p ON p.id = d.project_id
      JOIN project_members pm ON pm.project_id = d.project_id
      CROSS JOIN q
      CROSS JOIN query_terms
      WHERE pm.user_id = ${userId}
        AND (${projectFilterId}::uuid IS NULL OR d.project_id = ${projectFilterId}::uuid)
        AND (
          (numnode(q.ts_query) > 0 AND to_tsvector('english', dc.content) @@ q.ts_query)
          OR lower(dc.content) LIKE '%' || q.raw_query || '%'
          OR (
            COALESCE(array_length(query_terms.terms, 1), 0) > 0
            AND NOT EXISTS (
              SELECT 1
              FROM unnest(query_terms.terms) AS query_term(term_value)
              WHERE lower(dc.content) NOT LIKE '%' || term_value || '%'
            )
          )
        )
      ORDER BY rank DESC, p.name ASC, d.file_name ASC
      LIMIT ${cappedLimit}
    `;
  }

  return sql<AccessibleDocumentSearchResult[]>`
    WITH q AS (
      SELECT
        plainto_tsquery('english', ${normalizedQuery}) AS ts_query,
        lower(${normalizedQuery}) AS raw_query
    ),
    query_terms AS (
      SELECT COALESCE(array_agg(cleaned_term), ARRAY[]::text[]) AS terms
      FROM (
        SELECT DISTINCT cleaned_term
        FROM regexp_split_to_table(lower(${normalizedQuery}), '\\s+') AS raw_term(term)
        CROSS JOIN LATERAL (
          SELECT NULLIF(regexp_replace(raw_term.term, '[^a-z0-9]+', '', 'g'), '') AS cleaned_term
        ) cleaned
        WHERE cleaned_term IS NOT NULL AND char_length(cleaned_term) >= 2
      ) filtered_terms
    )
    SELECT
      d.project_id,
      p.name AS project_name,
      dc.id AS chunk_id,
      d.id AS document_id,
      d.file_name,
      CASE
        WHEN numnode(q.ts_query) > 0 AND dc.search_vector @@ q.ts_query THEN ts_headline(
          'english',
          dc.content,
          q.ts_query,
          'StartSel=<<H>>,StopSel=<</H>>,MaxFragments=2,MinWords=6,MaxWords=24,FragmentDelimiter= ... '
        )
        ELSE LEFT(dc.content, 280)
      END AS snippet,
      (
        CASE
          WHEN numnode(q.ts_query) > 0 AND dc.search_vector @@ q.ts_query
            THEN 100 + ts_rank_cd(dc.search_vector, q.ts_query)
          WHEN lower(dc.content) LIKE '%' || q.raw_query || '%'
            THEN 10
          ELSE 0
        END
        + COALESCE((
          SELECT COUNT(*)::float8
            FROM unnest(query_terms.terms) AS query_term(term_value)
            WHERE lower(dc.content) LIKE '%' || term_value || '%'
        ), 0)
      ) AS rank
    FROM document_chunks dc
    JOIN documents d ON d.id = dc.document_id
    JOIN projects p ON p.id = d.project_id
    JOIN project_members pm ON pm.project_id = d.project_id
    CROSS JOIN q
    CROSS JOIN query_terms
    WHERE pm.user_id = ${userId}
      AND (${projectFilterId}::uuid IS NULL OR d.project_id = ${projectFilterId}::uuid)
      AND (
        (numnode(q.ts_query) > 0 AND dc.search_vector @@ q.ts_query)
        OR lower(dc.content) LIKE '%' || q.raw_query || '%'
        OR (
          COALESCE(array_length(query_terms.terms, 1), 0) > 0
          AND NOT EXISTS (
            SELECT 1
            FROM unnest(query_terms.terms) AS query_term(term_value)
            WHERE lower(dc.content) NOT LIKE '%' || term_value || '%'
          )
        )
      )
    ORDER BY rank DESC, p.name ASC, d.file_name ASC
    LIMIT ${cappedLimit}
  `;
}

export async function getLatestCoachingPlan(userId: string, projectId: string) {
  const rows = await sql<QuizCoachingPlanRecord[]>`
    SELECT *
    FROM quiz_coaching_plans
    WHERE user_id = ${userId} AND project_id = ${projectId}
    ORDER BY created_at DESC
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function getProjectAnnouncements(projectId: string, limit = 5) {
  const expiryColumnRows = await sql<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'project_announcements'
        AND column_name = 'expires_at'
    ) AS exists
  `;
  const hasExpiryColumn = expiryColumnRows[0]?.exists ?? false;

  if (!hasExpiryColumn) {
    return sql<(ProjectAnnouncementRecord & { sender_name: string | null })[]>`
      SELECT
        pa.*,
        (pa.created_at + INTERVAL '72 hours')::text AS expires_at,
        COALESCE(u.full_name, u.email) AS sender_name
      FROM project_announcements pa
      LEFT JOIN users u ON u.id = pa.sent_by
      WHERE pa.project_id = ${projectId}
      ORDER BY pa.created_at DESC
      LIMIT ${Math.max(1, limit)}
    `;
  }

  return sql<(ProjectAnnouncementRecord & { sender_name: string | null })[]>`
    SELECT pa.*, COALESCE(u.full_name, u.email) AS sender_name
    FROM project_announcements pa
    LEFT JOIN users u ON u.id = pa.sent_by
    WHERE pa.project_id = ${projectId}
    ORDER BY pa.created_at DESC
    LIMIT ${Math.max(1, limit)}
  `;
}

export async function getProjectMembers(projectId: string) {
  const rows = await sql`
    SELECT pm.assigned_at, pm.role as project_role, u.*
    FROM project_members pm
    JOIN users u ON u.id = pm.user_id
    WHERE pm.project_id = ${projectId}
    ORDER BY pm.assigned_at ASC
  `;
  return rows as unknown as Array<
    UserProfile & { assigned_at: string; project_role: 'admin' | 'member' }
  >;
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

export async function getQuizAttemptHistoryForProject(userId: string, projectId: string) {
  return sql<QuizAttemptHistoryRecord[]>`
    SELECT * FROM quiz_attempt_history
    WHERE user_id = ${userId} AND project_id = ${projectId}
    ORDER BY reset_at DESC
  `;
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

export async function userHasProjectAccess(
  userId: string,
  role: UserProfile['role'] | null | undefined,
  projectId: string,
) {
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
    openThreadRows,
    recentActivityRows,
  ] = await Promise.all([
    sql`SELECT COUNT(*) as c FROM users`,
    sql`SELECT COUNT(*) as c FROM users WHERE last_login_at >= ${sevenDaysAgo}`,
    sql`SELECT COUNT(*) as c FROM chat_messages`,
    sql`SELECT COUNT(*) as c FROM documents`,
    sql`SELECT COUNT(*) as c FROM quiz_attempts WHERE status = 'submitted'`,
    sql`SELECT COUNT(*) as c FROM quiz_attempts`,
    sql`SELECT COUNT(*) as c FROM quiz_retake_requests WHERE status = 'pending'`,
    sql`SELECT COUNT(*) as c FROM document_threads WHERE status = 'open'`,
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
  const openThreads = Number(openThreadRows[0]?.c ?? 0);

  const enrichedActivity = recentActivityRows.map((item) => {
    const rawName = item.user_full_name as string | null;
    const name =
      rawName && rawName !== 'undefined' && rawName.trim()
        ? rawName
        : (item.user_email as string | null);
    return { ...item, userName: name } as ActivityRecord & { userName: string | null };
  });

  return {
    totalUsers,
    activeUsers,
    totalMessages,
    totalDocuments,
    quizCompletionRate: totalAttempts ? Math.round((completedQuizzes / totalAttempts) * 100) : 0,
    pendingRetakeRequests,
    openThreads,
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
    sql<
      QuizSetRecord[]
    >`SELECT * FROM quiz_sets WHERE project_id = ${projectId} ORDER BY set_number ASC`,
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
  return sql<
    {
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
    }[]
  >`
    SELECT r.*, u.full_name AS user_name, u.email AS user_email
    FROM quiz_retake_requests r
    JOIN users u ON u.id = r.user_id
    WHERE r.project_id = ${projectId}
    ORDER BY r.created_at DESC
  `;
}

export async function getAllUsers(authProvider?: string) {
  if (authProvider) {
    return sql<
      UserProfile[]
    >`SELECT * FROM users WHERE auth_provider = ${authProvider} ORDER BY created_at DESC`;
  }
  return sql<UserProfile[]>`SELECT * FROM users ORDER BY created_at DESC`;
}

export async function getUserActivity(userId: string) {
  return sql<ActivityRecord[]>`
    SELECT * FROM activity_log
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT 20
  `;
}

export async function getUserProjectCount(userId: string) {
  const rows = await sql<{ c: string }[]>`
    SELECT COUNT(*) as c FROM project_members WHERE user_id = ${userId}
  `;
  return Number(rows[0]?.c ?? 0);
}

export async function getUserQuizStats(userId: string) {
  const rows = await sql<{ status: string; c: string }[]>`
    SELECT status, COUNT(*) as c FROM quiz_attempts
    WHERE user_id = ${userId}
    GROUP BY status
  `;

  const stats = { completed: 0, inProgress: 0, notStarted: 0 };

  for (const row of rows) {
    if (row.status === 'submitted') {
      stats.completed = Number(row.c);
    } else if (row.status === 'in_progress') {
      stats.inProgress = Number(row.c);
    }
  }

  return stats;
}

export async function getProjectAnalytics(projectId: string) {
  const memberRows = await sql<{ user_id: string; assigned_at: string }[]>`
    SELECT user_id, assigned_at FROM project_members WHERE project_id = ${projectId}
  `;
  const memberIds = memberRows.map((m) => m.user_id);
  const memberAssignedAt = new Map(memberRows.map((m) => [m.user_id, m.assigned_at]));

  const projectRows = await sql<{ name: string }[]>`
    SELECT name FROM projects WHERE id = ${projectId} LIMIT 1
  `;
  const projectName = projectRows[0]?.name ?? 'Unknown Project';

  const [
    sessions,
    attempts,
    attemptHistory,
    users,
    quizSets,
    resets,
    gapLogs,
    allAttempts,
    feedbackRows,
  ] = await Promise.all([
    sql<ChatSessionRecord[]>`SELECT * FROM chat_sessions WHERE project_id = ${projectId}`,
    sql<
      QuizAttemptRecord[]
    >`SELECT * FROM quiz_attempts WHERE project_id = ${projectId} AND status = 'submitted'`,
    sql<QuizAttemptHistoryRecord[]>`
        SELECT * FROM quiz_attempt_history
        WHERE project_id = ${projectId}
      `,
    sql<UserProfile[]>`SELECT * FROM users`,
    sql<
      { id: string; set_name: string }[]
    >`SELECT id, set_name FROM quiz_sets WHERE project_id = ${projectId}`,
    sql<{ user_id: string; reason: string; reset_at: string }[]>`
      SELECT user_id, reason, reset_at
      FROM quiz_resets
      WHERE project_id = ${projectId}
      ORDER BY reset_at DESC
    `,
    sql<{ metadata: Record<string, unknown>; created_at: string; user_id: string | null }[]>`
      SELECT metadata, created_at, user_id
      FROM activity_log
      WHERE project_id = ${projectId} AND action = 'knowledge_gap'
      ORDER BY created_at DESC
      LIMIT 50
    `,
    sql<
      {
        user_id: string;
        status: string;
        started_at: string;
        submitted_at: string | null;
        assigned_questions: AssignedQuestion[];
        answers_given: Record<string, QuizOptionKey> | null;
      }[]
    >`
      SELECT user_id, status, started_at, submitted_at, assigned_questions, answers_given
      FROM quiz_attempts
      WHERE project_id = ${projectId}
    `,
    sql<(ChatAnswerFeedbackRecord & { user_name: string | null; user_email: string | null })[]>`
      SELECT f.*, u.full_name as user_name, u.email as user_email
      FROM chat_answer_feedback f
      LEFT JOIN users u ON u.id = f.user_id
      WHERE f.project_id = ${projectId}
      ORDER BY f.created_at DESC
      LIMIT 200
    `,
  ]);

  const resetCounts = new Map<string, number>();
  const latestResetReasonByUser = new Map<string, string>();
  resets.forEach((r) => {
    resetCounts.set(r.user_id, (resetCounts.get(r.user_id) ?? 0) + 1);
    if (!latestResetReasonByUser.has(r.user_id)) {
      latestResetReasonByUser.set(r.user_id, r.reason);
    }
  });

  const userIndex = new Map(users.map((u) => [u.id, u]));
  const setIndex = new Map(quizSets.map((s) => [s.id, s.set_name]));

  function resolveDisplayName(userId: string) {
    const user = userIndex.get(userId);
    return user?.full_name && user.full_name !== 'undefined' && user.full_name.trim()
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

  const latestQuizResults = attempts.map((attempt) => {
    const user = userIndex.get(attempt.user_id);
    const assignedQs = (attempt.assigned_questions ?? []) as Array<{ section?: string }>;
    const sectionSet = [
      ...new Set(assignedQs.map((q) => q.section).filter((s): s is string => Boolean(s))),
    ];
    const carriedKeys = Object.keys(attempt.carried_sections ?? {});
    const allSections = [...new Set([...sectionSet, ...carriedKeys])];
    const sectionLabel =
      allSections.length > 0
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
      attemptType: 'latest' as const,
      member: resolveDisplayName(attempt.user_id),
      email: user?.email ?? '—',
      score: `${attempt.score ?? 0} / ${attempt.total_marks ?? 0}`,
      percentage: `${attempt.percentage ?? 0}%`,
      project: projectName,
      setTaken: sectionLabel,
      submittedAt: formatDate(attempt.submitted_at, true),
      submittedAtRaw: attempt.submitted_at,
      resetCount: resetCounts.get(attempt.user_id) ?? 0,
      resetReason: latestResetReasonByUser.get(attempt.user_id) ?? '—',
      sectionScores,
    };
  });

  const historicalQuizResults = attemptHistory.map((attempt) => {
    const user = userIndex.get(attempt.user_id);
    return {
      attemptId: attempt.id,
      userId: attempt.user_id,
      attemptType: 'previous' as const,
      member: resolveDisplayName(attempt.user_id),
      email: user?.email ?? '—',
      score: `${attempt.score ?? 0} / ${attempt.total_marks ?? 0}`,
      percentage: `${attempt.percentage ?? 0}%`,
      project: projectName,
      setTaken: attempt.quiz_set_id ? (setIndex.get(attempt.quiz_set_id) ?? 'Unknown') : 'Unknown',
      submittedAt: formatDate(attempt.submitted_at ?? attempt.reset_at, true),
      submittedAtRaw: attempt.submitted_at ?? attempt.reset_at,
      resetCount: resetCounts.get(attempt.user_id) ?? 0,
      resetReason: attempt.reset_reason,
      sectionScores: {},
    };
  });

  const quizResults = [...latestQuizResults, ...historicalQuizResults].sort(
    (a, b) => new Date(b.submittedAtRaw ?? 0).getTime() - new Date(a.submittedAtRaw ?? 0).getTime(),
  );

  const loginActivity = memberIds.map((userId) => {
    const user = userIndex.get(userId);
    return {
      name: resolveDisplayName(userId),
      email: user?.email ?? '—',
      lastLogin: formatDate(user?.last_login_at, true),
      joinedProject: formatDate(memberAssignedAt.get(userId)),
    };
  });

  const knowledgeGaps = gapLogs
    .map((log) => {
      const meta = (log.metadata ?? {}) as Record<string, unknown>;
      const query = String(meta.query ?? '').trim();
      if (!query) {
        return null;
      }

      return {
        query,
        confidence: `${(((meta.maxSimilarity as number) ?? 0) * 100).toFixed(0)}%`,
        askedBy: resolveDisplayName(log.user_id ?? ''),
        askedAt: formatDate(log.created_at, true),
        project_id: projectId,
        project: projectName,
      };
    })
    .filter(
      (
        row,
      ): row is {
        query: string;
        confidence: string;
        askedBy: string;
        askedAt: string;
        project_id: string;
        project: string;
      } => row !== null,
    );

  const membersWithSubmitted = new Set(attempts.map((a) => a.user_id));
  const membersWithAnyAttempt = new Set(allAttempts.map((a) => a.user_id));
  const membersWithChat = new Set(sessions.map((s) => s.user_id));

  const completionDurationsHours = attempts
    .map((a) => {
      const assignedAt = memberAssignedAt.get(a.user_id);
      if (!assignedAt || !a.submitted_at) return null;
      return (
        (new Date(a.submitted_at).getTime() - new Date(assignedAt).getTime()) / (1000 * 60 * 60)
      );
    })
    .filter((v): v is number => v != null && Number.isFinite(v) && v >= 0);

  const averageCompletionHours = completionDurationsHours.length
    ? completionDurationsHours.reduce((s, h) => s + h, 0) / completionDurationsHours.length
    : 0;

  const attemptsByUser = new Map<string, number>();
  allAttempts.forEach((a) =>
    attemptsByUser.set(a.user_id, (attemptsByUser.get(a.user_id) ?? 0) + 1),
  );
  const averageAttemptsPerMember = memberIds.length
    ? memberIds.reduce((s, id) => s + (attemptsByUser.get(id) ?? 0), 0) / memberIds.length
    : 0;

  const topicTotals = new Map<string, { correct: number; total: number }>();
  attempts.forEach((attempt) => {
    const sectionScores = computeSectionScores(
      attempt.assigned_questions as AssignedQuestion[],
      (attempt.answers_given ?? {}) as Record<string, QuizOptionKey>,
    );
    Object.entries(sectionScores).forEach(([section, value]) => {
      const current = topicTotals.get(section) ?? { correct: 0, total: 0 };
      topicTotals.set(section, {
        correct: current.correct + value.score,
        total: current.total + value.total,
      });
    });
  });

  const weakTopics = [...topicTotals.entries()]
    .map(([section, value]) => {
      const pct = value.total > 0 ? (value.correct / value.total) * 100 : 0;
      return {
        topic: section.charAt(0).toUpperCase() + section.slice(1),
        score: `${pct.toFixed(1)}%`,
        correct: `${value.correct}/${value.total}`,
      };
    })
    .sort((a, b) => parseFloat(a.score) - parseFloat(b.score));

  const dropOffRows = memberIds
    .map((memberId) => {
      const user = userIndex.get(memberId);
      const stage = membersWithSubmitted.has(memberId)
        ? 'Completed'
        : membersWithAnyAttempt.has(memberId)
          ? 'Started quiz, not submitted'
          : membersWithChat.has(memberId)
            ? 'Chat active, quiz not started'
            : 'No onboarding activity';
      return {
        member: resolveDisplayName(memberId),
        email: user?.email ?? '—',
        stage,
      };
    })
    .sort((a, b) => a.stage.localeCompare(b.stage));

  const feedbackSummaryMap = new Map<string, number>();
  feedbackRows.forEach((row) => {
    const key = `${row.rating}:${row.reason_tag ?? 'unspecified'}`;
    feedbackSummaryMap.set(key, (feedbackSummaryMap.get(key) ?? 0) + 1);
  });

  const answerFeedback = [...feedbackSummaryMap.entries()]
    .map(([key, count]) => {
      const [rating, reason] = key.split(':');
      return {
        rating,
        reason,
        count,
      };
    })
    .sort((a, b) => b.count - a.count);

  const onboardingSummary = {
    membersAssigned: memberIds.length,
    completionRate: memberIds.length
      ? Math.round((membersWithSubmitted.size / memberIds.length) * 100)
      : 0,
    averageCompletionHours: Number(averageCompletionHours.toFixed(1)),
    averageAttemptsPerMember: Number(averageAttemptsPerMember.toFixed(2)),
  };

  return {
    chatbotUsage,
    quizResults,
    loginActivity,
    knowledgeGaps,
    weakTopics,
    dropOffRows,
    answerFeedback,
    onboardingSummary,
  };
}

export async function getBookmarkedMessageIds(
  userId: string,
  sessionId: string,
): Promise<string[]> {
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
  return rows.filter((b) => b.message != null) as Array<
    ChatBookmarkRecord & { message: ChatMessageRecord }
  >;
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
    VALUES (${userId}, ${projectId ?? null}, ${action}, ${metadata ? sql.json(metadata as unknown as Json) : null})
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
      recentActivity: [] as Array<{
        action: string;
        projectName: string | null;
        createdAt: string;
      }>,
      recentBookmarks: [] as Array<{
        projectName: string;
        question: string | null;
        content: string;
        createdAt: string;
      }>,
      recentAnnouncements: [] as Array<{
        projectName: string;
        title: string;
        message: string;
        createdAt: string;
        expiresAt: string;
      }>,
    };
  }

  const [docRows, attemptRows, activityRows, bookmarkRows, announcementRows] = await Promise.all([
    sql<{ c: string }[]>`SELECT COUNT(*) as c FROM documents WHERE project_id = ANY(${projectIds})`,
    sql<
      { status: string }[]
    >`SELECT status FROM quiz_attempts WHERE user_id = ${userId} AND project_id = ANY(${projectIds})`,
    sql<{ action: string; project_id: string | null; created_at: string }[]>`
      SELECT al.action, al.project_id, al.created_at
      FROM activity_log al
      WHERE al.user_id = ${userId}
      ORDER BY al.created_at DESC
      LIMIT 8
    `,
    sql<{ project_name: string; content: string; question: string | null; created_at: string }[]>`
      SELECT p.name AS project_name, cm.content, cb.created_at,
        (
          SELECT content FROM chat_messages
          WHERE session_id = cm.session_id
            AND created_at < cm.created_at
            AND role = 'user'
          ORDER BY created_at DESC
          LIMIT 1
        ) AS question
      FROM chat_bookmarks cb
      JOIN chat_messages cm ON cm.id = cb.message_id
      JOIN projects p ON p.id = cb.project_id
      WHERE cb.user_id = ${userId}
      ORDER BY cb.created_at DESC
      LIMIT 4
    `,
    (async () => {
      const expiryColumnRows = await sql<{ exists: boolean }[]>`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'project_announcements'
            AND column_name = 'expires_at'
        ) AS exists
      `;
      const hasExpiryColumn = expiryColumnRows[0]?.exists ?? false;

      if (!hasExpiryColumn) {
        return sql<
          {
            project_name: string;
            title: string;
            message: string;
            created_at: string;
            expires_at: string;
          }[]
        >`
          SELECT
            p.name AS project_name,
            pa.title,
            pa.message,
            pa.created_at,
            (pa.created_at + INTERVAL '72 hours')::text AS expires_at
          FROM project_announcements pa
          JOIN projects p ON p.id = pa.project_id
          WHERE pa.project_id = ANY(${projectIds})
            AND pa.created_at + INTERVAL '72 hours' > NOW()
          ORDER BY pa.created_at DESC
          LIMIT 5
        `;
      }

      return sql<
        {
          project_name: string;
          title: string;
          message: string;
          created_at: string;
          expires_at: string;
        }[]
      >`
        SELECT p.name AS project_name, pa.title, pa.message, pa.created_at, pa.expires_at::text
        FROM project_announcements pa
        JOIN projects p ON p.id = pa.project_id
        WHERE pa.project_id = ANY(${projectIds})
          AND pa.expires_at > NOW()
        ORDER BY pa.created_at DESC
        LIMIT 5
      `;
    })(),
  ]);

  const projectNames = projectIds.length
    ? await sql<
        { id: string; name: string }[]
      >`SELECT id, name FROM projects WHERE id = ANY(${projectIds})`
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
      question: b.question ?? null,
      content: b.content,
      createdAt: b.created_at,
    })),
    recentAnnouncements: announcementRows.map((a) => ({
      projectName: a.project_name,
      title: a.title,
      message: a.message,
      createdAt: a.created_at,
      expiresAt: a.expires_at,
    })),
  };
}

const _getMemberNotificationCountUncached = async (userId: string): Promise<number> => {
  const expiryColumnRows = await sql<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'project_announcements'
        AND column_name = 'expires_at'
    ) AS exists
  `;
  const hasExpiryColumn = expiryColumnRows[0]?.exists ?? false;

  const [quizRows, announcementRows] = await Promise.all([
    sql<{ c: string }[]>`
    SELECT COUNT(*) AS c
    FROM project_members pm
    JOIN projects p ON p.id = pm.project_id AND p.is_active = true
    WHERE pm.user_id = ${userId}
      AND NOT EXISTS (
        SELECT 1 FROM quiz_attempts qa
        WHERE qa.user_id = pm.user_id AND qa.project_id = pm.project_id AND qa.status = 'submitted'
      )
  `,
    hasExpiryColumn
      ? sql<{ c: string }[]>`
          SELECT COUNT(*) AS c
          FROM project_announcements pa
          JOIN project_members pm ON pm.project_id = pa.project_id AND pm.user_id = ${userId}
          JOIN users u ON u.id = pm.user_id
          WHERE pa.created_at > COALESCE(u.last_login_at, '1970-01-01'::timestamptz)
            AND pa.expires_at > NOW()
        `
      : sql<{ c: string }[]>`
          SELECT COUNT(*) AS c
          FROM project_announcements pa
          JOIN project_members pm ON pm.project_id = pa.project_id AND pm.user_id = ${userId}
          JOIN users u ON u.id = pm.user_id
          WHERE pa.created_at > COALESCE(u.last_login_at, '1970-01-01'::timestamptz)
            AND pa.created_at + INTERVAL '72 hours' > NOW()
        `,
  ]);

  return Number(quizRows[0]?.c ?? 0) + Number(announcementRows[0]?.c ?? 0);
};

export const getMemberNotificationCount = unstable_cache(
  _getMemberNotificationCountUncached,
  ['member-notification-count'],
  { revalidate: 60 },
);

export async function getKnowledgeGapThread(threadId: string) {
  const rows = await sql<
    (DocumentThreadRecord & {
      creator_name: string | null;
      creator_email: string | null;
      project_name: string;
    })[]
  >`
    SELECT t.*, u.full_name AS creator_name, u.email AS creator_email, p.name AS project_name
    FROM document_threads t
    LEFT JOIN users u ON u.id = t.created_by
    JOIN projects p ON p.id = t.project_id
    WHERE t.id = ${threadId} AND t.source = 'knowledge_gap'
    LIMIT 1
  `;
  const thread = rows[0];
  if (!thread) return null;

  const commentRows = await sql<
    (DocumentThreadCommentRecord & {
      author_name: string | null;
      author_email: string | null;
      author_global_role: UserProfile['role'] | null;
      author_project_role: 'admin' | 'member' | null;
    })[]
  >`
    SELECT c.*, u.full_name AS author_name, u.email AS author_email,
           u.role AS author_global_role, pm.role AS author_project_role
    FROM document_thread_comments c
    LEFT JOIN users u ON u.id = c.author_id
    LEFT JOIN project_members pm ON pm.user_id = c.author_id AND pm.project_id = ${thread.project_id}
    WHERE c.thread_id = ${threadId}
    ORDER BY c.created_at ASC
  `;

  return { ...thread, comments: commentRows };
}

const _getOpenThreadNotificationCountUncached = async (
  userId: string,
  role: UserProfile['role'] | null | undefined,
): Promise<number> => {
  if (role === 'admin') {
    const rows = await sql<{ c: string }[]>`
      SELECT COUNT(*) AS c
      FROM document_threads
      WHERE status = 'open'
    `;
    return Number(rows[0]?.c ?? 0);
  }

  const rows = await sql<{ c: string }[]>`
    SELECT COUNT(*) AS c
    FROM document_threads t
    JOIN project_members pm ON pm.project_id = t.project_id
    WHERE pm.user_id = ${userId}
      AND t.status = 'open'
  `;
  return Number(rows[0]?.c ?? 0);
};

export const getOpenThreadNotificationCount = unstable_cache(
  _getOpenThreadNotificationCountUncached,
  ['open-thread-notification-count'],
  { revalidate: 60 },
);

export async function getOpenThreadsForUser(
  userId: string,
  role: UserProfile['role'] | null | undefined,
  statusFilter: 'open' | 'resolved' | 'all' = 'open',
  includeKnowledgeGap = false,
) {
  const statusCondition = statusFilter === 'all' ? sql`TRUE` : sql`t.status = ${statusFilter}`;
  const sourceCondition = includeKnowledgeGap ? sql`TRUE` : sql`t.source = 'document'`;

  if (role === 'admin') {
    return sql<
      {
        thread_id: string;
        project_id: string;
        project_name: string;
        document_id: string | null;
        document_name: string | null;
        title: string;
        page_number: number | null;
        updated_at: string;
        comment_count: string;
        source: 'document' | 'knowledge_gap';
        gap_query: string | null;
      }[]
    >`
      SELECT
        t.id AS thread_id,
        t.project_id,
        p.name AS project_name,
        t.document_id,
        d.file_name AS document_name,
        t.title,
        t.page_number,
        t.updated_at,
        COALESCE(c.comment_count, 0)::text AS comment_count,
        t.source,
        t.gap_query
      FROM document_threads t
      JOIN projects p ON p.id = t.project_id
      LEFT JOIN documents d ON d.id = t.document_id
      LEFT JOIN (
        SELECT thread_id, COUNT(*) AS comment_count
        FROM document_thread_comments
        GROUP BY thread_id
      ) c ON c.thread_id = t.id
      WHERE ${statusCondition}
        AND ${sourceCondition}
      ORDER BY t.updated_at DESC
      LIMIT 200
    `;
  }

  return sql<
    {
      thread_id: string;
      project_id: string;
      project_name: string;
      document_id: string | null;
      document_name: string | null;
      title: string;
      page_number: number | null;
      updated_at: string;
      comment_count: string;
      source: 'document' | 'knowledge_gap';
      gap_query: string | null;
    }[]
  >`
    SELECT
      t.id AS thread_id,
      t.project_id,
      p.name AS project_name,
      t.document_id,
      d.file_name AS document_name,
      t.title,
      t.page_number,
      t.updated_at,
      COALESCE(c.comment_count, 0)::text AS comment_count,
      t.source,
      t.gap_query
    FROM document_threads t
    JOIN project_members pm ON pm.project_id = t.project_id AND pm.user_id = ${userId}
    JOIN projects p ON p.id = t.project_id
    LEFT JOIN documents d ON d.id = t.document_id
    LEFT JOIN (
      SELECT thread_id, COUNT(*) AS comment_count
      FROM document_thread_comments
      GROUP BY thread_id
    ) c ON c.thread_id = t.id
    WHERE ${statusCondition}
      AND ${sourceCondition}
    ORDER BY t.updated_at DESC
    LIMIT 200
  `;
}

export async function getAdminThreadQueuePage(params: {
  statusFilter: 'open' | 'resolved' | 'all';
  projectFilter?: string;
  documentFilter?: string;
  updatedTodayOnly?: boolean;
  page?: number;
  pageSize?: number;
}) {
  const pageSize = Math.min(Math.max(params.pageSize ?? 20, 1), 100);
  const page = Math.max(params.page ?? 1, 1);
  const offset = (page - 1) * pageSize;
  const projectFilter = (params.projectFilter ?? '').trim();
  const documentFilter = (params.documentFilter ?? '').trim();
  const updatedTodayOnly = params.updatedTodayOnly ?? false;
  const statusFilter = params.statusFilter;
  const statusCondition = statusFilter === 'all' ? sql`TRUE` : sql`t.status = ${statusFilter}`;
  const projectCondition = projectFilter ? sql`t.project_id = ${projectFilter}` : sql`TRUE`;
  const documentCondition = documentFilter ? sql`t.document_id = ${documentFilter}` : sql`TRUE`;
  const updatedTodayCondition = updatedTodayOnly
    ? sql`t.updated_at >= date_trunc('day', NOW())`
    : sql`TRUE`;

  const [rows, totalRows, projectOptions, documentOptions] = await Promise.all([
    sql<
      {
        thread_id: string;
        project_id: string;
        project_name: string;
        document_id: string | null;
        document_name: string | null;
        title: string;
        page_number: number | null;
        updated_at: string;
        comment_count: string;
        source: 'document' | 'knowledge_gap';
        gap_query: string | null;
      }[]
    >`
      SELECT
        t.id AS thread_id,
        t.project_id,
        p.name AS project_name,
        t.document_id,
        d.file_name AS document_name,
        t.title,
        t.page_number,
        t.updated_at,
        COALESCE(c.comment_count, 0)::text AS comment_count,
        t.source,
        t.gap_query
      FROM document_threads t
      JOIN projects p ON p.id = t.project_id
      LEFT JOIN documents d ON d.id = t.document_id
      LEFT JOIN (
        SELECT thread_id, COUNT(*) AS comment_count
        FROM document_thread_comments
        GROUP BY thread_id
      ) c ON c.thread_id = t.id
      WHERE ${statusCondition}
        AND ${projectCondition}
        AND ${documentCondition}
        AND ${updatedTodayCondition}
      ORDER BY t.updated_at DESC
      LIMIT ${pageSize}
      OFFSET ${offset}
    `,
    sql<{ total_count: string }[]>`
      SELECT COUNT(*)::text AS total_count
      FROM document_threads t
      WHERE ${statusCondition}
        AND ${projectCondition}
        AND ${documentCondition}
        AND ${updatedTodayCondition}
    `,
    sql<{ id: string; name: string }[]>`
      SELECT DISTINCT t.project_id AS id, p.name AS name
      FROM document_threads t
      JOIN projects p ON p.id = t.project_id
      WHERE ${statusCondition}
      ORDER BY name ASC
    `,
    sql<{ id: string; name: string }[]>`
      SELECT DISTINCT d.id::text AS id, d.file_name AS name
      FROM document_threads t
      JOIN documents d ON d.id = t.document_id
      WHERE ${statusCondition}
        AND ${projectCondition}
      ORDER BY name ASC
    `,
  ]);

  return {
    rows,
    totalCount: Number(totalRows[0]?.total_count ?? 0),
    page,
    pageSize,
    projectOptions,
    documentOptions,
  };
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
  const retrievalHitRate =
    totalRequests > 0 ? Math.round((Number(summary.hit_count ?? 0) / totalRequests) * 100) : 0;
  const refusalRate =
    totalRequests > 0 ? Math.round((Number(summary.refused_count ?? 0) / totalRequests) * 100) : 0;

  const dayMap = new Map<
    string,
    { promptTokens: number; completionTokens: number; totalTokens: number }
  >();
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

export async function getSystemHealthSnapshot(): Promise<SystemHealthSnapshot> {
  const checkedAt = new Date().toISOString();

  const empty: SystemHealthSnapshot = {
    checkedAt,
    databaseHealthy: false,
    workerHealthy: false,
    pendingJobs: 0,
    runningJobs: 0,
    failedJobs24h: 0,
    failedJobsTotal: 0,
    appErrors24h: 0,
    lastWorkerActivityAt: null,
    ragRequestsLastHour: 0,
    ragAvgLatencyMsLastHour: 0,
    errors: [],
  };

  try {
    await sql`SELECT 1`;
  } catch {
    return empty;
  }

  const appErrorTableRows = await sql<{ exists: boolean }[]>`
    SELECT to_regclass('public.app_error_events') IS NOT NULL AS exists
  `;
  const hasAppErrorEventsTable = appErrorTableRows[0]?.exists ?? false;

  const [jobRows, ragRows, appErrorRows, jobErrorRows] = await Promise.all([
    sql<
      {
        pending_jobs: string;
        running_jobs: string;
        failed_jobs_24h: string;
        failed_jobs_total: string;
        last_worker_activity_at: string | null;
      }[]
    >`
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending')::text AS pending_jobs,
        COUNT(*) FILTER (WHERE status = 'running')::text AS running_jobs,
        COUNT(*) FILTER (
          WHERE status = 'failed' AND COALESCE(completed_at, created_at) >= NOW() - INTERVAL '24 hours'
        )::text AS failed_jobs_24h,
        COUNT(*) FILTER (WHERE status = 'failed')::text AS failed_jobs_total,
        MAX(COALESCE(completed_at, started_at, created_at))::text AS last_worker_activity_at
      FROM processing_jobs
    `,
    sql<
      {
        requests_last_hour: string;
        avg_latency_ms_last_hour: string | null;
      }[]
    >`
      SELECT
        COUNT(*)::text AS requests_last_hour,
        ROUND(COALESCE(AVG(total_ms), 0))::text AS avg_latency_ms_last_hour
      FROM rag_traces
      WHERE created_at >= NOW() - INTERVAL '1 hour'
    `,
    hasAppErrorEventsTable
      ? sql<
          {
            id: string;
            source: string;
            category: string;
            message: string;
            stack: string | null;
            metadata: Json | null;
            created_at: string;
          }[]
        >`
          SELECT id::text, source, category, message, stack, metadata, created_at::text
          FROM app_error_events
          WHERE created_at >= NOW() - INTERVAL '30 days'
          ORDER BY created_at DESC
          LIMIT 1000
        `
      : Promise.resolve(
          [] as {
            id: string;
            source: string;
            category: string;
            message: string;
            stack: string | null;
            metadata: Json | null;
            created_at: string;
          }[],
        ),
    sql<
      {
        id: string;
        type: string;
        error: string;
        created_at: string;
      }[]
    >`
      SELECT id::text, type, error, COALESCE(completed_at, created_at)::text AS created_at
      FROM processing_jobs
      WHERE status = 'failed'
        AND error IS NOT NULL
        AND COALESCE(completed_at, created_at) >= NOW() - INTERVAL '30 days'
      ORDER BY COALESCE(completed_at, created_at) DESC
      LIMIT 1000
    `,
  ]);

  const jobs = jobRows[0];
  const rag = ragRows[0];

  const normalizedAppErrors: SystemErrorEvent[] = appErrorRows.map((row) => ({
    id: `app-${row.id}`,
    source: row.source,
    category: row.category,
    message: row.message,
    stack: row.stack,
    metadata: row.metadata,
    createdAt: row.created_at,
  }));

  const normalizedJobErrors: SystemErrorEvent[] = jobErrorRows.map((row) => {
    const errorText = row.error ?? '';
    const firstLineBreak = errorText.indexOf('\n');
    const message = firstLineBreak >= 0 ? errorText.slice(0, firstLineBreak).trim() : errorText;
    const stack = firstLineBreak >= 0 ? errorText.slice(firstLineBreak + 1).trim() : null;

    return {
      id: `job-${row.id}`,
      source: 'worker',
      category: `job:${row.type}`,
      message: message || 'Worker job failed',
      stack,
      metadata: null,
      createdAt: row.created_at,
    };
  });

  const combinedErrors = [...normalizedAppErrors, ...normalizedJobErrors]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 1000);

  const appErrors24h = normalizedAppErrors.filter(
    (row) => Date.now() - new Date(row.createdAt).getTime() <= 24 * 60 * 60 * 1000,
  ).length;

  const pendingJobs = Number(jobs?.pending_jobs ?? 0);
  const runningJobs = Number(jobs?.running_jobs ?? 0);
  const failedJobs24h = Number(jobs?.failed_jobs_24h ?? 0);
  const lastWorkerActivityAt = jobs?.last_worker_activity_at ?? null;
  const workerHealthy =
    runningJobs > 0 ||
    pendingJobs === 0 ||
    (lastWorkerActivityAt !== null &&
      Date.now() - new Date(lastWorkerActivityAt).getTime() <= 15 * 60 * 1000);

  return {
    checkedAt,
    databaseHealthy: true,
    workerHealthy,
    pendingJobs,
    runningJobs,
    failedJobs24h,
    failedJobsTotal: Number(jobs?.failed_jobs_total ?? 0),
    appErrors24h,
    lastWorkerActivityAt,
    ragRequestsLastHour: Number(rag?.requests_last_hour ?? 0),
    ragAvgLatencyMsLastHour: Number(rag?.avg_latency_ms_last_hour ?? 0),
    errors: combinedErrors,
  };
}

export interface KnowledgeGap {
  query: string;
  occurrences: number;
  lastAskedAt: string;
  projects: string[];
  projectIds: string[];
  /** Set when a knowledge-gap thread for this query has been resolved. */
  resolvedThreadId?: string;
}

// Lazy schema init — creates dismissed_knowledge_gaps table on first use.
let _dismissedGapsSchemaReady: Promise<void> | null = null;

export async function ensureDismissedGapsSchema(): Promise<void> {
  if (!_dismissedGapsSchemaReady) {
    _dismissedGapsSchemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS dismissed_knowledge_gaps (
          id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
          norm_query   text        NOT NULL UNIQUE,
          dismissed_by uuid        REFERENCES users(id) ON DELETE SET NULL,
          dismissed_at timestamptz NOT NULL DEFAULT now()
        )
      `;
    })().catch((err: unknown) => {
      _dismissedGapsSchemaReady = null;
      throw err;
    });
  }
  await _dismissedGapsSchemaReady;
}

export async function getKnowledgeGaps(): Promise<KnowledgeGap[]> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  await ensureDismissedGapsSchema();

  // Aggregate refused queries first, then lateral-join to find a resolved thread
  // without risk of multiplying rows from the document_threads join.
  // Dismissed gaps are excluded via NOT EXISTS on dismissed_knowledge_gaps.
  const rows = await sql`
    WITH gaps AS (
      SELECT
        MIN(rt.query_text)                                  AS query_text,
        COUNT(*)::int                                       AS occurrences,
        MAX(rt.created_at)                                  AS last_asked_at,
        array_remove(array_agg(DISTINCT p.name), NULL)      AS project_names,
        array_remove(array_agg(DISTINCT p.id::text), NULL)  AS project_ids,
        lower(trim(rt.query_text))                          AS norm_query
      FROM rag_traces rt
      LEFT JOIN projects p ON p.id = rt.project_id
      WHERE rt.answer_refused = true
        AND rt.created_at >= ${thirtyDaysAgo}
        AND NOT EXISTS (
          SELECT 1 FROM dismissed_knowledge_gaps d
          WHERE d.norm_query = lower(trim(rt.query_text))
        )
      GROUP BY lower(trim(rt.query_text))
      ORDER BY occurrences DESC, last_asked_at DESC
      LIMIT 10
    )
    SELECT
      g.query_text,
      g.occurrences,
      g.last_asked_at,
      g.project_names,
      g.project_ids,
      dt.id AS resolved_thread_id
    FROM gaps g
    LEFT JOIN LATERAL (
      SELECT id
      FROM document_threads
      WHERE lower(trim(gap_query)) = g.norm_query
        AND source = 'knowledge_gap'
        AND status  = 'resolved'
      LIMIT 1
    ) dt ON true
  `;

  return rows.map((row) => ({
    query: row.query_text as string,
    occurrences: Number(row.occurrences),
    lastAskedAt: formatDate(row.last_asked_at as string, true),
    projects: (row.project_names as string[] | null) ?? [],
    projectIds: (row.project_ids as string[] | null) ?? [],
    resolvedThreadId: (row.resolved_thread_id as string | null) ?? undefined,
  }));
}
