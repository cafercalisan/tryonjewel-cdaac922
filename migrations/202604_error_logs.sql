-- Run once on existing deployments (init.sql already covers fresh installs).
--   psql "$DATABASE_URL" -f migrations/202604_error_logs.sql

CREATE TABLE IF NOT EXISTS error_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  job_id UUID,
  endpoint TEXT NOT NULL,
  model TEXT,
  attempt INTEGER,
  status_code INTEGER,
  is_overload BOOLEAN DEFAULT false,
  error_message TEXT NOT NULL,
  context JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON error_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_endpoint ON error_logs(endpoint);
CREATE INDEX IF NOT EXISTS idx_error_logs_job_id ON error_logs(job_id);
