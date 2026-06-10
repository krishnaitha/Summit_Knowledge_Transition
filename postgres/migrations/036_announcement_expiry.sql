ALTER TABLE public.project_announcements
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

UPDATE public.project_announcements
SET expires_at = COALESCE(expires_at, created_at + INTERVAL '72 hours')
WHERE expires_at IS NULL;

ALTER TABLE public.project_announcements
  ALTER COLUMN expires_at SET DEFAULT (now() + INTERVAL '72 hours');

ALTER TABLE public.project_announcements
  ALTER COLUMN expires_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS project_announcements_project_expiry_created_idx
  ON public.project_announcements (project_id, expires_at DESC, created_at DESC);