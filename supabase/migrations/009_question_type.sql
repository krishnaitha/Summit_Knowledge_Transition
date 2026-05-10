-- Add question_type to quiz_questions to support multiple question formats.
-- 'mcq' = 4-option multiple choice (default, backwards-compatible)
-- 'true_false' = 2-option True/False (uses option_a and option_b only)
alter table quiz_questions
  add column if not exists question_type text not null default 'mcq';
