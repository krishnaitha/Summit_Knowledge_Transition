export type UserRole = 'admin' | 'member';
export type ProjectMemberRole = 'admin' | 'member';
export type MessageRole = 'user' | 'assistant';
export type QuizAttemptStatus = 'in_progress' | 'submitted';
export type QuizOptionKey = 'A' | 'B' | 'C' | 'D';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
  last_login_at: string | null;
  is_active?: boolean | null;
}

export interface ProjectMember extends UserProfile {
  assigned_at: string;
  project_role: ProjectMemberRole;
}

export interface ProjectRecord {
  id: string;
  name: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
  is_active: boolean;
  pass_threshold?: number | null;
  quiz_open_at?: string | null;
  quiz_close_at?: string | null;
}

export interface QuizResetRecord {
  id: string;
  user_id: string;
  project_id: string;
  reset_by: string | null;
  reason: string;
  reset_at: string;
}

export interface DocumentRecord {
  id: string;
  project_id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  uploaded_by: string | null;
  uploaded_at: string;
  chunk_count: number;
  pii_detections: number;
  classification: 'confidential' | 'internal' | 'public';
  is_required: boolean;
  scan_flags: string[];
}

export interface QuizCoachingPlanRecord {
  id: string;
  attempt_id: string;
  user_id: string;
  project_id: string;
  weak_sections: Array<{ section: string; score: number; total: number; percentage: number }>;
  recommendations: Array<{ section: string; focus: string; documents: Array<{ id: string; name: string }> }>;
  created_at: string;
}

export interface ChatAnswerFeedbackRecord {
  id: string;
  user_id: string;
  project_id: string;
  message_id: string;
  rating: 'up' | 'down';
  reason_tag: string | null;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectAnnouncementRecord {
  id: string;
  project_id: string;
  title: string;
  message: string;
  sent_by: string | null;
  created_at: string;
}

export interface ChatSessionRecord {
  id: string;
  user_id: string;
  project_id: string;
  started_at: string;
  message_count: number;
  last_message_at: string | null;
}

export interface ChatMessageRecord {
  id: string;
  session_id: string;
  role: MessageRole;
  content: string;
  sources: Array<{ documentId?: string; documentName: string; chunkId?: string; similarity?: number }> | null;
  created_at: string;
}

export interface QuizSetRecord {
  id: string;
  project_id: string;
  set_name: string;
  set_number: number;
  is_active: boolean;
  created_at: string;
  category: string;
}

export type QuizQuestionType = 'mcq' | 'true_false';

export interface QuizQuestionRecord {
  id: string;
  quiz_set_id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: QuizOptionKey;
  explanation: string | null;
  marks: number;
  question_type: QuizQuestionType;
}

export interface QuizAttemptRecord {
  id: string;
  user_id: string;
  project_id: string;
  quiz_set_id: string;
  assigned_questions: AssignedQuestion[];
  answers_given: Record<string, QuizOptionKey> | null;
  score: number | null;
  total_marks: number | null;
  percentage: number | null;
  passed: boolean | null;
  started_at: string;
  submitted_at: string | null;
  status: QuizAttemptStatus;
  carried_sections: Record<string, { score: number; total: number }> | null;
}

export interface AssignedQuestionOption {
  key: QuizOptionKey;
  text: string;
  originalKey: QuizOptionKey;
}

export interface AssignedQuestion {
  questionId: string;
  section: string;
  questionText: string;
  options: AssignedQuestionOption[];
  correctKey: QuizOptionKey;
  explanation: string | null;
  marks: number;
  questionType: QuizQuestionType;
}

export interface QuizReviewQuestion extends AssignedQuestion {
  selectedKey: QuizOptionKey | null;
  isCorrect: boolean;
}

export interface ChatBookmarkRecord {
  id: string;
  user_id: string;
  project_id: string;
  message_id: string;
  created_at: string;
}

export type ProcessingJobType = 'document_process' | 'quiz_generate';
export type ProcessingJobStatus = 'pending' | 'running' | 'done' | 'failed';

export interface ProcessingJobRecord {
  id: string;
  type: ProcessingJobType;
  status: ProcessingJobStatus;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface ActivityRecord {
  id: string;
  user_id: string | null;
  project_id: string | null;
  action: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface ProjectDashboardCard extends ProjectRecord {
  documentCount: number;
  docsViewedCount: number;
  isNewDocs: boolean;
  quizStatus: 'Not Started' | 'In Progress' | 'Completed';
  quizScoreLabel: string | null;
  quizPercentage: number | null;
  quizPassed: boolean | null;
  quizCloseAt: string | null;
}

export interface RagTraceRecord {
  id: string;
  created_at: string;
  project_id: string | null;
  user_id: string | null;
  session_id: string | null;
  message_id: string | null;
  query_text: string;
  chunks_retrieved: number;
  max_similarity: number | null;
  avg_similarity: number | null;
  retrieval_hit: boolean;
  retrieval_ms: number | null;
  model_used: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  generation_ms: number | null;
  total_ms: number | null;
  answer_cached: boolean;
  answer_refused: boolean;
  possible_hallucination: boolean;
  is_slow: boolean; // generated column — read-only
}