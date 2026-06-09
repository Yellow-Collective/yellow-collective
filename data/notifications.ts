import { Pool } from "pg";
import { getAddress, isAddress } from "viem";
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  NOTIFICATIONS_SETTINGS_KEY,
  normalizeNotificationSettings,
  type NotificationSettings,
} from "@/utils/notifications/settings";
import type { NeynarNotificationToken } from "@/utils/notifications/neynar";
import { getTextSiteSetting, setTextSiteSetting } from "data/site-settings";

let pool: Pool | null = null;
let tableReady: Promise<void> | null = null;

export type MiniAppUserInput = {
  fid: number;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
  walletAddress?: string;
  notificationsEnabled?: boolean;
};

export type NotificationEventRecord = {
  id: string;
  eventType: string;
  sourceId: string;
  title: string;
  body: string;
  targetUrl: string;
  targetFids: number[];
  dryRun: boolean;
  response: Record<string, unknown> | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MiniAppAudienceRecord = {
  fid: number;
  username: string | null;
  displayName: string | null;
  pfpUrl: string | null;
  walletAddress: string | null;
  notificationsEnabled: boolean;
  notificationUrl: string | null;
  tokenCreatedAt: string | null;
  tokenUpdatedAt: string | null;
  lastSyncedAt: string | null;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
};

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
          CREATE TABLE IF NOT EXISTS notification_events (
            id text PRIMARY KEY,
            event_type text NOT NULL,
            source_id text NOT NULL,
            title text NOT NULL,
            body text NOT NULL,
            target_url text NOT NULL,
            target_fids integer[] NOT NULL DEFAULT '{}',
            dry_run boolean NOT NULL DEFAULT false,
            response jsonb,
            sent_at timestamptz,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
            CONSTRAINT notification_events_unique_source UNIQUE (event_type, source_id)
          );

          CREATE TABLE IF NOT EXISTS miniapp_users (
            fid integer PRIMARY KEY,
            username text,
            display_name text,
            pfp_url text,
            wallet_address text,
            notification_url text,
            notification_token_created_at timestamptz,
            notification_token_updated_at timestamptz,
            last_synced_at timestamptz,
            notifications_enabled boolean NOT NULL DEFAULT false,
            last_seen_at timestamptz NOT NULL DEFAULT now(),
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
          );

          CREATE INDEX IF NOT EXISTS notification_events_event_type_idx
            ON notification_events(event_type);
          CREATE INDEX IF NOT EXISTS notification_events_sent_at_idx
            ON notification_events(sent_at);
        `
      )
      .then(() =>
        getPool().query(`
          ALTER TABLE notification_events
            ADD COLUMN IF NOT EXISTS target_fids integer[] NOT NULL DEFAULT '{}'
        `)
      )
      .then(() =>
        getPool().query(`
          ALTER TABLE miniapp_users
            ADD COLUMN IF NOT EXISTS notification_url text,
            ADD COLUMN IF NOT EXISTS notification_token_created_at timestamptz,
            ADD COLUMN IF NOT EXISTS notification_token_updated_at timestamptz,
            ADD COLUMN IF NOT EXISTS last_synced_at timestamptz
        `)
      )
      .then(() => undefined);
  }

  return tableReady;
};

const mapNotificationEvent = (row: any): NotificationEventRecord => ({
  id: row.id,
  eventType: row.event_type,
  sourceId: row.source_id,
  title: row.title,
  body: row.body,
  targetUrl: row.target_url,
  targetFids: Array.isArray(row.target_fids)
    ? row.target_fids.map((fid: unknown) => Number(fid)).filter(Boolean)
    : [],
  dryRun: Boolean(row.dry_run),
  response: row.response || null,
  sentAt: row.sent_at ? new Date(row.sent_at).toISOString() : null,
  createdAt: new Date(row.created_at).toISOString(),
  updatedAt: new Date(row.updated_at).toISOString(),
});

const mapMiniAppAudienceRecord = (row: any): MiniAppAudienceRecord => ({
  fid: Number(row.fid),
  username: row.username || null,
  displayName: row.display_name || null,
  pfpUrl: row.pfp_url || null,
  walletAddress: row.wallet_address || null,
  notificationsEnabled: Boolean(row.notifications_enabled),
  notificationUrl: row.notification_url || null,
  tokenCreatedAt: row.notification_token_created_at
    ? new Date(row.notification_token_created_at).toISOString()
    : null,
  tokenUpdatedAt: row.notification_token_updated_at
    ? new Date(row.notification_token_updated_at).toISOString()
    : null,
  lastSyncedAt: row.last_synced_at
    ? new Date(row.last_synced_at).toISOString()
    : null,
  lastSeenAt: new Date(row.last_seen_at).toISOString(),
  createdAt: new Date(row.created_at).toISOString(),
  updatedAt: new Date(row.updated_at).toISOString(),
});

export const getNotificationSettings = async () => {
  const raw = await getTextSiteSetting(NOTIFICATIONS_SETTINGS_KEY, null);
  if (!raw) return DEFAULT_NOTIFICATION_SETTINGS;

  try {
    return normalizeNotificationSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_NOTIFICATION_SETTINGS;
  }
};

export const setNotificationSettings = async (
  settings: NotificationSettings
) => {
  const normalized = normalizeNotificationSettings(settings);
  await setTextSiteSetting(
    NOTIFICATIONS_SETTINGS_KEY,
    JSON.stringify(normalized)
  );
  return normalized;
};

export const upsertMiniAppUser = async (input: MiniAppUserInput) => {
  await ensureTables();

  const fid = Number(input.fid);
  if (!Number.isInteger(fid) || fid <= 0) {
    throw new Error("A valid Farcaster FID is required.");
  }

  const walletAddress =
    input.walletAddress && isAddress(input.walletAddress)
      ? getAddress(input.walletAddress)
      : null;

  await getPool().query(
    `
      INSERT INTO miniapp_users (
        fid,
        username,
        display_name,
        pfp_url,
        wallet_address,
        notifications_enabled,
        last_seen_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, now(), now())
      ON CONFLICT (fid)
      DO UPDATE SET
        username = EXCLUDED.username,
        display_name = EXCLUDED.display_name,
        pfp_url = EXCLUDED.pfp_url,
        wallet_address = COALESCE(EXCLUDED.wallet_address, miniapp_users.wallet_address),
        notifications_enabled = EXCLUDED.notifications_enabled,
        last_seen_at = now(),
        updated_at = now()
    `,
    [
      fid,
      input.username || null,
      input.displayName || null,
      input.pfpUrl || null,
      walletAddress,
      Boolean(input.notificationsEnabled),
    ]
  );

  return { fid };
};

export const syncMiniAppNotificationAudience = async (
  tokens: NeynarNotificationToken[]
) => {
  await ensureTables();
  const pool = getPool();

  await pool.query("BEGIN");
  try {
    await pool.query(`
      UPDATE miniapp_users
      SET notifications_enabled = false,
        updated_at = now()
    `);

    for (const token of tokens) {
      await pool.query(
        `
          INSERT INTO miniapp_users (
            fid,
            notifications_enabled,
            notification_url,
            notification_token_created_at,
            notification_token_updated_at,
            last_seen_at,
            last_synced_at,
            updated_at
          )
          VALUES ($1, true, $2, $3, $4, now(), now(), now())
          ON CONFLICT (fid)
          DO UPDATE SET
            notifications_enabled = true,
            notification_url = EXCLUDED.notification_url,
            notification_token_created_at = EXCLUDED.notification_token_created_at,
            notification_token_updated_at = EXCLUDED.notification_token_updated_at,
            last_synced_at = now(),
            updated_at = now()
        `,
        [
          token.fid,
          token.url,
          token.createdAt ? new Date(token.createdAt) : null,
          token.updatedAt ? new Date(token.updatedAt) : null,
        ]
      );
    }

    await pool.query("COMMIT");
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }

  return listMiniAppNotificationAudience();
};

export const listMiniAppNotificationAudience = async (limit = 100) => {
  await ensureTables();
  const result = await getPool().query(
    `
      SELECT *
      FROM miniapp_users
      ORDER BY notifications_enabled DESC,
        COALESCE(notification_token_updated_at, last_synced_at, last_seen_at) DESC
      LIMIT $1
    `,
    [Math.min(Math.max(Number(limit) || 100, 1), 200)]
  );

  return result.rows.map(mapMiniAppAudienceRecord);
};

export const getNotificationEvent = async (
  eventType: string,
  sourceId: string
) => {
  await ensureTables();
  const result = await getPool().query(
    `
      SELECT *
      FROM notification_events
      WHERE event_type = $1 AND source_id = $2
      LIMIT 1
    `,
    [eventType, sourceId]
  );

  return result.rows[0] ? mapNotificationEvent(result.rows[0]) : null;
};

export const upsertNotificationEventAttempt = async ({
  id,
  eventType,
  sourceId,
  title,
  body,
  targetUrl,
  targetFids = [],
  dryRun,
}: {
  id: string;
  eventType: string;
  sourceId: string;
  title: string;
  body: string;
  targetUrl: string;
  targetFids?: number[];
  dryRun: boolean;
}) => {
  await ensureTables();
  await getPool().query(
    `
      INSERT INTO notification_events (
        id,
        event_type,
        source_id,
        title,
        body,
        target_url,
        target_fids,
        dry_run,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::integer[], $8, now())
      ON CONFLICT (event_type, source_id)
      DO NOTHING
    `,
    [id, eventType, sourceId, title, body, targetUrl, targetFids, dryRun]
  );
};

export const markNotificationEventSent = async ({
  eventType,
  sourceId,
  response,
}: {
  eventType: string;
  sourceId: string;
  response: Record<string, unknown>;
}) => {
  await ensureTables();
  await getPool().query(
    `
      UPDATE notification_events
      SET response = $3::jsonb,
        sent_at = now(),
        updated_at = now()
      WHERE event_type = $1 AND source_id = $2
    `,
    [eventType, sourceId, JSON.stringify(response)]
  );
};

export const listNotificationEvents = async (limit = 50) => {
  await ensureTables();
  const result = await getPool().query(
    `
      SELECT *
      FROM notification_events
      ORDER BY COALESCE(sent_at, updated_at) DESC
      LIMIT $1
    `,
    [Math.min(Math.max(Number(limit) || 50, 1), 100)]
  );

  return result.rows.map(mapNotificationEvent);
};
