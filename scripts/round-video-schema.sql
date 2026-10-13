-- Additive video migration only. Existing rounds/submissions tables are prerequisites.
-- Apply to the explicitly verified preview target first. No settings/backfills/constraint rewrites.
ALTER TABLE round_submissions ADD COLUMN IF NOT EXISTS video jsonb;
CREATE TABLE IF NOT EXISTS round_video_uploads (
  id uuid PRIMARY KEY,
  round_id text NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  wallet_address text NOT NULL,
  staging_key text NOT NULL UNIQUE,
  object_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','validating','ready','attached','rejected','cancelled','cleaned')),
  metadata jsonb,
  submission_id text REFERENCES round_submissions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '30 minutes'
);
ALTER TABLE round_video_uploads ADD COLUMN IF NOT EXISTS staging_cleaned_at timestamptz;
CREATE INDEX IF NOT EXISTS round_video_uploads_staging_cleanup ON round_video_uploads(created_at,id) WHERE status='attached' AND staging_cleaned_at IS NULL;
CREATE INDEX IF NOT EXISTS round_video_uploads_owner ON round_video_uploads(round_id, lower(wallet_address), expires_at);
