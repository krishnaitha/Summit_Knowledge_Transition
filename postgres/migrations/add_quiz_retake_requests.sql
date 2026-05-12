-- Migration: add quiz_retake_requests table
CREATE TABLE IF NOT EXISTS quiz_retake_requests (
  id          uuid         primary key default gen_random_uuid(),
  user_id     uuid         not null references users(id) on delete cascade,
  project_id  uuid         not null references projects(id) on delete cascade,
  attempt_id  uuid,        -- may be null after attempt is deleted on approval
  reason      text,
  status      text         not null default 'pending'
                           check (status in ('pending', 'approved', 'rejected')),
  created_at  timestamptz  not null default now(),
  resolved_at timestamptz,
  resolved_by uuid         references users(id)
);

CREATE INDEX IF NOT EXISTS quiz_retake_requests_project_idx
  ON quiz_retake_requests (project_id, status);

CREATE INDEX IF NOT EXISTS quiz_retake_requests_user_project_idx
  ON quiz_retake_requests (user_id, project_id, status);
