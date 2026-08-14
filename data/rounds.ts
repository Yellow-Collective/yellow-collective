import { randomUUID } from "crypto";
import { Pool, type PoolClient } from "pg";
import { getAddress, isAddress } from "viem";
import { getRoundState } from "@/utils/rounds/state";
import {
  getBlockNumberAtOrBeforeTimestamp,
  getLatestRoundVotingBlockTimestamp,
} from "@/utils/rounds/getCollectiveNounVotingPower";
import {
  getEffectiveRoundVotingSnapshotAt,
  hasRoundVotingSnapshotChanged,
  isRoundVotingSnapshotMode,
  isRoundVotingSnapshotReady,
  validateRoundVotingSnapshot,
  type RoundVotingSnapshotMode,
} from "@/utils/rounds/voting-snapshot";
import {
  getNoundrySubmissionById,
  type NoundrySubmission,
} from "data/noundry/submissions";
import {
  validateRoundVoteAllocation,
  type RoundVoteAllocationInput,
} from "@/utils/rounds/validateRoundVote";
import {
  normalizeSafeImageUrl,
  normalizeSafeProjectUrl,
} from "@/utils/url-safety";
import {
  escapeSvgAttribute,
  fitRoundTraitText,
  validateDerivedRoundTraitSubmission,
} from "@/utils/noundry/round-trait-submission";
import {
  getDummyPublicRoundBySlug,
  getDummyPublicRounds,
} from "data/dummy-content";
import { getDefaultRoundVotesPerWallet } from "@/utils/rounds/voting-strategy";

export type RoundStatus = "draft" | "published" | "archived";
export type RoundSubmissionStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "hidden";
export type RoundRequestStatus = "pending" | "approved" | "rejected";
export type RoundVotingStrategy =
  | "one_per_wallet"
  | "one_per_nft"
  | "fixed_per_wallet"
  | "base_plus_voting_power";
export type { RoundVotingSnapshotMode };
export type RoundSubmissionType = "project" | "trait";

export type Round = {
  id: string;
  slug: string;
  title: string;
  description: string;
  content: string;
  image: string;
  startsAt: string;
  submissionsOpenAt: string;
  votingStartsAt: string;
  votingEndsAt: string;
  endsAt: string;
  active: boolean;
  featured: boolean;
  isTraitContest: boolean;
  traitSubmissionsEnabled: boolean;
  status: RoundStatus;
  votingStrategy: RoundVotingStrategy;
  votesPerWallet: number;
  votingSnapshotMode: RoundVotingSnapshotMode;
  votingSnapshotAt: string | null;
  votingSnapshotBlock: number | null;
  winnerCount: number;
  maxSubmissionsPerWallet: number;
  minTitleLength: number;
  maxTitleLength: number;
  minDescriptionLength: number;
  maxDescriptionLength: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  submissionCount?: number;
  approvedSubmissionCount?: number;
  totalVotes?: number;
  awards?: RoundAward[];
};

export type RoundSubmission = {
  id: string;
  roundId: string;
  walletAddress: string;
  title: string;
  description: string;
  image: string;
  url: string;
  submissionType: RoundSubmissionType;
  traitId: string | null;
  traitType: string | null;
  source: string;
  sourcePayload: Record<string, any> | null;
  status: RoundSubmissionStatus;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  hiddenAt: string | null;
  deletedAt: string | null;
  voteCount: number;
  winnerPosition: number | null;
};

export type RoundVoteActivity = {
  id: string;
  walletAddress: string;
  submissionId: string;
  submissionTitle: string;
  voteCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminRoundVote = RoundVoteActivity & {
  roundId: string;
  submissionStatus: RoundSubmissionStatus | null;
  submissionDeleted: boolean;
};

export type AdminRoundVoteSort = "newest" | "oldest" | "highest" | "lowest";

export type AdminRoundVoteFilters = {
  search: string;
  submissionId: string;
  walletAddress: string;
  sort: AdminRoundVoteSort;
  direction: "asc" | "desc";
};

export type ProfileRoundSubmission = RoundSubmission & {
  roundSlug: string;
  roundTitle: string;
};

export type ProfileRoundVote = RoundVoteActivity & {
  roundId: string;
  roundSlug: string;
  roundTitle: string;
};

export type PublicRoundActivity = {
  submissions: ProfileRoundSubmission[];
  votes: ProfileRoundVote[];
};

export type RoundAward = {
  id: string;
  roundId: string;
  position: number;
  title: string;
  description: string;
  value: string;
  createdAt: string;
  updatedAt: string;
};

export type RoundRequest = {
  id: string;
  walletAddress: string | null;
  requesterName: string;
  requesterEmail: string;
  requestedSlug: string;
  title: string;
  description: string;
  content: string;
  image: string;
  url: string;
  timeline: string;
  startsAt: string;
  submissionsOpenAt: string;
  votingStartsAt: string;
  votingEndsAt: string;
  endsAt: string;
  votingStrategy: RoundVotingStrategy;
  votesPerWallet: number;
  votingSnapshotMode: RoundVotingSnapshotMode;
  votingSnapshotAt: string | null;
  winnerCount: number;
  maxSubmissionsPerWallet: number;
  isTraitContest: boolean;
  traitSubmissionsEnabled: boolean;
  awards: RoundAwardInput[];
  status: RoundRequestStatus;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
  deletedAt: string | null;
};

export type RoundWithSubmissions = Round & {
  submissions: RoundSubmission[];
  voteActivity: RoundVoteActivity[];
};

export type RoundInput = Partial<
  Pick<
    Round,
    | "slug"
    | "title"
    | "description"
    | "content"
    | "image"
    | "startsAt"
    | "submissionsOpenAt"
    | "votingStartsAt"
    | "votingEndsAt"
    | "endsAt"
    | "active"
    | "featured"
    | "isTraitContest"
    | "traitSubmissionsEnabled"
    | "status"
    | "votingStrategy"
    | "votesPerWallet"
    | "votingSnapshotMode"
    | "votingSnapshotAt"
    | "winnerCount"
    | "maxSubmissionsPerWallet"
    | "minTitleLength"
    | "maxTitleLength"
    | "minDescriptionLength"
    | "maxDescriptionLength"
  >
> & {
  awards?: RoundAwardInput[];
};

export type RoundAwardInput = Partial<
  Pick<RoundAward, "position" | "title" | "description" | "value">
>;

type NormalizedRoundInput = Required<Omit<RoundInput, "awards">>;

export type RoundSubmissionInput = Partial<
  Pick<
    RoundSubmission,
    | "walletAddress"
    | "title"
    | "description"
    | "image"
    | "url"
    | "submissionType"
    | "traitId"
    | "traitType"
    | "source"
    | "sourcePayload"
  >
>;

export type RoundRequestInput = Partial<
  Pick<
    RoundRequest,
    | "walletAddress"
    | "requesterName"
    | "requesterEmail"
    | "requestedSlug"
    | "title"
    | "description"
    | "content"
    | "image"
    | "url"
    | "timeline"
    | "startsAt"
    | "submissionsOpenAt"
    | "votingStartsAt"
    | "votingEndsAt"
    | "endsAt"
    | "votingStrategy"
    | "votesPerWallet"
    | "votingSnapshotMode"
    | "votingSnapshotAt"
    | "winnerCount"
    | "maxSubmissionsPerWallet"
    | "isTraitContest"
    | "traitSubmissionsEnabled"
  >
> & {
  awards?: RoundAwardInput[];
};

const DEFAULT_LIMITS = {
  maxSubmissionsPerWallet: 1,
  winnerCount: 1,
  minTitleLength: 3,
  maxTitleLength: 120,
  minDescriptionLength: 20,
  maxDescriptionLength: 2000,
};

let pool: Pool | null = null;
let tableReady: Promise<void> | null = null;
const ROUNDS_PUBLIC_SETTING_KEY = "rounds_public_enabled";
const DEMO_ROUND_SLUG_PATTERN = "demo-%";

const getConnectionString = () =>
  process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;

const getPool = () => {
  const connectionString = getConnectionString();

  if (!connectionString) {
    throw new Error("DATABASE_PUBLIC_URL or DATABASE_URL is required.");
  }

  if (!pool) {
    pool = new Pool({
      connectionString,
      connectionTimeoutMillis: 8000,
      idleTimeoutMillis: 10000,
      max: 2,
      ssl: connectionString.includes("railway.internal")
        ? undefined
        : { rejectUnauthorized: false },
    });
  }

  return pool;
};

const ensureTables = async () => {
  if (!tableReady) {
    tableReady = getPool()
      .query(
        `
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
            voting_snapshot_mode text NOT NULL DEFAULT 'voting_start',
            voting_snapshot_at timestamptz,
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
            CONSTRAINT rounds_voting_snapshot_mode_check CHECK (voting_snapshot_mode IN ('voting_start', 'custom')),
            CONSTRAINT rounds_voting_snapshot_date_check CHECK (
              (voting_snapshot_mode = 'voting_start' AND voting_snapshot_at IS NULL)
              OR (voting_snapshot_mode = 'custom' AND voting_snapshot_at IS NOT NULL AND voting_snapshot_at <= voting_starts_at)
            ),
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

          CREATE TABLE IF NOT EXISTS round_vote_admin_audit (
            id text PRIMARY KEY,
            round_id text NOT NULL,
            vote_id text NOT NULL,
            admin_wallet_address text NOT NULL,
            action text NOT NULL,
            before_state jsonb NOT NULL,
            after_state jsonb,
            reason text NOT NULL DEFAULT '',
            created_at timestamptz NOT NULL DEFAULT now(),
            CONSTRAINT round_vote_admin_audit_action_check CHECK (action IN ('update', 'delete'))
          );

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

          CREATE TABLE IF NOT EXISTS round_requests (
            id text PRIMARY KEY,
            wallet_address text,
            requester_name text NOT NULL DEFAULT '',
            requester_email text NOT NULL DEFAULT '',
            requested_slug text NOT NULL DEFAULT '',
            title text NOT NULL,
            description text NOT NULL,
            content text NOT NULL DEFAULT '',
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
            voting_snapshot_mode text NOT NULL DEFAULT 'voting_start',
            voting_snapshot_at timestamptz,
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
            CONSTRAINT round_requests_voting_snapshot_mode_check CHECK (voting_snapshot_mode IN ('voting_start', 'custom')),
            CONSTRAINT round_requests_voting_snapshot_date_check CHECK (
              (voting_snapshot_mode = 'voting_start' AND voting_snapshot_at IS NULL)
              OR (voting_snapshot_mode = 'custom' AND voting_snapshot_at IS NOT NULL AND voting_snapshot_at <= voting_starts_at)
            ),
            CONSTRAINT round_requests_votes_per_wallet_check CHECK (votes_per_wallet > 0),
            CONSTRAINT round_requests_winner_count_check CHECK (winner_count > 0),
            CONSTRAINT round_requests_submission_limit_check CHECK (max_submissions_per_wallet > 0)
          );

          CREATE TABLE IF NOT EXISTS site_settings (
            setting_key text PRIMARY KEY,
            setting_value text NOT NULL,
            updated_at timestamptz NOT NULL DEFAULT now()
          );

          CREATE INDEX IF NOT EXISTS rounds_status_idx ON rounds(status);
          CREATE INDEX IF NOT EXISTS rounds_active_idx ON rounds(active);
          CREATE INDEX IF NOT EXISTS rounds_featured_idx ON rounds(featured);
          CREATE INDEX IF NOT EXISTS rounds_dates_idx ON rounds(starts_at, voting_starts_at, voting_ends_at, ends_at);
          CREATE INDEX IF NOT EXISTS round_submissions_round_status_idx ON round_submissions(round_id, status);
          CREATE INDEX IF NOT EXISTS round_submissions_wallet_idx ON round_submissions(round_id, wallet_address);
          CREATE INDEX IF NOT EXISTS round_votes_round_submission_idx ON round_votes(round_id, submission_id);
          CREATE INDEX IF NOT EXISTS round_votes_round_wallet_idx ON round_votes(round_id, wallet_address);
          CREATE UNIQUE INDEX IF NOT EXISTS round_votes_round_submission_wallet_idx
            ON round_votes(round_id, submission_id, wallet_address);
          CREATE INDEX IF NOT EXISTS round_vote_admin_audit_round_created_idx
            ON round_vote_admin_audit(round_id, created_at DESC);
          CREATE INDEX IF NOT EXISTS round_vote_admin_audit_vote_idx
            ON round_vote_admin_audit(vote_id);
          CREATE INDEX IF NOT EXISTS round_awards_round_position_idx ON round_awards(round_id, award_position);
          CREATE INDEX IF NOT EXISTS round_winners_round_position_idx ON round_winners(round_id, winner_position);
          CREATE INDEX IF NOT EXISTS round_requests_status_idx ON round_requests(status);
          CREATE INDEX IF NOT EXISTS round_requests_created_at_idx ON round_requests(created_at);
        `
      )
      .then(() =>
        getPool().query(`
          ALTER TABLE rounds
            ADD COLUMN IF NOT EXISTS winner_count integer NOT NULL DEFAULT 1,
            ADD COLUMN IF NOT EXISTS voting_strategy text NOT NULL DEFAULT 'one_per_nft',
            ADD COLUMN IF NOT EXISTS votes_per_wallet integer NOT NULL DEFAULT 1,
            ADD COLUMN IF NOT EXISTS voting_snapshot_mode text NOT NULL DEFAULT 'voting_start',
            ADD COLUMN IF NOT EXISTS voting_snapshot_at timestamptz,
            ADD COLUMN IF NOT EXISTS voting_snapshot_block integer,
            ADD COLUMN IF NOT EXISTS is_trait_contest boolean NOT NULL DEFAULT false,
            ADD COLUMN IF NOT EXISTS trait_submissions_enabled boolean NOT NULL DEFAULT false
        `)
      )
      .then(() =>
        getPool().query(`
          ALTER TABLE round_submissions
            ADD COLUMN IF NOT EXISTS submission_type text NOT NULL DEFAULT 'project',
            ADD COLUMN IF NOT EXISTS trait_id text,
            ADD COLUMN IF NOT EXISTS trait_type text,
            ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'project',
            ADD COLUMN IF NOT EXISTS source_payload jsonb NOT NULL DEFAULT '{}'::jsonb
        `)
      )
      .then(() =>
        getPool().query(`
          CREATE UNIQUE INDEX IF NOT EXISTS round_submissions_round_trait_unique_idx
            ON round_submissions(round_id, trait_id)
            WHERE trait_id IS NOT NULL AND deleted_at IS NULL
        `)
      )
      .then(() =>
        getPool().query(`
          ALTER TABLE round_requests
            ADD COLUMN IF NOT EXISTS requested_slug text NOT NULL DEFAULT '',
            ADD COLUMN IF NOT EXISTS content text NOT NULL DEFAULT '',
            ADD COLUMN IF NOT EXISTS starts_at timestamptz,
            ADD COLUMN IF NOT EXISTS submissions_open_at timestamptz,
            ADD COLUMN IF NOT EXISTS voting_starts_at timestamptz,
            ADD COLUMN IF NOT EXISTS voting_ends_at timestamptz,
            ADD COLUMN IF NOT EXISTS ends_at timestamptz,
            ADD COLUMN IF NOT EXISTS voting_strategy text NOT NULL DEFAULT 'one_per_nft',
            ADD COLUMN IF NOT EXISTS votes_per_wallet integer NOT NULL DEFAULT 1,
            ADD COLUMN IF NOT EXISTS voting_snapshot_mode text NOT NULL DEFAULT 'voting_start',
            ADD COLUMN IF NOT EXISTS voting_snapshot_at timestamptz,
            ADD COLUMN IF NOT EXISTS winner_count integer NOT NULL DEFAULT 1,
            ADD COLUMN IF NOT EXISTS max_submissions_per_wallet integer NOT NULL DEFAULT 1,
            ADD COLUMN IF NOT EXISTS is_trait_contest boolean NOT NULL DEFAULT false,
            ADD COLUMN IF NOT EXISTS trait_submissions_enabled boolean NOT NULL DEFAULT false,
            ADD COLUMN IF NOT EXISTS awards jsonb NOT NULL DEFAULT '[]'::jsonb
        `)
      )
      .then(() =>
        getPool().query(`
          ALTER TABLE rounds
            DROP CONSTRAINT IF EXISTS rounds_voting_strategy_check,
            ADD CONSTRAINT rounds_voting_strategy_check
            CHECK (voting_strategy IN ('one_per_wallet', 'one_per_nft', 'fixed_per_wallet', 'base_plus_voting_power'));

          ALTER TABLE round_requests
            DROP CONSTRAINT IF EXISTS round_requests_voting_strategy_check,
            ADD CONSTRAINT round_requests_voting_strategy_check
            CHECK (voting_strategy IN ('one_per_wallet', 'one_per_nft', 'fixed_per_wallet', 'base_plus_voting_power'));
        `)
      )
      .then(() =>
        getPool().query(`
          ALTER TABLE round_requests
            DROP COLUMN IF EXISTS goals
        `)
      )
      .then(() =>
        getPool().query(`
          UPDATE rounds
          SET ends_at = voting_ends_at
          WHERE ends_at IS DISTINCT FROM voting_ends_at
        `)
      )
      .then(() =>
        getPool().query(`
          UPDATE round_requests
          SET ends_at = voting_ends_at
          WHERE voting_ends_at IS NOT NULL
            AND ends_at IS DISTINCT FROM voting_ends_at
        `)
      )
      .then(() =>
        getPool().query(`
          UPDATE round_requests
          SET status = 'pending'
          WHERE status = 'reviewed'
        `)
      )
      .then(() =>
        getPool().query(`
          ALTER TABLE rounds
            DROP CONSTRAINT IF EXISTS rounds_date_order_check,
            ADD CONSTRAINT rounds_date_order_check CHECK (
              starts_at <= submissions_open_at
              AND submissions_open_at <= voting_starts_at
              AND voting_starts_at < voting_ends_at
              AND voting_ends_at = ends_at
            )
        `)
      )
      .then(() =>
        getPool().query(`
          ALTER TABLE round_requests
            DROP CONSTRAINT IF EXISTS round_requests_status_check,
            ADD CONSTRAINT round_requests_status_check CHECK (status IN ('pending', 'approved', 'rejected'))
        `)
      )
      .then(() =>
        getPool().query(`
          ALTER TABLE rounds
            DROP CONSTRAINT IF EXISTS rounds_voting_snapshot_mode_check,
            DROP CONSTRAINT IF EXISTS rounds_voting_snapshot_date_check,
            ADD CONSTRAINT rounds_voting_snapshot_mode_check CHECK (voting_snapshot_mode IN ('voting_start', 'custom')),
            ADD CONSTRAINT rounds_voting_snapshot_date_check CHECK (
              (voting_snapshot_mode = 'voting_start' AND voting_snapshot_at IS NULL)
              OR (voting_snapshot_mode = 'custom' AND voting_snapshot_at IS NOT NULL AND voting_snapshot_at <= voting_starts_at)
            )
        `)
      )
      .then(() =>
        getPool().query(`
          ALTER TABLE round_requests
            DROP CONSTRAINT IF EXISTS round_requests_voting_snapshot_mode_check,
            DROP CONSTRAINT IF EXISTS round_requests_voting_snapshot_date_check,
            ADD CONSTRAINT round_requests_voting_snapshot_mode_check CHECK (voting_snapshot_mode IN ('voting_start', 'custom')),
            ADD CONSTRAINT round_requests_voting_snapshot_date_check CHECK (
              (voting_snapshot_mode = 'voting_start' AND voting_snapshot_at IS NULL)
              OR (voting_snapshot_mode = 'custom' AND voting_snapshot_at IS NOT NULL AND voting_snapshot_at <= voting_starts_at)
            )
        `)
      )
      .then(() =>
        getPool().query(
          `
            INSERT INTO site_settings (setting_key, setting_value)
            VALUES ($1, 'false')
            ON CONFLICT (setting_key) DO NOTHING
          `,
          [ROUNDS_PUBLIC_SETTING_KEY]
        )
      )
      .then(() => undefined);
  }

  return tableReady;
};

const formatDate = (value: Date | string | null) => {
  if (!value) return null;
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
};

const parseJson = <T>(value: T | string): T =>
  typeof value === "string" ? JSON.parse(value) : value;

const roundSelectFields = `
  r.id,
  r.slug,
  r.title,
  r.description,
  r.content,
  r.image,
  r.starts_at,
  r.submissions_open_at,
  r.voting_starts_at,
  r.voting_ends_at,
  r.ends_at,
  r.active,
  r.featured,
  r.is_trait_contest,
  r.trait_submissions_enabled,
  r.status,
  r.voting_strategy,
  r.votes_per_wallet,
  r.voting_snapshot_mode,
  r.voting_snapshot_at,
  r.voting_snapshot_block,
  r.winner_count,
  r.max_submissions_per_wallet,
  r.min_title_length,
  r.max_title_length,
  r.min_description_length,
  r.max_description_length,
  r.created_at,
  r.updated_at,
  r.deleted_at,
  COALESCE(stats.submission_count, 0)::int AS submission_count,
  COALESCE(stats.approved_submission_count, 0)::int AS approved_submission_count,
  COALESCE(stats.total_votes, 0)::int AS total_votes
`;

const submissionSelectFields = `
  s.id,
  s.round_id,
  s.wallet_address,
  s.title,
  s.description,
  s.image,
  s.url,
  s.submission_type,
  s.trait_id,
  s.trait_type,
  s.source,
  s.source_payload,
  s.status,
  s.created_at,
  s.updated_at,
  s.approved_at,
  s.rejected_at,
  s.hidden_at,
  s.deleted_at,
  COALESCE(vote_totals.vote_count, 0)::int AS vote_count,
  w.winner_position
`;

const requestSelectFields = `
  id,
  wallet_address,
  requester_name,
  requester_email,
  requested_slug,
  title,
  description,
  content,
  image,
  url,
  timeline,
  starts_at,
  submissions_open_at,
  voting_starts_at,
  voting_ends_at,
  ends_at,
  voting_strategy,
  votes_per_wallet,
  voting_snapshot_mode,
  voting_snapshot_at,
  winner_count,
  max_submissions_per_wallet,
  is_trait_contest,
  trait_submissions_enabled,
  awards,
  status,
  created_at,
  updated_at,
  reviewed_at,
  deleted_at
`;

const awardSelectFields = `
  id,
  round_id,
  award_position,
  title,
  description,
  award_value,
  created_at,
  updated_at
`;

const roundStatsJoin = `
  LEFT JOIN (
    SELECT
      r.id AS round_id,
      COALESCE(submission_stats.submission_count, 0)::int AS submission_count,
      COALESCE(submission_stats.approved_submission_count, 0)::int AS approved_submission_count,
      COALESCE(vote_stats.total_votes, 0)::int AS total_votes
    FROM rounds r
    LEFT JOIN (
      SELECT
        round_id,
        COUNT(*) FILTER (WHERE deleted_at IS NULL)::int AS submission_count,
        COUNT(*) FILTER (WHERE status = 'approved' AND deleted_at IS NULL)::int AS approved_submission_count
      FROM round_submissions
      GROUP BY round_id
    ) submission_stats ON submission_stats.round_id = r.id
    LEFT JOIN (
      SELECT round_id, COALESCE(SUM(vote_count), 0)::int AS total_votes
      FROM round_votes
      GROUP BY round_id
    ) vote_stats ON vote_stats.round_id = r.id
  ) stats ON stats.round_id = r.id
`;

const voteTotalsJoin = `
  LEFT JOIN (
    SELECT submission_id, COALESCE(SUM(vote_count), 0)::int AS vote_count
    FROM round_votes
    GROUP BY submission_id
  ) vote_totals ON vote_totals.submission_id = s.id
`;

const winnersJoin = `
  LEFT JOIN round_winners w ON w.round_id = s.round_id AND w.submission_id = s.id
`;

const mapRound = (row: Record<string, any>): Round => ({
  id: row.id,
  slug: row.slug,
  title: row.title,
  description: row.description,
  content: row.content,
  image: row.image,
  startsAt: formatDate(row.starts_at) || "",
  submissionsOpenAt: formatDate(row.submissions_open_at) || "",
  votingStartsAt: formatDate(row.voting_starts_at) || "",
  votingEndsAt: formatDate(row.voting_ends_at) || "",
  endsAt: formatDate(row.ends_at) || "",
  active: Boolean(row.active),
  featured: Boolean(row.featured),
  isTraitContest: Boolean(row.is_trait_contest),
  traitSubmissionsEnabled: Boolean(row.trait_submissions_enabled),
  status: row.status,
  votingStrategy: row.voting_strategy || "one_per_nft",
  votesPerWallet: Number(row.votes_per_wallet || 1),
  votingSnapshotMode: isRoundVotingSnapshotMode(row.voting_snapshot_mode)
    ? row.voting_snapshot_mode
    : "voting_start",
  votingSnapshotAt: formatDate(row.voting_snapshot_at),
  votingSnapshotBlock: row.voting_snapshot_block
    ? Number(row.voting_snapshot_block)
    : null,
  winnerCount: Number(row.winner_count || 1),
  maxSubmissionsPerWallet: Number(row.max_submissions_per_wallet),
  minTitleLength: Number(row.min_title_length),
  maxTitleLength: Number(row.max_title_length),
  minDescriptionLength: Number(row.min_description_length),
  maxDescriptionLength: Number(row.max_description_length),
  createdAt: formatDate(row.created_at) || "",
  updatedAt: formatDate(row.updated_at) || "",
  deletedAt: formatDate(row.deleted_at),
  submissionCount: Number(row.submission_count || 0),
  approvedSubmissionCount: Number(row.approved_submission_count || 0),
  totalVotes: Number(row.total_votes || 0),
});

const mapSubmission = (row: Record<string, any>): RoundSubmission => ({
  id: row.id,
  roundId: row.round_id,
  walletAddress: row.wallet_address,
  title: row.title,
  description: row.description,
  image: row.image,
  url: row.url,
  submissionType: row.submission_type || "project",
  traitId: row.trait_id || null,
  traitType: row.trait_type || null,
  source: row.source || "project",
  sourcePayload: row.source_payload
    ? parseJson<Record<string, any>>(row.source_payload)
    : null,
  status: row.status,
  createdAt: formatDate(row.created_at) || "",
  updatedAt: formatDate(row.updated_at) || "",
  approvedAt: formatDate(row.approved_at),
  rejectedAt: formatDate(row.rejected_at),
  hiddenAt: formatDate(row.hidden_at),
  deletedAt: formatDate(row.deleted_at),
  voteCount: Number(row.vote_count || 0),
  winnerPosition: row.winner_position ? Number(row.winner_position) : null,
});

const mapRoundRequest = (row: Record<string, any>): RoundRequest => ({
  id: row.id,
  walletAddress: row.wallet_address,
  requesterName: row.requester_name,
  requesterEmail: row.requester_email,
  requestedSlug: row.requested_slug,
  title: row.title,
  description: row.description,
  content: row.content,
  image: row.image,
  url: row.url,
  timeline: row.timeline,
  startsAt: formatDate(row.starts_at) || "",
  submissionsOpenAt: formatDate(row.submissions_open_at) || "",
  votingStartsAt: formatDate(row.voting_starts_at) || "",
  votingEndsAt: formatDate(row.voting_ends_at) || "",
  endsAt: formatDate(row.ends_at) || "",
  votingStrategy: row.voting_strategy || "one_per_nft",
  votesPerWallet: Number(row.votes_per_wallet || 1),
  votingSnapshotMode: isRoundVotingSnapshotMode(row.voting_snapshot_mode)
    ? row.voting_snapshot_mode
    : "voting_start",
  votingSnapshotAt: formatDate(row.voting_snapshot_at),
  winnerCount: Number(row.winner_count || 1),
  maxSubmissionsPerWallet: Number(row.max_submissions_per_wallet || 1),
  isTraitContest: Boolean(row.is_trait_contest),
  traitSubmissionsEnabled: Boolean(row.trait_submissions_enabled),
  awards: parseJson<RoundAwardInput[]>(row.awards || []),
  status: row.status,
  createdAt: formatDate(row.created_at) || "",
  updatedAt: formatDate(row.updated_at) || "",
  reviewedAt: formatDate(row.reviewed_at),
  deletedAt: formatDate(row.deleted_at),
});

const mapAward = (row: Record<string, any>): RoundAward => ({
  id: row.id,
  roundId: row.round_id,
  position: Number(row.award_position),
  title: row.title,
  description: row.description,
  value: row.award_value,
  createdAt: formatDate(row.created_at) || "",
  updatedAt: formatDate(row.updated_at) || "",
});

const normalizeSlug = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const normalizeDate = (value: unknown, fallback: Date) => {
  const date = value ? new Date(String(value)) : fallback;
  if (Number.isNaN(date.getTime())) return fallback.toISOString();
  return date.toISOString();
};

const normalizeOptionalDate = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
};

const isSafeUrl = (value: string, { allowDataImage = false } = {}) => {
  if (!value) return true;
  return Boolean(
    allowDataImage
      ? normalizeSafeImageUrl(value, {
          allowInternal: true,
          allowDataImages: true,
        })
      : normalizeSafeProjectUrl(value, { allowInternal: true })
  );
};

export const normalizeRoundInput = (
  input: RoundInput,
  current?: Round
): NormalizedRoundInput => {
  const now = new Date();
  const startsAtFallback = current?.startsAt ? new Date(current.startsAt) : now;
  const submissionsFallback = current?.submissionsOpenAt
    ? new Date(current.submissionsOpenAt)
    : startsAtFallback;
  const votingStartFallback = current?.votingStartsAt
    ? new Date(current.votingStartsAt)
    : new Date(submissionsFallback.getTime() + 7 * 24 * 60 * 60 * 1000);
  const votingEndFallback = current?.votingEndsAt
    ? new Date(current.votingEndsAt)
    : new Date(votingStartFallback.getTime() + 7 * 24 * 60 * 60 * 1000);
  const votingEndsAt = normalizeDate(
    input.votingEndsAt ?? current?.votingEndsAt,
    votingEndFallback
  );
  const votingStartsAt = normalizeDate(
    input.votingStartsAt ?? current?.votingStartsAt,
    votingStartFallback
  );
  const votingSnapshotMode = (input.votingSnapshotMode ??
    current?.votingSnapshotMode ??
    "voting_start") as RoundVotingSnapshotMode;
  const votingSnapshotAt =
    votingSnapshotMode === "custom"
      ? normalizeOptionalDate(
          input.votingSnapshotAt ?? current?.votingSnapshotAt ?? null
        )
      : null;
  const votingStrategy = (input.votingStrategy ??
    current?.votingStrategy ??
    "one_per_nft") as RoundVotingStrategy;
  const currentVotesPerWallet =
    current?.votingStrategy === votingStrategy
      ? current.votesPerWallet
      : undefined;

  return {
    slug: normalizeSlug(input.slug ?? current?.slug ?? `round-${Date.now()}`),
    title: String(input.title ?? current?.title ?? "New round").trim(),
    description: String(input.description ?? current?.description ?? "").trim(),
    content: String(input.content ?? current?.content ?? "").trim(),
    image: normalizeSafeImageUrl(input.image ?? current?.image ?? "", {
      allowInternal: true,
      allowDataImages: true,
    }),
    startsAt: normalizeDate(
      input.startsAt ?? current?.startsAt,
      startsAtFallback
    ),
    submissionsOpenAt: normalizeDate(
      input.submissionsOpenAt ?? current?.submissionsOpenAt,
      submissionsFallback
    ),
    votingStartsAt,
    votingEndsAt,
    endsAt: votingEndsAt,
    active: Boolean(input.active ?? current?.active ?? false),
    featured: Boolean(input.featured ?? current?.featured ?? false),
    isTraitContest: Boolean(
      input.isTraitContest ?? current?.isTraitContest ?? false
    ),
    traitSubmissionsEnabled: Boolean(
      input.traitSubmissionsEnabled ??
      current?.traitSubmissionsEnabled ??
      input.isTraitContest ??
      false
    ),
    status: (input.status ?? current?.status ?? "draft") as RoundStatus,
    votingStrategy,
    votesPerWallet: Number(
      input.votesPerWallet ??
        currentVotesPerWallet ??
        getDefaultRoundVotesPerWallet(votingStrategy)
    ),
    votingSnapshotMode,
    votingSnapshotAt,
    winnerCount: Number(
      input.winnerCount ?? current?.winnerCount ?? DEFAULT_LIMITS.winnerCount
    ),
    maxSubmissionsPerWallet: Number(
      input.maxSubmissionsPerWallet ??
        current?.maxSubmissionsPerWallet ??
        DEFAULT_LIMITS.maxSubmissionsPerWallet
    ),
    minTitleLength: Number(
      input.minTitleLength ??
        current?.minTitleLength ??
        DEFAULT_LIMITS.minTitleLength
    ),
    maxTitleLength: Number(
      input.maxTitleLength ??
        current?.maxTitleLength ??
        DEFAULT_LIMITS.maxTitleLength
    ),
    minDescriptionLength: Number(
      input.minDescriptionLength ??
        current?.minDescriptionLength ??
        DEFAULT_LIMITS.minDescriptionLength
    ),
    maxDescriptionLength: Number(
      input.maxDescriptionLength ??
        current?.maxDescriptionLength ??
        DEFAULT_LIMITS.maxDescriptionLength
    ),
  };
};

export const validateRoundInput = (input: NormalizedRoundInput) => {
  if (!input.slug || !/^[a-z0-9-]+$/.test(input.slug)) {
    return "A valid round slug is required.";
  }

  if (!input.title || input.title.length > 160) {
    return "A round title is required and must be 160 characters or fewer.";
  }

  if (
    input.status !== "draft" &&
    input.status !== "published" &&
    input.status !== "archived"
  ) {
    return "Round status is invalid.";
  }

  if (
    input.votingStrategy !== "one_per_wallet" &&
    input.votingStrategy !== "one_per_nft" &&
    input.votingStrategy !== "fixed_per_wallet" &&
    input.votingStrategy !== "base_plus_voting_power"
  ) {
    return "Voting type is invalid.";
  }

  if (!Number.isSafeInteger(input.votesPerWallet) || input.votesPerWallet < 1) {
    return "Votes per wallet must be a positive safe whole number.";
  }

  const snapshotValidationError = validateRoundVotingSnapshot(input);
  if (snapshotValidationError) return snapshotValidationError;

  if (
    !Number.isInteger(input.maxSubmissionsPerWallet) ||
    input.maxSubmissionsPerWallet < 1
  ) {
    return "Max submissions per wallet must be at least 1.";
  }

  if (!Number.isInteger(input.winnerCount) || input.winnerCount < 1) {
    return "Winner count must be at least 1.";
  }

  if (
    !Number.isInteger(input.minTitleLength) ||
    !Number.isInteger(input.maxTitleLength) ||
    input.minTitleLength < 1 ||
    input.maxTitleLength < input.minTitleLength
  ) {
    return "Title length limits are invalid.";
  }

  if (
    !Number.isInteger(input.minDescriptionLength) ||
    !Number.isInteger(input.maxDescriptionLength) ||
    input.minDescriptionLength < 1 ||
    input.maxDescriptionLength < input.minDescriptionLength
  ) {
    return "Description length limits are invalid.";
  }

  const dates = [
    input.startsAt,
    input.submissionsOpenAt,
    input.votingStartsAt,
    input.votingEndsAt,
    input.endsAt,
  ].map((value) => new Date(value).getTime());

  if (dates.some((value) => Number.isNaN(value))) {
    return "All round dates must be valid.";
  }

  if (
    dates[0] > dates[1] ||
    dates[1] > dates[2] ||
    dates[2] >= dates[3] ||
    dates[3] !== dates[4]
  ) {
    return "Round dates must be ordered from start through voting end.";
  }

  if (!isSafeUrl(input.image, { allowDataImage: true })) {
    return "Round image must be a valid URL.";
  }

  if (input.status === "published") {
    if (!input.description || !input.content || !input.image) {
      return "Published rounds need description, content, and image fields.";
    }
  }

  return undefined;
};

const normalizeRoundAwards = (awards?: RoundAwardInput[]) =>
  (Array.isArray(awards) ? awards : [])
    .map((award, index) => ({
      position: Number(award.position || index + 1),
      title: String(award.title || "").trim(),
      description: String(award.description || "").trim(),
      value: String(award.value || "").trim(),
    }))
    .filter((award) => award.title || award.description || award.value)
    .sort((first, second) => first.position - second.position);

const validateRoundAwards = (
  awards: RoundAwardInput[],
  winnerCount: number
) => {
  const normalizedAwards = normalizeRoundAwards(awards);
  const seenPositions = new Set<number>();

  for (const award of normalizedAwards) {
    if (!Number.isInteger(award.position) || award.position < 1) {
      return "Award positions must be positive whole numbers.";
    }

    if (award.position > winnerCount) {
      return "Award positions cannot exceed the winner count.";
    }

    if (seenPositions.has(award.position)) {
      return "Award positions must be unique.";
    }

    if (!award.title || award.title.length > 120) {
      return "Each award needs a title 120 characters or fewer.";
    }

    seenPositions.add(award.position);
  }

  return undefined;
};

const createTraitImageDataUri = (submission: NoundrySubmission) => {
  const cells = submission.pixels
    .map((color, index) => {
      if (!color || color === "transparent") return "";
      const x = index % 32;
      const y = Math.floor(index / 32);
      const fill = escapeSvgAttribute(String(color));
      return `<rect x="${x}" y="${y}" width="1" height="1" fill="${fill}" />`;
    })
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" shape-rendering="crispEdges"><rect width="32" height="32" fill="#fff7bf" />${cells}</svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
};

const replaceRoundAwards = async (
  roundId: string,
  awards: RoundAwardInput[],
  client: Pool | PoolClient = getPool()
) => {
  const normalizedAwards = normalizeRoundAwards(awards);

  await client.query(`DELETE FROM round_awards WHERE round_id = $1`, [roundId]);

  for (const award of normalizedAwards) {
    await client.query(
      `
        INSERT INTO round_awards (
          id,
          round_id,
          award_position,
          title,
          description,
          award_value
        )
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [
        randomUUID(),
        roundId,
        award.position,
        award.title,
        award.description,
        award.value,
      ]
    );
  }
};

export const listRoundAwards = async (roundId: string) => {
  await ensureTables();

  const result = await getPool().query(
    `
      SELECT ${awardSelectFields}
      FROM round_awards
      WHERE round_id = $1
      ORDER BY award_position ASC
    `,
    [roundId]
  );

  return result.rows.map(mapAward);
};

const hydrateRoundsWithAwards = async <T extends Round>(rounds: T[]) =>
  Promise.all(
    rounds.map(async (round) => ({
      ...round,
      awards: await listRoundAwards(round.id),
    }))
  );

export const validateRoundSubmissionInput = (
  round: Round,
  input: RoundSubmissionInput
) => {
  const title = String(input.title || "").trim();
  const description = String(input.description || "").trim();
  const image = String(input.image || "").trim();
  const url = String(input.url || "").trim();
  const normalizedImage = normalizeSafeImageUrl(image, {
    allowInternal: true,
    allowDataImages: true,
  });
  const normalizedUrl = normalizeSafeProjectUrl(url, { allowInternal: true });
  const submissionType = input.submissionType || "project";

  if (!input.walletAddress || !isAddress(input.walletAddress)) {
    return "A valid connected wallet is required.";
  }

  if (submissionType !== "project" && submissionType !== "trait") {
    return "Submission type is invalid.";
  }

  if (
    title.length < round.minTitleLength ||
    title.length > round.maxTitleLength
  ) {
    return `Title must be ${round.minTitleLength}-${round.maxTitleLength} characters.`;
  }

  if (
    description.length < round.minDescriptionLength ||
    description.length > round.maxDescriptionLength
  ) {
    return `Description must be ${round.minDescriptionLength}-${round.maxDescriptionLength} characters.`;
  }

  if (url && !normalizedUrl) {
    return "Submission URL must be a valid URL.";
  }

  if (!normalizedImage) {
    return "Image must be a valid URL.";
  }

  return undefined;
};

const normalizeRoundRequestInput = (input: RoundRequestInput) => {
  const walletAddress = input.walletAddress
    ? String(input.walletAddress).trim()
    : "";
  const votingEndsAt = normalizeDate(
    input.votingEndsAt,
    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
  );
  const submissionsOpenAt = normalizeDate(input.submissionsOpenAt, new Date());
  const votingStartsAt = normalizeDate(
    input.votingStartsAt,
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  );
  const votingSnapshotMode = (input.votingSnapshotMode ??
    "voting_start") as RoundVotingSnapshotMode;
  const votingStrategy = (input.votingStrategy ||
    "one_per_nft") as RoundVotingStrategy;

  return {
    walletAddress:
      walletAddress && isAddress(walletAddress)
        ? getAddress(walletAddress)
        : null,
    requesterName: String(input.requesterName || "").trim(),
    requesterEmail: String(input.requesterEmail || "").trim(),
    requestedSlug: normalizeSlug(input.requestedSlug || input.title || ""),
    title: String(input.title || "").trim(),
    description: String(input.description || "").trim(),
    content: String(input.content || "").trim(),
    image: normalizeSafeImageUrl(input.image, {
      allowInternal: true,
      allowDataImages: true,
    }),
    url: normalizeSafeProjectUrl(input.url, { allowInternal: true }),
    timeline: String(input.timeline || "").trim(),
    startsAt: submissionsOpenAt,
    submissionsOpenAt,
    votingStartsAt,
    votingEndsAt,
    endsAt: votingEndsAt,
    votingStrategy,
    votesPerWallet: Number(
      input.votesPerWallet ??
        getDefaultRoundVotesPerWallet(votingStrategy)
    ),
    votingSnapshotMode,
    votingSnapshotAt:
      votingSnapshotMode === "custom"
        ? normalizeOptionalDate(input.votingSnapshotAt)
        : null,
    winnerCount: Number(input.winnerCount || 1),
    maxSubmissionsPerWallet: Number(input.maxSubmissionsPerWallet || 1),
    isTraitContest: Boolean(input.isTraitContest),
    traitSubmissionsEnabled: Boolean(
      input.traitSubmissionsEnabled ?? input.isTraitContest
    ),
    awards: normalizeRoundAwards(input.awards),
  };
};

export const validateRoundRequestInput = (input: RoundRequestInput) => {
  const request = normalizeRoundRequestInput(input);

  if (!request.walletAddress || !isAddress(request.walletAddress)) {
    return "A valid connected wallet is required.";
  }

  if (
    !request.title ||
    request.title.length < 3 ||
    request.title.length > 120
  ) {
    return "Round title must be 3-120 characters.";
  }

  if (!request.requesterName || request.requesterName.length > 120) {
    return "Your name is required.";
  }

  if (!request.requesterEmail) {
    return "Email is required.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(request.requesterEmail)) {
    return "Email must be valid.";
  }

  if (
    !request.description ||
    request.description.length < 20 ||
    request.description.length > 2000
  ) {
    return "Summary must be 20-2000 characters.";
  }

  if (
    !request.content ||
    request.content.length < 20 ||
    request.content.length > 4000
  ) {
    return "Description must be 20-4000 characters.";
  }

  if (!request.requestedSlug || !/^[a-z0-9-]+$/.test(request.requestedSlug)) {
    return "A valid round slug is required.";
  }

  if (!request.image || !isSafeUrl(request.image, { allowDataImage: true })) {
    return "Image must be a valid URL.";
  }

  if (request.url && !isSafeUrl(request.url)) {
    return "Reference URL must be valid.";
  }

  const roundValidationError = validateRoundInput({
    slug: request.requestedSlug,
    title: request.title,
    description: request.description,
    content: request.content,
    image: request.image,
    startsAt: request.startsAt,
    submissionsOpenAt: request.submissionsOpenAt,
    votingStartsAt: request.votingStartsAt,
    votingEndsAt: request.votingEndsAt,
    endsAt: request.endsAt,
    active: true,
    featured: false,
    isTraitContest: request.isTraitContest,
    traitSubmissionsEnabled: request.traitSubmissionsEnabled,
    status: "published",
    votingStrategy: request.votingStrategy,
    votesPerWallet: request.votesPerWallet,
    votingSnapshotMode: request.votingSnapshotMode,
    votingSnapshotAt: request.votingSnapshotAt,
    winnerCount: request.winnerCount,
    maxSubmissionsPerWallet: request.maxSubmissionsPerWallet,
    minTitleLength: DEFAULT_LIMITS.minTitleLength,
    maxTitleLength: DEFAULT_LIMITS.maxTitleLength,
    minDescriptionLength: DEFAULT_LIMITS.minDescriptionLength,
    maxDescriptionLength: DEFAULT_LIMITS.maxDescriptionLength,
  });

  if (roundValidationError) return roundValidationError;

  const awardValidationError = validateRoundAwards(
    request.awards,
    request.winnerCount
  );

  if (awardValidationError) return awardValidationError;

  return undefined;
};

export const listPublicRounds = async () => {
  await ensureTables();

  const result = await getPool().query(
    `
      SELECT ${roundSelectFields}
      FROM rounds r
      ${roundStatsJoin}
      WHERE r.deleted_at IS NULL
        AND r.status = 'published'
        AND r.active = true
        AND r.slug NOT LIKE $1
      ORDER BY r.featured DESC, r.starts_at DESC
    `,
    [DEMO_ROUND_SLUG_PATTERN]
  );

  const [rounds, dummyRounds] = await Promise.all([
    hydrateRoundsWithAwards(result.rows.map(mapRound)),
    getDummyPublicRounds(),
  ]);

  return [...dummyRounds, ...rounds];
};

export const getRoundsPublicEnabled = async () => {
  await ensureTables();

  const result = await getPool().query(
    `
      SELECT setting_value
      FROM site_settings
      WHERE setting_key = $1
      LIMIT 1
    `,
    [ROUNDS_PUBLIC_SETTING_KEY]
  );

  return result.rows[0]?.setting_value === "true";
};

export const setRoundsPublicEnabled = async (enabled: boolean) => {
  await ensureTables();

  const result = await getPool().query(
    `
      INSERT INTO site_settings (setting_key, setting_value, updated_at)
      VALUES ($1, $2, now())
      ON CONFLICT (setting_key)
      DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = now()
      RETURNING setting_value
    `,
    [ROUNDS_PUBLIC_SETTING_KEY, enabled ? "true" : "false"]
  );

  return result.rows[0]?.setting_value === "true";
};

export const listAdminRounds = async () => {
  await ensureTables();

  const result = await getPool().query(
    `
      SELECT ${roundSelectFields}
      FROM rounds r
      ${roundStatsJoin}
      WHERE r.deleted_at IS NULL
        AND r.slug NOT LIKE $1
      ORDER BY
        CASE r.status
          WHEN 'draft' THEN 0
          WHEN 'published' THEN 1
          ELSE 2
        END,
        r.updated_at DESC,
        r.created_at DESC
    `,
    [DEMO_ROUND_SLUG_PATTERN]
  );

  return hydrateRoundsWithAwards(result.rows.map(mapRound));
};

export const listAdminRoundRequests = async () => {
  await ensureTables();

  const result = await getPool().query(
    `
      SELECT ${requestSelectFields}
      FROM round_requests
      WHERE deleted_at IS NULL
        AND status <> 'approved'
      ORDER BY
        CASE status
          WHEN 'pending' THEN 0
          ELSE 3
        END,
        created_at DESC
    `
  );

  return result.rows.map(mapRoundRequest);
};

export const createRoundRequest = async (input: RoundRequestInput) => {
  const validationError = validateRoundRequestInput(input);
  if (validationError) throw new Error(validationError);

  await ensureTables();
  const request = normalizeRoundRequestInput(input);
  const result = await getPool().query(
    `
      INSERT INTO round_requests (
        id,
        wallet_address,
        requester_name,
        requester_email,
        requested_slug,
        title,
        description,
        content,
        image,
        url,
        timeline,
        starts_at,
        submissions_open_at,
        voting_starts_at,
        voting_ends_at,
        ends_at,
        voting_strategy,
        votes_per_wallet,
        winner_count,
        max_submissions_per_wallet,
        is_trait_contest,
        trait_submissions_enabled,
        awards,
        voting_snapshot_mode,
        voting_snapshot_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
      RETURNING ${requestSelectFields}
    `,
    [
      randomUUID(),
      request.walletAddress,
      request.requesterName,
      request.requesterEmail,
      request.requestedSlug,
      request.title,
      request.description,
      request.content,
      request.image,
      request.url,
      request.timeline,
      request.startsAt,
      request.submissionsOpenAt,
      request.votingStartsAt,
      request.votingEndsAt,
      request.endsAt,
      request.votingStrategy,
      request.votesPerWallet,
      request.winnerCount,
      request.maxSubmissionsPerWallet,
      request.isTraitContest,
      request.traitSubmissionsEnabled,
      JSON.stringify(request.awards),
      request.votingSnapshotMode,
      request.votingSnapshotAt,
    ]
  );

  return mapRoundRequest(result.rows[0]);
};

export const setRoundRequestStatus = async ({
  id,
  status,
}: {
  id: string;
  status: RoundRequestStatus;
}) => {
  await ensureTables();

  const result = await getPool().query(
    `
      UPDATE round_requests
      SET status = $2,
        reviewed_at = CASE WHEN $2 = 'pending' THEN reviewed_at ELSE now() END,
        updated_at = now()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING ${requestSelectFields}
    `,
    [id, status]
  );

  return result.rows[0] ? mapRoundRequest(result.rows[0]) : null;
};

export const approveRoundRequest = async (id: string) => {
  await ensureTables();

  const client = await getPool().connect();
  let roundId: string | null = null;
  let updatedRequest: RoundRequest | null = null;

  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      `round-request:${id}`,
    ]);

    const currentResult = await client.query(
      `
        SELECT ${requestSelectFields}
        FROM round_requests
        WHERE id = $1 AND deleted_at IS NULL
        FOR UPDATE
      `,
      [id]
    );
    const request = currentResult.rows[0]
      ? mapRoundRequest(currentResult.rows[0])
      : null;

    if (!request) {
      await client.query("COMMIT");
      return null;
    }

    const roundInput = normalizeRoundInput({
      slug: request.requestedSlug,
      title: request.title,
      description: request.description,
      content: request.content,
      image: request.image,
      startsAt: request.startsAt,
      submissionsOpenAt: request.submissionsOpenAt,
      votingStartsAt: request.votingStartsAt,
      votingEndsAt: request.votingEndsAt,
      endsAt: request.endsAt,
      active: false,
      featured: false,
      isTraitContest: request.isTraitContest,
      traitSubmissionsEnabled: request.traitSubmissionsEnabled,
      status: "draft",
      votingStrategy: request.votingStrategy,
      votesPerWallet: request.votesPerWallet,
      votingSnapshotMode: request.votingSnapshotMode,
      votingSnapshotAt: request.votingSnapshotAt,
      winnerCount: request.winnerCount,
      maxSubmissionsPerWallet: request.maxSubmissionsPerWallet,
      minTitleLength: DEFAULT_LIMITS.minTitleLength,
      maxTitleLength: DEFAULT_LIMITS.maxTitleLength,
      minDescriptionLength: DEFAULT_LIMITS.minDescriptionLength,
      maxDescriptionLength: DEFAULT_LIMITS.maxDescriptionLength,
    });
    const validationError = validateRoundInput(roundInput);
    if (validationError) throw new Error(validationError);
    const awardsValidationError = validateRoundAwards(
      request.awards,
      roundInput.winnerCount
    );
    if (awardsValidationError) throw new Error(awardsValidationError);

    const existingRound = await client.query(
      `
        SELECT
          id,
          voting_starts_at,
          voting_snapshot_mode,
          voting_snapshot_at,
          voting_snapshot_block
        FROM rounds
        WHERE slug = $1 AND deleted_at IS NULL
        LIMIT 1
      `,
      [roundInput.slug]
    );

    if (existingRound.rows[0]?.id) {
      const existingRoundId = String(existingRound.rows[0].id);
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
        `voting-snapshot:${existingRoundId}`,
      ]);
      const lockedRoundResult = await client.query(
        `
          SELECT
            id,
            voting_starts_at,
            voting_snapshot_mode,
            voting_snapshot_at,
            voting_snapshot_block
          FROM rounds
          WHERE id = $1 AND deleted_at IS NULL
          FOR UPDATE
        `,
        [existingRoundId]
      );
      const existingRoundRow = lockedRoundResult.rows[0];
      if (
        existingRoundRow?.voting_snapshot_block &&
        hasRoundVotingSnapshotChanged(
          {
            votingStartsAt: formatDate(existingRoundRow.voting_starts_at) || "",
            votingSnapshotMode: isRoundVotingSnapshotMode(
              existingRoundRow.voting_snapshot_mode
            )
              ? existingRoundRow.voting_snapshot_mode
              : "voting_start",
            votingSnapshotAt: formatDate(existingRoundRow.voting_snapshot_at),
          },
          roundInput
        )
      ) {
        throw new Error(
          "Voting snapshot timing cannot change after its block is resolved."
        );
      }
      roundId = existingRoundId;
      await client.query(
        `
          UPDATE rounds
          SET title = $2,
            description = $3,
            content = $4,
            image = $5,
            starts_at = $6,
            submissions_open_at = $7,
            voting_starts_at = $8,
            voting_ends_at = $9,
            ends_at = $10,
            active = $11,
            featured = $12,
            is_trait_contest = $13,
            trait_submissions_enabled = $14,
            status = $15,
            voting_strategy = $16,
            votes_per_wallet = $17,
            winner_count = $18,
            max_submissions_per_wallet = $19,
            min_title_length = $20,
            max_title_length = $21,
            min_description_length = $22,
            max_description_length = $23,
            voting_snapshot_mode = $24,
            voting_snapshot_at = $25,
            updated_at = now()
          WHERE id = $1
        `,
        [
          roundId,
          roundInput.title,
          roundInput.description,
          roundInput.content,
          roundInput.image,
          roundInput.startsAt,
          roundInput.submissionsOpenAt,
          roundInput.votingStartsAt,
          roundInput.votingEndsAt,
          roundInput.endsAt,
          roundInput.active,
          roundInput.featured,
          roundInput.isTraitContest,
          roundInput.traitSubmissionsEnabled,
          roundInput.status,
          roundInput.votingStrategy,
          roundInput.votesPerWallet,
          roundInput.winnerCount,
          roundInput.maxSubmissionsPerWallet,
          roundInput.minTitleLength,
          roundInput.maxTitleLength,
          roundInput.minDescriptionLength,
          roundInput.maxDescriptionLength,
          roundInput.votingSnapshotMode,
          roundInput.votingSnapshotAt,
        ]
      );
      await replaceRoundAwards(existingRoundId, request.awards, client);
    } else {
      roundId = randomUUID();
      await client.query(
        `
          INSERT INTO rounds (
            id,
            slug,
            title,
            description,
            content,
            image,
            starts_at,
            submissions_open_at,
            voting_starts_at,
            voting_ends_at,
            ends_at,
            active,
            featured,
            is_trait_contest,
            trait_submissions_enabled,
            status,
            voting_strategy,
            votes_per_wallet,
            winner_count,
            max_submissions_per_wallet,
            min_title_length,
            max_title_length,
            min_description_length,
            max_description_length,
            voting_snapshot_mode,
            voting_snapshot_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
        `,
        [
          roundId,
          roundInput.slug,
          roundInput.title,
          roundInput.description,
          roundInput.content,
          roundInput.image,
          roundInput.startsAt,
          roundInput.submissionsOpenAt,
          roundInput.votingStartsAt,
          roundInput.votingEndsAt,
          roundInput.endsAt,
          roundInput.active,
          roundInput.featured,
          roundInput.isTraitContest,
          roundInput.traitSubmissionsEnabled,
          roundInput.status,
          roundInput.votingStrategy,
          roundInput.votesPerWallet,
          roundInput.winnerCount,
          roundInput.maxSubmissionsPerWallet,
          roundInput.minTitleLength,
          roundInput.maxTitleLength,
          roundInput.minDescriptionLength,
          roundInput.maxDescriptionLength,
          roundInput.votingSnapshotMode,
          roundInput.votingSnapshotAt,
        ]
      );
      await replaceRoundAwards(roundId, request.awards, client);
    }

    const updatedResult = await client.query(
      `
        UPDATE round_requests
        SET status = 'approved',
          reviewed_at = COALESCE(reviewed_at, now()),
          updated_at = now()
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING ${requestSelectFields}
      `,
      [id]
    );
    updatedRequest = updatedResult.rows[0]
      ? mapRoundRequest(updatedResult.rows[0])
      : null;

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  const round = roundId ? await getRoundById(roundId) : null;

  return {
    request: updatedRequest,
    round,
  };
};

export const removeRoundRequest = async (id: string) => {
  await ensureTables();

  const result = await getPool().query(
    `
      UPDATE round_requests
      SET deleted_at = now(),
        updated_at = now()
      WHERE id = $1
      RETURNING ${requestSelectFields}
    `,
    [id]
  );

  return result.rows[0] ? mapRoundRequest(result.rows[0]) : null;
};

export const getRoundBySlug = async (slug: string) => {
  await ensureTables();

  const result = await getPool().query(
    `
      SELECT ${roundSelectFields}
      FROM rounds r
      ${roundStatsJoin}
      WHERE r.slug = $1 AND r.deleted_at IS NULL
      LIMIT 1
    `,
    [slug]
  );

  if (!result.rows[0]) return null;

  const round = mapRound(result.rows[0]);
  return {
    ...round,
    awards: await listRoundAwards(round.id),
  };
};

export const getPublicRoundBySlug = async (slug: string) => {
  if (slug.startsWith("demo-")) {
    return getDummyPublicRoundBySlug(slug);
  }

  const round = await getRoundBySlug(slug);
  if (!round || round.status !== "published" || !round.active) return null;

  if (getRoundState(round) === "ended") {
    await finalizeRoundWinners(round);
  }

  const [submissions, voteActivity] = await Promise.all([
    listRoundSubmissions(round.id, {
      publicOnly: true,
    }),
    listRoundVoteActivity(round.id),
  ]);

  return { ...round, submissions, voteActivity };
};

export const getRoundById = async (id: string) => {
  await ensureTables();

  const result = await getPool().query(
    `
      SELECT ${roundSelectFields}
      FROM rounds r
      ${roundStatsJoin}
      WHERE r.id = $1 AND r.deleted_at IS NULL
      LIMIT 1
    `,
    [id]
  );

  if (!result.rows[0]) return null;

  const round = mapRound(result.rows[0]);
  return {
    ...round,
    awards: await listRoundAwards(round.id),
  };
};

export const listRoundSubmissions = async (
  roundId: string,
  { publicOnly = false }: { publicOnly?: boolean } = {}
) => {
  await ensureTables();

  const result = await getPool().query(
    `
      SELECT ${submissionSelectFields}
      FROM round_submissions s
      ${voteTotalsJoin}
      ${winnersJoin}
      WHERE s.round_id = $1
        AND s.deleted_at IS NULL
        ${publicOnly ? "AND (s.status = 'approved' OR w.winner_position IS NOT NULL)" : ""}
      ORDER BY
        CASE WHEN w.winner_position IS NULL THEN 1 ELSE 0 END,
        w.winner_position ASC,
        vote_count DESC,
        s.created_at DESC
    `,
    [roundId]
  );

  return result.rows.map(mapSubmission);
};

export const finalizeRoundWinners = async (round: Round) => {
  await ensureTables();

  if (getRoundState(round) !== "ended") return;

  const client = await getPool().connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      `winners:${round.id}`,
    ]);

    const existing = await client.query(
      `SELECT id FROM round_winners WHERE round_id = $1 LIMIT 1`,
      [round.id]
    );
    if (existing.rowCount) {
      await client.query("COMMIT");
      return;
    }

    const winners = await client.query(
      `
        SELECT
          s.id AS submission_id,
          COALESCE(SUM(v.vote_count), 0)::int AS vote_count
        FROM round_submissions s
        LEFT JOIN round_votes v ON v.submission_id = s.id AND v.round_id = s.round_id
        WHERE s.round_id = $1
          AND s.status = 'approved'
          AND s.deleted_at IS NULL
        GROUP BY s.id, s.created_at
        ORDER BY vote_count DESC, s.created_at DESC
        LIMIT $2
      `,
      [round.id, round.winnerCount]
    );

    for (let index = 0; index < winners.rows.length; index += 1) {
      const winner = winners.rows[index];
      await client.query(
        `
          INSERT INTO round_winners (
            id,
            round_id,
            submission_id,
            winner_position,
            vote_count
          )
          VALUES ($1, $2, $3, $4, $5)
        `,
        [
          randomUUID(),
          round.id,
          winner.submission_id,
          index + 1,
          Number(winner.vote_count || 0),
        ]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const getOrCreateRoundVotingSnapshotBlock = async (round: Round) => {
  await ensureTables();

  if (round.votingSnapshotBlock) return round.votingSnapshotBlock;

  const client = await getPool().connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      `voting-snapshot:${round.id}`,
    ]);

    const current = await client.query(
      `
        SELECT
          voting_starts_at,
          voting_snapshot_mode,
          voting_snapshot_at,
          voting_snapshot_block
        FROM rounds
        WHERE id = $1 AND deleted_at IS NULL
        LIMIT 1
      `,
      [round.id]
    );
    const existing = current.rows[0]?.voting_snapshot_block;
    if (existing) {
      await client.query("COMMIT");
      return Number(existing);
    }

    const snapshotConfig = {
      votingStartsAt: formatDate(current.rows[0]?.voting_starts_at) || "",
      votingSnapshotMode: isRoundVotingSnapshotMode(
        current.rows[0]?.voting_snapshot_mode
      )
        ? current.rows[0].voting_snapshot_mode
        : "voting_start",
      votingSnapshotAt: formatDate(current.rows[0]?.voting_snapshot_at),
    };
    const effectiveSnapshotAt =
      getEffectiveRoundVotingSnapshotAt(snapshotConfig);
    const latestBlockTimestamp = await getLatestRoundVotingBlockTimestamp();

    if (
      !isRoundVotingSnapshotReady(effectiveSnapshotAt, latestBlockTimestamp)
    ) {
      await client.query("COMMIT");
      return null;
    }

    const blockNumber =
      await getBlockNumberAtOrBeforeTimestamp(effectiveSnapshotAt);
    await client.query(
      `
        UPDATE rounds
        SET voting_snapshot_block = $2,
          updated_at = now()
        WHERE id = $1
      `,
      [round.id, blockNumber]
    );

    await client.query("COMMIT");
    return blockNumber;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const listRoundVoteActivity = async (roundId: string) => {
  await ensureTables();

  const result = await getPool().query(
    `
      SELECT
        v.id,
        v.wallet_address,
        v.submission_id,
        s.title AS submission_title,
        v.vote_count,
        v.created_at,
        v.updated_at
      FROM round_votes v
      INNER JOIN round_submissions s ON s.id = v.submission_id
      WHERE v.round_id = $1
        AND s.deleted_at IS NULL
      ORDER BY v.updated_at DESC, v.created_at DESC
    `,
    [roundId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    walletAddress: row.wallet_address,
    submissionId: row.submission_id,
    submissionTitle: row.submission_title,
    voteCount: Number(row.vote_count || 0),
    createdAt: formatDate(row.created_at) || "",
    updatedAt: formatDate(row.updated_at) || "",
  })) as RoundVoteActivity[];
};

const mapAdminRoundVoteRow = (row: Record<string, any>): AdminRoundVote => ({
  id: row.id,
  roundId: row.round_id,
  walletAddress: row.wallet_address,
  submissionId: row.submission_id,
  submissionTitle: row.submission_title || "Deleted submission",
  submissionStatus: row.submission_status || null,
  submissionDeleted: Boolean(row.submission_deleted),
  voteCount: Number(row.vote_count || 0),
  createdAt: formatDate(row.created_at) || "",
  updatedAt: formatDate(row.updated_at) || "",
});

const ADMIN_ROUND_VOTE_ORDER_BY: Record<AdminRoundVoteSort, string> = {
  newest: "v.updated_at DESC, v.created_at DESC, v.id ASC",
  oldest: "v.created_at ASC, v.updated_at ASC, v.id ASC",
  highest: "v.vote_count DESC, v.updated_at DESC, v.id ASC",
  lowest: "v.vote_count ASC, v.updated_at DESC, v.id ASC",
};

export const listAdminRoundVotes = async (
  roundId: string,
  filters: Partial<AdminRoundVoteFilters> = {},
  client: Pool | PoolClient = getPool()
) => {
  await ensureTables();

  const conditions = ["v.round_id = $1"];
  const values: unknown[] = [roundId];
  const addCondition = (condition: string, value: unknown) => {
    values.push(value);
    conditions.push(condition.replace("?", `$${values.length}`));
  };
  const search = filters.search?.trim();
  const submissionId = filters.submissionId?.trim();
  const walletAddress = filters.walletAddress?.trim();

  if (search) {
    values.push(`%${search}%`);
    const searchParameter = `$${values.length}`;
    conditions.push(
      `(v.id ILIKE ${searchParameter} OR v.submission_id ILIKE ${searchParameter} OR v.wallet_address ILIKE ${searchParameter} OR COALESCE(s.title, '') ILIKE ${searchParameter})`
    );
  }
  if (submissionId) {
    addCondition("v.submission_id = ?", submissionId);
  }
  if (walletAddress) {
    addCondition("lower(v.wallet_address) = lower(?)", walletAddress);
  }

  const sort = filters.sort || "newest";
  const orderBy = ADMIN_ROUND_VOTE_ORDER_BY[sort] || ADMIN_ROUND_VOTE_ORDER_BY.newest;
  const result = await client.query(
    `
      SELECT
        v.id,
        v.round_id,
        v.wallet_address,
        v.submission_id,
        COALESCE(s.title, 'Deleted submission') AS submission_title,
        s.status AS submission_status,
        (s.deleted_at IS NOT NULL) AS submission_deleted,
        v.vote_count,
        v.created_at,
        v.updated_at
      FROM round_votes v
      LEFT JOIN round_submissions s
        ON s.id = v.submission_id AND s.round_id = v.round_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY ${orderBy}
    `,
    values
  );

  return result.rows.map(mapAdminRoundVoteRow);
};

export const getAdminRoundVote = async (
  roundId: string,
  voteId: string,
  client: Pool | PoolClient = getPool()
) => {
  await ensureTables();

  const result = await client.query(
    `
      SELECT
        v.id,
        v.round_id,
        v.wallet_address,
        v.submission_id,
        COALESCE(s.title, 'Deleted submission') AS submission_title,
        s.status AS submission_status,
        (s.deleted_at IS NOT NULL) AS submission_deleted,
        v.vote_count,
        v.created_at,
        v.updated_at
      FROM round_votes v
      LEFT JOIN round_submissions s
        ON s.id = v.submission_id AND s.round_id = v.round_id
      WHERE v.round_id = $1 AND v.id = $2
      LIMIT 1
    `,
    [roundId, voteId]
  );

  return result.rows[0] ? mapAdminRoundVoteRow(result.rows[0]) : null;
};

type AdminRoundVoteMutationInput = {
  roundId: string;
  voteId: string;
  adminWalletAddress: string;
  reason?: string;
};

export class AdminRoundVoteConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminRoundVoteConflictError";
  }
}

const getVoteWalletForAdminMutation = async (
  client: PoolClient,
  roundId: string,
  voteId: string
) => {
  const result = await client.query(
    `
      SELECT v.wallet_address
      FROM round_votes v
      INNER JOIN rounds r ON r.id = v.round_id
      WHERE v.round_id = $1
        AND v.id = $2
        AND r.deleted_at IS NULL
      LIMIT 1
    `,
    [roundId, voteId]
  );

  return result.rows[0]?.wallet_address as string | undefined;
};

const insertRoundVoteAdminAudit = async ({
  client,
  roundId,
  voteId,
  adminWalletAddress,
  action,
  before,
  after,
  reason,
}: AdminRoundVoteMutationInput & {
  client: PoolClient;
  action: "update" | "delete";
  before: AdminRoundVote;
  after: AdminRoundVote | null;
}) => {
  await client.query(
    `
      INSERT INTO round_vote_admin_audit (
        id,
        round_id,
        vote_id,
        admin_wallet_address,
        action,
        before_state,
        after_state,
        reason
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8)
    `,
    [
      randomUUID(),
      roundId,
      voteId,
      adminWalletAddress,
      action,
      JSON.stringify(before),
      after ? JSON.stringify(after) : null,
      reason?.trim() || "",
    ]
  );
};

export const updateAdminRoundVote = async ({
  roundId,
  voteId,
  submissionId,
  voteCount,
  adminWalletAddress,
  reason,
}: AdminRoundVoteMutationInput & {
  submissionId: string;
  voteCount: number;
}) => {
  await ensureTables();
  if (!Number.isInteger(voteCount) || voteCount < 1) {
    throw new Error("Vote count must be a positive integer.");
  }
  const targetSubmissionId = submissionId.trim();
  if (!targetSubmissionId) {
    throw new Error("Selected submission is required.");
  }

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const walletAddress = await getVoteWalletForAdminMutation(
      client,
      roundId,
      voteId
    );
    if (!walletAddress) {
      await client.query("ROLLBACK");
      return null;
    }

    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      `${roundId}:${walletAddress.toLowerCase()}`,
    ]);
    const before = await getAdminRoundVote(roundId, voteId, client);
    if (!before) {
      await client.query("ROLLBACK");
      return null;
    }

    const submissionResult = await client.query(
      `
        SELECT id
        FROM round_submissions
        WHERE round_id = $1 AND id = $2 AND deleted_at IS NULL
        LIMIT 1
      `,
      [roundId, targetSubmissionId]
    );
    if (!submissionResult.rows[0]) {
      throw new Error("Selected submission is not available in this round.");
    }

    if (targetSubmissionId !== before.submissionId) {
      const conflictingVote = await client.query(
        `
          SELECT id
          FROM round_votes
          WHERE round_id = $1
            AND submission_id = $2
            AND lower(wallet_address) = lower($3)
            AND id <> $4
          LIMIT 1
        `,
        [roundId, targetSubmissionId, walletAddress, voteId]
      );
      if (conflictingVote.rows[0]) {
        throw new AdminRoundVoteConflictError(
          "This voter already has a vote allocation for that submission. Edit or delete that allocation first."
        );
      }
    }

    await client.query(
      `
        UPDATE round_votes
        SET submission_id = $3,
          vote_count = $4,
          updated_at = now()
        WHERE round_id = $1 AND id = $2
      `,
      [roundId, voteId, targetSubmissionId, voteCount]
    );
    const after = await getAdminRoundVote(roundId, voteId, client);
    if (!after) throw new Error("Unable to reload updated vote.");

    await insertRoundVoteAdminAudit({
      client,
      roundId,
      voteId,
      adminWalletAddress,
      action: "update",
      before,
      after,
      reason,
    });
    await client.query("COMMIT");
    return after;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const removeAdminRoundVote = async ({
  roundId,
  voteId,
  adminWalletAddress,
  reason,
}: AdminRoundVoteMutationInput) => {
  await ensureTables();
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");
    const walletAddress = await getVoteWalletForAdminMutation(
      client,
      roundId,
      voteId
    );
    if (!walletAddress) {
      await client.query("ROLLBACK");
      return null;
    }

    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      `${roundId}:${walletAddress.toLowerCase()}`,
    ]);
    const before = await getAdminRoundVote(roundId, voteId, client);
    if (!before) {
      await client.query("ROLLBACK");
      return null;
    }

    const deleted = await client.query(
      `DELETE FROM round_votes WHERE round_id = $1 AND id = $2 RETURNING id`,
      [roundId, voteId]
    );
    if (!deleted.rows[0]) throw new Error("Unable to delete vote.");

    await insertRoundVoteAdminAudit({
      client,
      roundId,
      voteId,
      adminWalletAddress,
      action: "delete",
      before,
      after: null,
      reason,
    });
    await client.query("COMMIT");
    return before;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const listRoundSubmissionVotes = async ({
  roundId,
  submissionId,
}: {
  roundId: string;
  submissionId: string;
}) => {
  await ensureTables();

  const result = await getPool().query(
    `
      SELECT
        v.id,
        v.wallet_address,
        v.submission_id,
        s.title AS submission_title,
        v.vote_count,
        v.created_at,
        v.updated_at
      FROM round_votes v
      INNER JOIN round_submissions s ON s.id = v.submission_id
      WHERE v.round_id = $1
        AND v.submission_id = $2
        AND s.round_id = $1
        AND s.status = 'approved'
        AND s.deleted_at IS NULL
      ORDER BY v.vote_count DESC, v.updated_at DESC, v.created_at DESC
    `,
    [roundId, submissionId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    walletAddress: row.wallet_address,
    submissionId: row.submission_id,
    submissionTitle: row.submission_title,
    voteCount: Number(row.vote_count || 0),
    createdAt: formatDate(row.created_at) || "",
    updatedAt: formatDate(row.updated_at) || "",
  })) as RoundVoteActivity[];
};

export const listPublicRoundActivity = async (
  limit = 100
): Promise<PublicRoundActivity> => {
  await ensureTables();

  const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 100));
  const [submissionResult, voteResult] = await Promise.all([
    getPool().query(
      `
        SELECT
          ${submissionSelectFields},
          r.slug AS round_slug,
          r.title AS round_title
        FROM round_submissions s
        INNER JOIN rounds r ON r.id = s.round_id
        ${voteTotalsJoin}
        ${winnersJoin}
        WHERE s.deleted_at IS NULL
          AND s.status = 'approved'
          AND r.deleted_at IS NULL
          AND r.status = 'published'
          AND r.active = true
        ORDER BY s.created_at DESC, s.id ASC
        LIMIT $1
      `,
      [safeLimit]
    ),
    getPool().query(
      `
        SELECT
          v.id,
          v.round_id,
          v.wallet_address,
          v.submission_id,
          s.title AS submission_title,
          v.vote_count,
          v.created_at,
          v.updated_at,
          r.slug AS round_slug,
          r.title AS round_title
        FROM round_votes v
        INNER JOIN round_submissions s ON s.id = v.submission_id
        INNER JOIN rounds r ON r.id = v.round_id
        WHERE s.deleted_at IS NULL
          AND s.status = 'approved'
          AND r.deleted_at IS NULL
          AND r.status = 'published'
          AND r.active = true
        ORDER BY v.updated_at DESC, v.created_at DESC, v.id ASC
        LIMIT $1
      `,
      [safeLimit]
    ),
  ]);

  return {
    submissions: submissionResult.rows.map((row) => ({
      ...mapSubmission(row),
      roundSlug: row.round_slug,
      roundTitle: row.round_title,
    })),
    votes: voteResult.rows.map((row) => ({
      id: row.id,
      roundId: row.round_id,
      walletAddress: row.wallet_address,
      submissionId: row.submission_id,
      submissionTitle: row.submission_title,
      voteCount: Number(row.vote_count || 0),
      createdAt: formatDate(row.created_at) || "",
      updatedAt: formatDate(row.updated_at) || "",
      roundSlug: row.round_slug,
      roundTitle: row.round_title,
    })),
  };
};

export const listProfileRoundSubmissions = async (
  walletAddress: string
): Promise<ProfileRoundSubmission[]> => {
  await ensureTables();

  const result = await getPool().query(
    `
      SELECT
        ${submissionSelectFields},
        r.slug AS round_slug,
        r.title AS round_title
      FROM round_submissions s
      INNER JOIN rounds r ON r.id = s.round_id
      ${voteTotalsJoin}
      ${winnersJoin}
      WHERE lower(s.wallet_address) = lower($1)
        AND s.deleted_at IS NULL
        AND r.deleted_at IS NULL
        AND r.status = 'published'
        AND r.active = true
        AND (s.status = 'approved' OR w.winner_position IS NOT NULL)
      ORDER BY s.created_at DESC
      LIMIT 100
    `,
    [walletAddress]
  );

  return result.rows.map((row) => ({
    ...mapSubmission(row),
    roundSlug: row.round_slug,
    roundTitle: row.round_title,
  }));
};

export const listProfileRoundVotes = async (
  walletAddress: string
): Promise<ProfileRoundVote[]> => {
  await ensureTables();

  const result = await getPool().query(
    `
      SELECT
        v.id,
        v.round_id,
        v.wallet_address,
        v.submission_id,
        s.title AS submission_title,
        v.vote_count,
        v.created_at,
        v.updated_at,
        r.slug AS round_slug,
        r.title AS round_title
      FROM round_votes v
      INNER JOIN round_submissions s ON s.id = v.submission_id
      INNER JOIN rounds r ON r.id = v.round_id
      WHERE lower(v.wallet_address) = lower($1)
        AND s.deleted_at IS NULL
        AND s.status = 'approved'
        AND r.deleted_at IS NULL
        AND r.status = 'published'
        AND r.active = true
      ORDER BY v.updated_at DESC, v.created_at DESC
      LIMIT 100
    `,
    [walletAddress]
  );

  return result.rows.map((row) => ({
    id: row.id,
    roundId: row.round_id,
    walletAddress: row.wallet_address,
    submissionId: row.submission_id,
    submissionTitle: row.submission_title,
    voteCount: Number(row.vote_count || 0),
    createdAt: formatDate(row.created_at) || "",
    updatedAt: formatDate(row.updated_at) || "",
    roundSlug: row.round_slug,
    roundTitle: row.round_title,
  }));
};

export const createRound = async (input: RoundInput = {}) => {
  await ensureTables();

  const round = normalizeRoundInput(input);
  const validationError = validateRoundInput(round);
  if (validationError) throw new Error(validationError);
  const awardsValidationError = validateRoundAwards(
    input.awards || [],
    round.winnerCount
  );
  if (awardsValidationError) throw new Error(awardsValidationError);

  const client = await getPool().connect();

  try {
    await client.query("BEGIN");
    const id = randomUUID();
    const result = await client.query(
      `
        INSERT INTO rounds (
          id,
          slug,
          title,
          description,
          content,
          image,
          starts_at,
          submissions_open_at,
          voting_starts_at,
          voting_ends_at,
          ends_at,
            active,
            featured,
            is_trait_contest,
            trait_submissions_enabled,
            status,
          voting_strategy,
          votes_per_wallet,
          winner_count,
          max_submissions_per_wallet,
          min_title_length,
          max_title_length,
          min_description_length,
          max_description_length,
          voting_snapshot_mode,
          voting_snapshot_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
        RETURNING id
      `,
      [
        id,
        round.slug,
        round.title,
        round.description,
        round.content,
        round.image,
        round.startsAt,
        round.submissionsOpenAt,
        round.votingStartsAt,
        round.votingEndsAt,
        round.endsAt,
        round.active,
        round.featured,
        round.isTraitContest,
        round.traitSubmissionsEnabled,
        round.status,
        round.votingStrategy,
        round.votesPerWallet,
        round.winnerCount,
        round.maxSubmissionsPerWallet,
        round.minTitleLength,
        round.maxTitleLength,
        round.minDescriptionLength,
        round.maxDescriptionLength,
        round.votingSnapshotMode,
        round.votingSnapshotAt,
      ]
    );
    await replaceRoundAwards(id, input.awards || [], client);
    await client.query("COMMIT");

    const created = await getRoundById(result.rows[0].id);
    if (!created) throw new Error("Unable to create round.");
    return created;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const updateRound = async (id: string, input: RoundInput) => {
  await ensureTables();

  const current = await getRoundById(id);
  if (!current) return null;

  const round = normalizeRoundInput(input, current);
  const validationError = validateRoundInput(round);
  if (validationError) throw new Error(validationError);
  const awardsValidationError = validateRoundAwards(
    input.awards || current.awards || [],
    round.winnerCount
  );
  if (awardsValidationError) throw new Error(awardsValidationError);
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      `voting-snapshot:${id}`,
    ]);
    const lockedSnapshotResult = await client.query(
      `
        SELECT
          voting_starts_at,
          voting_snapshot_mode,
          voting_snapshot_at,
          voting_snapshot_block
        FROM rounds
        WHERE id = $1 AND deleted_at IS NULL
        FOR UPDATE
      `,
      [id]
    );
    const lockedSnapshot = lockedSnapshotResult.rows[0];
    if (
      lockedSnapshot?.voting_snapshot_block &&
      hasRoundVotingSnapshotChanged(
        {
          votingStartsAt: formatDate(lockedSnapshot.voting_starts_at) || "",
          votingSnapshotMode: isRoundVotingSnapshotMode(
            lockedSnapshot.voting_snapshot_mode
          )
            ? lockedSnapshot.voting_snapshot_mode
            : "voting_start",
          votingSnapshotAt: formatDate(lockedSnapshot.voting_snapshot_at),
        },
        round
      )
    ) {
      throw new Error(
        "Voting snapshot timing cannot change after its block is resolved."
      );
    }
    const result = await client.query(
      `
        UPDATE rounds
        SET slug = $2,
          title = $3,
          description = $4,
          content = $5,
          image = $6,
          starts_at = $7,
          submissions_open_at = $8,
          voting_starts_at = $9,
          voting_ends_at = $10,
          ends_at = $11,
          active = $12,
          featured = $13,
          is_trait_contest = $14,
          trait_submissions_enabled = $15,
          status = $16,
          voting_strategy = $17,
          votes_per_wallet = $18,
          winner_count = $19,
          max_submissions_per_wallet = $20,
          min_title_length = $21,
          max_title_length = $22,
          min_description_length = $23,
          max_description_length = $24,
          voting_snapshot_mode = $25,
          voting_snapshot_at = $26,
          updated_at = now()
        WHERE id = $1
        RETURNING id
      `,
      [
        id,
        round.slug,
        round.title,
        round.description,
        round.content,
        round.image,
        round.startsAt,
        round.submissionsOpenAt,
        round.votingStartsAt,
        round.votingEndsAt,
        round.endsAt,
        round.active,
        round.featured,
        round.isTraitContest,
        round.traitSubmissionsEnabled,
        round.status,
        round.votingStrategy,
        round.votesPerWallet,
        round.winnerCount,
        round.maxSubmissionsPerWallet,
        round.minTitleLength,
        round.maxTitleLength,
        round.minDescriptionLength,
        round.maxDescriptionLength,
        round.votingSnapshotMode,
        round.votingSnapshotAt,
      ]
    );

    if (input.awards) {
      await replaceRoundAwards(id, input.awards, client);
    }

    await client.query("COMMIT");
    return result.rows[0] ? getRoundById(id) : null;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const removeRound = async (id: string) => {
  await ensureTables();

  const current = await getRoundById(id);
  if (!current) return null;

  const result = await getPool().query(
    `
      UPDATE rounds
      SET deleted_at = now(),
        active = false,
        status = 'archived',
        updated_at = now()
      WHERE id = $1
      RETURNING id
    `,
    [id]
  );

  return result.rows[0]
    ? {
        ...current,
        active: false,
        status: "archived" as const,
        deletedAt: new Date().toISOString(),
      }
    : null;
};

export const createRoundSubmission = async (
  round: Round,
  input: RoundSubmissionInput
) => {
  await ensureTables();

  if (getRoundState(round) !== "submissions_open") {
    throw new Error("This round is not accepting submissions.");
  }

  const validationError = validateRoundSubmissionInput(round, input);
  if (validationError) throw new Error(validationError);

  const walletAddress = getAddress(String(input.walletAddress));
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      `submission:${round.id}:${walletAddress.toLowerCase()}`,
    ]);

    const existingResult = await client.query(
      `
        SELECT COUNT(*)::int AS count
        FROM round_submissions
        WHERE round_id = $1
          AND lower(wallet_address) = lower($2)
          AND deleted_at IS NULL
      `,
      [round.id, walletAddress]
    );
    const existingCount = Number(existingResult.rows[0]?.count || 0);

    if (existingCount >= round.maxSubmissionsPerWallet) {
      throw new Error(
        "This wallet has reached the submission limit for this round."
      );
    }

    const result = await client.query(
      `
        INSERT INTO round_submissions (
          id,
          round_id,
          wallet_address,
          title,
          description,
          image,
          url,
          submission_type,
          trait_id,
          trait_type,
          source,
          source_payload,
          status,
          approved_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, 'approved', now())
        RETURNING id
      `,
      [
        randomUUID(),
        round.id,
        walletAddress,
        String(input.title || "").trim(),
        String(input.description || "").trim(),
        normalizeSafeImageUrl(input.image, {
          allowInternal: true,
          allowDataImages: true,
        }),
        normalizeSafeProjectUrl(input.url, { allowInternal: true }),
        input.submissionType || "project",
        input.traitId || null,
        input.traitType || null,
        input.source || "project",
        JSON.stringify(input.sourcePayload || {}),
      ]
    );

    await client.query("COMMIT");

    const submission = await getRoundSubmission(round.id, result.rows[0].id);
    if (!submission) throw new Error("Unable to create submission.");
    return submission;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const listEligibleTraitRounds = async ({
  walletAddress,
  traitId,
}: {
  walletAddress: string;
  traitId: string;
}) => {
  await ensureTables();

  if (!isAddress(walletAddress)) {
    throw new Error("A valid connected wallet is required.");
  }

  const trait = await getNoundrySubmissionById(traitId, {
    approvedOnly: true,
  });

  if (!trait) {
    throw new Error("Trait not found or not approved.");
  }

  if (getAddress(trait.artist) !== getAddress(walletAddress)) {
    throw new Error("Connected wallet is not the trait creator.");
  }

  const result = await getPool().query(
    `
      SELECT ${roundSelectFields}
      FROM rounds r
      ${roundStatsJoin}
      WHERE r.status = 'published'
        AND r.active = true
        AND r.is_trait_contest = true
        AND r.trait_submissions_enabled = true
        AND r.deleted_at IS NULL
        AND now() >= r.submissions_open_at
        AND now() < r.voting_starts_at
        AND NOT EXISTS (
          SELECT 1
          FROM round_submissions s
          WHERE s.round_id = r.id
            AND s.trait_id = $1
            AND s.deleted_at IS NULL
        )
      ORDER BY r.featured DESC, r.submissions_open_at ASC, r.created_at DESC
    `,
    [trait.id]
  );

  return hydrateRoundsWithAwards(result.rows.map(mapRound));
};

export const createRoundTraitSubmission = async ({
  round,
  traitId,
  walletAddress,
  description,
}: {
  round: Round;
  traitId: string;
  walletAddress: string;
  description?: string;
}) => {
  await ensureTables();

  if (!round.isTraitContest || !round.traitSubmissionsEnabled) {
    throw new Error("This round is not accepting Noundry trait submissions.");
  }

  if (getRoundState(round) !== "submissions_open") {
    throw new Error("This round is not accepting submissions.");
  }

  if (round.status !== "published" || !round.active) {
    throw new Error("This round is not active.");
  }

  if (!isAddress(walletAddress)) {
    throw new Error("A valid connected wallet is required.");
  }

  const trait = await getNoundrySubmissionById(traitId, {
    approvedOnly: true,
  });

  if (!trait) {
    throw new Error("Trait not found or not approved.");
  }

  const normalizedWallet = getAddress(walletAddress);
  const normalizedArtist = getAddress(trait.artist);

  if (normalizedArtist !== normalizedWallet) {
    throw new Error("Connected wallet is not the trait creator.");
  }

  const title = fitRoundTraitText({
    value: trait.title,
    fallback: `Noundry ${trait.traitType} trait`,
    minLength: round.minTitleLength,
    maxLength: round.maxTitleLength,
  });
  const submissionDescription = fitRoundTraitText({
    value: description,
    fallback: `Noundry ${trait.traitType} trait submitted by ${normalizedArtist}.`,
    minLength: round.minDescriptionLength,
    maxLength: round.maxDescriptionLength,
  });
  const image = createTraitImageDataUri(trait);
  const url = `/noundry/traits/${trait.id}`;
  const input: RoundSubmissionInput = {
    walletAddress: normalizedWallet,
    title,
    description: submissionDescription,
    image,
    url,
    submissionType: "trait",
    traitId: trait.id,
    traitType: trait.traitType,
    source: "noundry",
    sourcePayload: trait,
  };
  const validationError = validateDerivedRoundTraitSubmission({
    traitId: trait.id,
    title,
    description: submissionDescription,
    image,
    url,
    minTitleLength: round.minTitleLength,
    maxTitleLength: round.maxTitleLength,
    minDescriptionLength: round.minDescriptionLength,
    maxDescriptionLength: round.maxDescriptionLength,
  });
  if (validationError) throw new Error(validationError);

  const client = await getPool().connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      `trait-submission:${round.id}:${trait.id}`,
    ]);
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      `submission:${round.id}:${normalizedWallet.toLowerCase()}`,
    ]);

    const duplicate = await client.query(
      `
        SELECT id
        FROM round_submissions
        WHERE round_id = $1
          AND trait_id = $2
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [round.id, trait.id]
    );

    if (duplicate.rows[0]?.id) {
      throw new Error("This trait has already been submitted to this round.");
    }

    const existingResult = await client.query(
      `
        SELECT COUNT(*)::int AS count
        FROM round_submissions
        WHERE round_id = $1
          AND lower(wallet_address) = lower($2)
          AND deleted_at IS NULL
      `,
      [round.id, normalizedWallet]
    );
    const existingCount = Number(existingResult.rows[0]?.count || 0);

    if (existingCount >= round.maxSubmissionsPerWallet) {
      throw new Error(
        "This wallet has reached the submission limit for this round."
      );
    }

    const result = await client.query(
      `
        INSERT INTO round_submissions (
          id,
          round_id,
          wallet_address,
          title,
          description,
          image,
          url,
          submission_type,
          trait_id,
          trait_type,
          source,
          source_payload,
          status,
          approved_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'trait', $8, $9, 'noundry', $10::jsonb, 'approved', now())
        RETURNING id
      `,
      [
        randomUUID(),
        round.id,
        normalizedWallet,
        input.title,
        input.description,
        input.image,
        input.url,
        trait.id,
        trait.traitType,
        JSON.stringify(trait),
      ]
    );

    await client.query("COMMIT");

    const submission = await getRoundSubmission(round.id, result.rows[0].id);
    if (!submission) throw new Error("Unable to create submission.");
    return submission;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const updateRoundSubmission = async (
  roundId: string,
  submissionId: string,
  input: RoundSubmissionInput
) => {
  await ensureTables();

  const round = await getRoundById(roundId);
  if (!round) return null;

  const currentResult = await getPool().query(
    `
      SELECT ${submissionSelectFields}
      FROM round_submissions s
      ${voteTotalsJoin}
      ${winnersJoin}
      WHERE s.round_id = $1 AND s.id = $2 AND s.deleted_at IS NULL
      LIMIT 1
    `,
    [roundId, submissionId]
  );
  const current = currentResult.rows[0]
    ? mapSubmission(currentResult.rows[0])
    : null;
  if (!current) return null;

  const merged = {
    walletAddress: input.walletAddress ?? current.walletAddress,
    title: input.title ?? current.title,
    description: input.description ?? current.description,
    image: input.image ?? current.image,
    url: input.url ?? current.url,
    submissionType: input.submissionType ?? current.submissionType,
    traitId: input.traitId ?? current.traitId,
    traitType: input.traitType ?? current.traitType,
    source: input.source ?? current.source,
    sourcePayload: input.sourcePayload ?? current.sourcePayload,
  };
  const validationError = validateRoundSubmissionInput(round, merged);
  if (validationError) throw new Error(validationError);

  const result = await getPool().query(
    `
      UPDATE round_submissions
      SET wallet_address = $3,
        title = $4,
        description = $5,
        image = $6,
        url = $7,
        submission_type = $8,
        trait_id = $9,
        trait_type = $10,
        source = $11,
        source_payload = $12::jsonb,
        updated_at = now()
      WHERE round_id = $1 AND id = $2
      RETURNING id
    `,
    [
      roundId,
      submissionId,
      getAddress(merged.walletAddress as string),
      String(merged.title || "").trim(),
      String(merged.description || "").trim(),
      normalizeSafeImageUrl(merged.image, {
        allowInternal: true,
        allowDataImages: true,
      }),
      normalizeSafeProjectUrl(merged.url, { allowInternal: true }),
      merged.submissionType || "project",
      merged.traitId || null,
      merged.traitType || null,
      merged.source || "project",
      JSON.stringify(merged.sourcePayload || {}),
    ]
  );

  return result.rows[0] ? getRoundSubmission(roundId, submissionId) : null;
};

export const getRoundSubmission = async (
  roundId: string,
  submissionId: string
) => {
  await ensureTables();

  const result = await getPool().query(
    `
      SELECT ${submissionSelectFields}
      FROM round_submissions s
      ${voteTotalsJoin}
      ${winnersJoin}
      WHERE s.round_id = $1 AND s.id = $2 AND s.deleted_at IS NULL
      LIMIT 1
    `,
    [roundId, submissionId]
  );

  return result.rows[0] ? mapSubmission(result.rows[0]) : null;
};

export const setRoundSubmissionStatus = async ({
  roundId,
  submissionId,
  status,
}: {
  roundId: string;
  submissionId: string;
  status: RoundSubmissionStatus;
}) => {
  await ensureTables();

  const statusColumn =
    status === "approved"
      ? "approved_at"
      : status === "rejected"
        ? "rejected_at"
        : status === "hidden"
          ? "hidden_at"
          : null;

  const result = await getPool().query(
    `
      UPDATE round_submissions
      SET status = $3,
        approved_at = ${statusColumn === "approved_at" ? "now()" : "approved_at"},
        rejected_at = ${statusColumn === "rejected_at" ? "now()" : "rejected_at"},
        hidden_at = ${statusColumn === "hidden_at" ? "now()" : "hidden_at"},
        updated_at = now()
      WHERE round_id = $1 AND id = $2 AND deleted_at IS NULL
      RETURNING id
    `,
    [roundId, submissionId, status]
  );

  return result.rows[0] ? getRoundSubmission(roundId, submissionId) : null;
};

export const removeRoundSubmission = async (
  roundId: string,
  submissionId: string
) => {
  await ensureTables();

  const current = await getRoundSubmission(roundId, submissionId);
  if (!current) return null;

  const result = await getPool().query(
    `
      UPDATE round_submissions
      SET deleted_at = now(),
        updated_at = now()
      WHERE round_id = $1 AND id = $2
      RETURNING id
    `,
    [roundId, submissionId]
  );

  return result.rows[0]
    ? { ...current, deletedAt: new Date().toISOString() }
    : null;
};

export const getRoundVoteUsage = async (
  roundId: string,
  walletAddress: string,
  client: Pool | PoolClient = getPool()
) => {
  await ensureTables();

  const result = await client.query(
    `
      SELECT COALESCE(SUM(vote_count), 0)::int AS used_votes
      FROM round_votes
      WHERE round_id = $1 AND lower(wallet_address) = lower($2)
    `,
    [roundId, walletAddress]
  );

  return Number(result.rows[0]?.used_votes || 0);
};

export const castRoundVotes = async ({
  round,
  walletAddress,
  votingPower,
  votes,
}: {
  round: Round;
  walletAddress: string;
  votingPower: number;
  votes: RoundVoteAllocationInput[];
}) => {
  await ensureTables();

  if (getRoundState(round) !== "voting_open") {
    throw new Error("Voting is not open for this round.");
  }

  const validationError = validateRoundVoteAllocation({
    votingPower,
    votes,
  });
  if (validationError) throw new Error(validationError);

  const normalizedWallet = getAddress(walletAddress);
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      `${round.id}:${normalizedWallet.toLowerCase()}`,
    ]);

    const submissionIds = votes.map((vote) => vote.submissionId);
    const approvedResult = await client.query(
      `
        SELECT id
        FROM round_submissions
        WHERE round_id = $1
          AND status = 'approved'
          AND deleted_at IS NULL
          AND id = ANY($2::text[])
      `,
      [round.id, submissionIds]
    );
    const approvedIds = new Set<string>(
      approvedResult.rows.map((row) => row.id)
    );

    if (approvedIds.size !== submissionIds.length) {
      throw new Error("Votes can only be cast for approved submissions.");
    }

    const usedVotes = await getRoundVoteUsage(
      round.id,
      normalizedWallet,
      client
    );
    const remainingValidationError = validateRoundVoteAllocation({
      votingPower,
      usedVotes,
      votes,
    });
    if (remainingValidationError) throw new Error(remainingValidationError);

    for (const vote of votes) {
      await client.query(
        `
          INSERT INTO round_votes (
            id,
            round_id,
            submission_id,
            wallet_address,
            vote_count
          )
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (round_id, submission_id, wallet_address)
          DO UPDATE SET
            vote_count = round_votes.vote_count + EXCLUDED.vote_count,
            updated_at = now()
        `,
        [
          randomUUID(),
          round.id,
          vote.submissionId,
          normalizedWallet,
          vote.voteCount,
        ]
      );
    }

    const totalUsedVotes = await getRoundVoteUsage(
      round.id,
      normalizedWallet,
      client
    );
    if (totalUsedVotes > votingPower) {
      throw new Error("Vote allocation exceeds available voting power.");
    }

    await client.query("COMMIT");
    return listRoundSubmissions(round.id, { publicOnly: true });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};
