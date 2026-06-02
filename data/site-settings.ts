import { Pool } from "pg";

let pool: Pool | null = null;
let tableReady: Promise<void> | null = null;

const getConnectionString = () =>
  process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;

const getPool = () => {
  const connectionString = getConnectionString();
  if (!connectionString) return null;

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

const ensureTable = async () => {
  const settingsPool = getPool();
  if (!settingsPool) return;

  if (!tableReady) {
    tableReady = settingsPool
      .query(
        `
          CREATE TABLE IF NOT EXISTS site_settings (
            setting_key text PRIMARY KEY,
            setting_value text NOT NULL,
            updated_at timestamptz NOT NULL DEFAULT now()
          )
        `
      )
      .then(() => undefined);
  }

  return tableReady;
};

export const getBooleanSiteSetting = async (
  key: string,
  defaultValue = false
) => {
  const settingsPool = getPool();
  if (!settingsPool) return defaultValue;

  await ensureTable();
  const result = await settingsPool.query(
    `
      SELECT setting_value
      FROM site_settings
      WHERE setting_key = $1
      LIMIT 1
    `,
    [key]
  );

  const settingValue = result.rows[0]?.setting_value;
  if (settingValue === undefined) return defaultValue;

  return settingValue === "true";
};

export const getTextSiteSetting = async (
  key: string,
  defaultValue: string | null = null
) => {
  const settingsPool = getPool();
  if (!settingsPool) return defaultValue;

  await ensureTable();
  const result = await settingsPool.query(
    `
      SELECT setting_value
      FROM site_settings
      WHERE setting_key = $1
      LIMIT 1
    `,
    [key]
  );

  return result.rows[0]?.setting_value ?? defaultValue;
};

export const setBooleanSiteSetting = async (key: string, enabled: boolean) => {
  const settingsPool = getPool();
  if (!settingsPool) {
    throw new Error("DATABASE_PUBLIC_URL or DATABASE_URL is required.");
  }

  await ensureTable();
  const result = await settingsPool.query(
    `
      INSERT INTO site_settings (setting_key, setting_value, updated_at)
      VALUES ($1, $2, now())
      ON CONFLICT (setting_key)
      DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = now()
      RETURNING setting_value
    `,
    [key, enabled ? "true" : "false"]
  );

  return result.rows[0]?.setting_value === "true";
};

export const setTextSiteSetting = async (key: string, value: string) => {
  const settingsPool = getPool();
  if (!settingsPool) {
    throw new Error("DATABASE_PUBLIC_URL or DATABASE_URL is required.");
  }

  await ensureTable();
  const result = await settingsPool.query(
    `
      INSERT INTO site_settings (setting_key, setting_value, updated_at)
      VALUES ($1, $2, now())
      ON CONFLICT (setting_key)
      DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = now()
      RETURNING setting_value
    `,
    [key, value]
  );

  return result.rows[0]?.setting_value as string;
};
