-- Partial quiz retake: store per-section scores that are carried from a previous submission.
-- Structure: { [category]: { score: number, total: number } }
alter table quiz_attempts add column if not exists carried_sections jsonb;
