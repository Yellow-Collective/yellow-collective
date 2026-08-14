CREATE TABLE IF NOT EXISTS rounds (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  image text NOT NULL DEFAULT '',
  starts_at timestamptz NOT NULL,
  submissions_open_at timestamptz NOT NULL,
  voting_starts_at timestamptz NOT NULL,
  voting_ends_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  active boolean NOT NULL DEFAULT false,
  featured boolean NOT NULL DEFAULT false,
  is_trait_contest boolean NOT NULL DEFAULT false,
  trait_submissions_enabled boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'draft',
  voting_strategy text NOT NULL DEFAULT 'one_per_nft',
  votes_per_wallet integer NOT NULL DEFAULT 1,
  voting_snapshot_block integer,
  winner_count integer NOT NULL DEFAULT 1,
  max_submissions_per_wallet integer NOT NULL DEFAULT 1,
  min_title_length integer NOT NULL DEFAULT 3,
  max_title_length integer NOT NULL DEFAULT 120,
  min_description_length integer NOT NULL DEFAULT 20,
  max_description_length integer NOT NULL DEFAULT 2000,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT rounds_status_check CHECK (status IN ('draft', 'published', 'archived')),
  CONSTRAINT rounds_voting_strategy_check CHECK (voting_strategy IN ('one_per_wallet', 'one_per_nft', 'fixed_per_wallet', 'base_plus_voting_power')),
  CONSTRAINT rounds_votes_per_wallet_check CHECK (votes_per_wallet > 0),
  CONSTRAINT rounds_winner_count_check CHECK (winner_count > 0),
  CONSTRAINT rounds_submission_limit_check CHECK (max_submissions_per_wallet > 0),
  CONSTRAINT rounds_title_lengths_check CHECK (min_title_length >= 1 AND max_title_length >= min_title_length),
  CONSTRAINT rounds_description_lengths_check CHECK (min_description_length >= 1 AND max_description_length >= min_description_length),
  CONSTRAINT rounds_date_order_check CHECK (
    starts_at <= submissions_open_at
    AND submissions_open_at <= voting_starts_at
    AND voting_starts_at < voting_ends_at
    AND voting_ends_at = ends_at
  )
);

CREATE TABLE IF NOT EXISTS round_submissions (
  id text PRIMARY KEY,
  round_id text NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  wallet_address text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  image text NOT NULL,
  url text NOT NULL,
  submission_type text NOT NULL DEFAULT 'project',
  trait_id text,
  trait_type text,
  source text NOT NULL DEFAULT 'project',
  source_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  rejected_at timestamptz,
  hidden_at timestamptz,
  deleted_at timestamptz,
  CONSTRAINT round_submissions_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'hidden')),
  CONSTRAINT round_submissions_type_check CHECK (submission_type IN ('project', 'trait'))
);

CREATE TABLE IF NOT EXISTS round_votes (
  id text PRIMARY KEY,
  round_id text NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  submission_id text NOT NULL REFERENCES round_submissions(id) ON DELETE CASCADE,
  wallet_address text NOT NULL,
  vote_count integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT round_votes_positive_check CHECK (vote_count > 0),
  CONSTRAINT round_votes_unique_wallet_submission UNIQUE (round_id, submission_id, wallet_address)
);

CREATE INDEX IF NOT EXISTS rounds_status_idx ON rounds(status);
CREATE INDEX IF NOT EXISTS rounds_active_idx ON rounds(active);
CREATE INDEX IF NOT EXISTS rounds_featured_idx ON rounds(featured);
CREATE INDEX IF NOT EXISTS rounds_dates_idx ON rounds(starts_at, voting_starts_at, voting_ends_at, ends_at);
CREATE INDEX IF NOT EXISTS round_submissions_round_status_idx ON round_submissions(round_id, status);
CREATE INDEX IF NOT EXISTS round_submissions_wallet_idx ON round_submissions(round_id, wallet_address);
CREATE UNIQUE INDEX IF NOT EXISTS round_submissions_round_trait_unique_idx
  ON round_submissions(round_id, trait_id)
  WHERE trait_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS round_votes_round_submission_idx ON round_votes(round_id, submission_id);
CREATE INDEX IF NOT EXISTS round_votes_round_wallet_idx ON round_votes(round_id, wallet_address);

CREATE TABLE IF NOT EXISTS round_awards (
  id text PRIMARY KEY,
  round_id text NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  award_position integer NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  award_value text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT round_awards_position_check CHECK (award_position > 0),
  CONSTRAINT round_awards_unique_position UNIQUE (round_id, award_position)
);

CREATE INDEX IF NOT EXISTS round_awards_round_position_idx ON round_awards(round_id, award_position);

CREATE TABLE IF NOT EXISTS round_winners (
  id text PRIMARY KEY,
  round_id text NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  submission_id text NOT NULL REFERENCES round_submissions(id) ON DELETE CASCADE,
  winner_position integer NOT NULL,
  vote_count integer NOT NULL DEFAULT 0,
  finalized_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT round_winners_position_check CHECK (winner_position > 0),
  CONSTRAINT round_winners_unique_position UNIQUE (round_id, winner_position),
  CONSTRAINT round_winners_unique_submission UNIQUE (round_id, submission_id)
);

CREATE INDEX IF NOT EXISTS round_winners_round_position_idx ON round_winners(round_id, winner_position);

CREATE TABLE IF NOT EXISTS round_requests (
  id text PRIMARY KEY,
  wallet_address text,
  requester_name text NOT NULL DEFAULT '',
  requester_email text NOT NULL DEFAULT '',
  requested_slug text NOT NULL DEFAULT '',
  title text NOT NULL,
  description text NOT NULL,
  content text NOT NULL DEFAULT '',
  goals text NOT NULL DEFAULT '',
  image text NOT NULL DEFAULT '',
  url text NOT NULL DEFAULT '',
  timeline text NOT NULL DEFAULT '',
  starts_at timestamptz,
  submissions_open_at timestamptz,
  voting_starts_at timestamptz,
  voting_ends_at timestamptz,
  ends_at timestamptz,
  voting_strategy text NOT NULL DEFAULT 'one_per_nft',
  votes_per_wallet integer NOT NULL DEFAULT 1,
  winner_count integer NOT NULL DEFAULT 1,
  max_submissions_per_wallet integer NOT NULL DEFAULT 1,
  is_trait_contest boolean NOT NULL DEFAULT false,
  trait_submissions_enabled boolean NOT NULL DEFAULT false,
  awards jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  deleted_at timestamptz,
  CONSTRAINT round_requests_status_check CHECK (status IN ('pending', 'approved', 'rejected')),
  CONSTRAINT round_requests_voting_strategy_check CHECK (voting_strategy IN ('one_per_wallet', 'one_per_nft', 'fixed_per_wallet', 'base_plus_voting_power')),
  CONSTRAINT round_requests_votes_per_wallet_check CHECK (votes_per_wallet > 0),
  CONSTRAINT round_requests_winner_count_check CHECK (winner_count > 0),
  CONSTRAINT round_requests_submission_limit_check CHECK (max_submissions_per_wallet > 0)
);

CREATE TABLE IF NOT EXISTS site_settings (
  setting_key text PRIMARY KEY,
  setting_value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO site_settings (setting_key, setting_value)
VALUES ('rounds_public_enabled', 'false')
ON CONFLICT (setting_key) DO NOTHING;

CREATE INDEX IF NOT EXISTS round_requests_status_idx ON round_requests(status);
CREATE INDEX IF NOT EXISTS round_requests_created_at_idx ON round_requests(created_at);

ALTER TABLE rounds
  ADD COLUMN IF NOT EXISTS is_trait_contest boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trait_submissions_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE round_requests
  ADD COLUMN IF NOT EXISTS is_trait_contest boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trait_submissions_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE rounds
  DROP CONSTRAINT IF EXISTS rounds_voting_strategy_check,
  ADD CONSTRAINT rounds_voting_strategy_check
  CHECK (voting_strategy IN ('one_per_wallet', 'one_per_nft', 'fixed_per_wallet', 'base_plus_voting_power'));

ALTER TABLE round_requests
  DROP CONSTRAINT IF EXISTS round_requests_voting_strategy_check,
  ADD CONSTRAINT round_requests_voting_strategy_check
  CHECK (voting_strategy IN ('one_per_wallet', 'one_per_nft', 'fixed_per_wallet', 'base_plus_voting_power'));

ALTER TABLE round_submissions
  ADD COLUMN IF NOT EXISTS submission_type text NOT NULL DEFAULT 'project',
  ADD COLUMN IF NOT EXISTS trait_id text,
  ADD COLUMN IF NOT EXISTS trait_type text,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'project',
  ADD COLUMN IF NOT EXISTS source_payload jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS round_submissions_round_trait_unique_idx
  ON round_submissions(round_id, trait_id)
  WHERE trait_id IS NOT NULL AND deleted_at IS NULL;
