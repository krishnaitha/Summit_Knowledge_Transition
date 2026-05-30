CREATE TABLE IF NOT EXISTS app_error_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  category text NOT NULL,
  message text NOT NULL,
  stack text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_error_events_created_idx
  ON app_error_events (created_at DESC);

CREATE INDEX IF NOT EXISTS app_error_events_source_category_idx
  ON app_error_events (source, category, created_at DESC);
