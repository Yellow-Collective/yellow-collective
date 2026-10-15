import { attachDatabasePool } from "@vercel/functions";
import { Pool } from "pg";
import { getAddress, isAddress } from "viem";
import { getDummyGalleryCoins } from "data/dummy-content";

export type GalleryCoin = {
  address: string;
  slug: string;
  title: string;
  coinName: string;
  symbol: string;
  description: string;
  mediaUrl: string;
  imageUrl: string;
  ownerAddress: string;
  payoutRecipient: string;
  hidden: boolean;
  transactionHash?: string;
  creatorAddress?: string;
  createdAt?: string;
  roundSlug?: string;
};

export type GalleryCoinInput = {
  address: string;
  title: string;
  coinName: string;
  symbol: string;
  description: string;
  mediaUrl: string;
  imageUrl?: string;
  ownerAddress: string;
  payoutRecipient: string;
  hidden?: boolean;
  transactionHash?: string;
  creatorAddress?: string;
};

export const galleryCoins: GalleryCoin[] = [];

let pool: Pool | null = null;
let tableReady: Promise<void> | null = null;
const GALLERY_PUBLIC_SETTING_KEY = "gallery_public_enabled";

const getConnectionString = () =>
  process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;

const getPool = () => {
  const connectionString = getConnectionString();
  if (!connectionString) return null;

  if (!pool) {
    pool = new Pool({
      connectionString,
      connectionTimeoutMillis: 8000,
      idleTimeoutMillis: 5000,
      max: 2,
      ssl: connectionString.includes("railway.internal")
        ? undefined
        : { rejectUnauthorized: false },
    });
    if (process.env.VERCEL) attachDatabasePool(pool);
  }

  return pool;
};

const ensureTable = async () => {
  const coinPool = getPool();
  if (!coinPool) return;

  if (!tableReady) {
    tableReady = coinPool
      .query(
        `
          CREATE TABLE IF NOT EXISTS content_coin_gallery_records (
            address text PRIMARY KEY,
            slug text NOT NULL,
            title text NOT NULL,
            coin_name text NOT NULL,
            symbol text NOT NULL,
            description text NOT NULL,
            media_url text NOT NULL,
            image_url text NOT NULL DEFAULT '',
            owner_address text NOT NULL,
            payout_recipient text NOT NULL,
            hidden boolean NOT NULL DEFAULT false,
            transaction_hash text,
            creator_address text,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
          )
        `
      )
      .then(() =>
        coinPool.query(
          `
            CREATE TABLE IF NOT EXISTS site_settings (
              setting_key text PRIMARY KEY,
              setting_value text NOT NULL,
              updated_at timestamptz NOT NULL DEFAULT now()
            )
          `
        )
      )
      .then(() =>
        coinPool.query(`
          ALTER TABLE content_coin_gallery_records
            ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false
        `)
      )
      .then(() =>
        coinPool.query(`
          CREATE INDEX IF NOT EXISTS content_coin_gallery_records_owner_idx
            ON content_coin_gallery_records (lower(owner_address))
        `)
      )
      .then(() =>
        coinPool.query(
          `
            INSERT INTO site_settings (setting_key, setting_value)
            VALUES ($1, 'true')
            ON CONFLICT (setting_key) DO NOTHING
          `,
          [GALLERY_PUBLIC_SETTING_KEY]
        )
      )
      .then(() => undefined)
      .catch((error) => {
        tableReady = null;
        throw error;
      });
  }

  return tableReady;
};

const isSafeContentUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("ipfs://")) return trimmed.length > "ipfs://".length;

  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
};

const createSlug = (title: string, address: string) => {
  const base =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "content-coin";

  return `${base}-${address.slice(2, 8).toLowerCase()}`;
};

const mapStoredCoin = (row: Record<string, any>): GalleryCoin => ({
  address: getAddress(row.address),
  slug: row.slug,
  title: row.title,
  coinName: row.coin_name,
  symbol: row.symbol,
  description: row.description,
  mediaUrl: row.media_url,
  imageUrl: row.image_url || "",
  ownerAddress: getAddress(row.owner_address),
  payoutRecipient: getAddress(row.payout_recipient),
  hidden: Boolean(row.hidden),
  transactionHash: row.transaction_hash || undefined,
  creatorAddress:
    row.creator_address && isAddress(row.creator_address)
      ? getAddress(row.creator_address)
      : undefined,
  createdAt:
    row.created_at instanceof Date
      ? row.created_at.toISOString()
      : String(row.created_at || ""),
});

const listStoredGalleryCoins = async () => {
  const coinPool = getPool();
  if (!coinPool) return [];

  await ensureTable();
  const result = await coinPool.query(
    `
      SELECT *
      FROM content_coin_gallery_records
      ORDER BY created_at DESC
    `
  );

  return result.rows.map(mapStoredCoin);
};

export const validateGalleryCoinInput = (input: Partial<GalleryCoinInput>) => {
  if (!input.address || !isAddress(input.address)) {
    throw new Error("Coin address must be a valid address.");
  }
  if (!input.ownerAddress || !isAddress(input.ownerAddress)) {
    throw new Error("Owner address must be a valid address.");
  }
  if (!input.payoutRecipient || !isAddress(input.payoutRecipient)) {
    throw new Error("Payout recipient must be a valid address.");
  }
  if (!input.title?.trim()) throw new Error("Content title is required.");
  if (!input.coinName?.trim()) throw new Error("Coin name is required.");
  if (!/^[A-Z0-9]{1,10}$/.test(input.symbol?.trim() || "")) {
    throw new Error("Coin symbol must use 1-10 uppercase letters or numbers.");
  }
  if (!input.description?.trim()) {
    throw new Error("Content description is required.");
  }
  if (!input.mediaUrl || !isSafeContentUrl(input.mediaUrl)) {
    throw new Error("Media URL must be an http(s) or ipfs:// URL.");
  }
  if (input.imageUrl?.trim() && !isSafeContentUrl(input.imageUrl)) {
    throw new Error("Image URL must be an http(s) or ipfs:// URL.");
  }
  if (
    input.transactionHash &&
    !/^0x[a-fA-F0-9]{64}$/.test(input.transactionHash)
  ) {
    throw new Error("Transaction hash must be a valid hash.");
  }
  if (input.creatorAddress && !isAddress(input.creatorAddress)) {
    throw new Error("Creator address must be a valid address.");
  }
};

export const saveGalleryCoin = async (input: GalleryCoinInput) => {
  validateGalleryCoinInput(input);
  const coinPool = getPool();
  if (!coinPool) {
    throw new Error("DATABASE_PUBLIC_URL or DATABASE_URL is required.");
  }

  await ensureTable();

  const address = getAddress(input.address);
  const title = input.title.trim().slice(0, 160);
  const coinName = input.coinName.trim().slice(0, 100);
  const symbol = input.symbol.trim().toUpperCase().slice(0, 10);
  const description = input.description.trim().slice(0, 1000);
  const mediaUrl = input.mediaUrl.trim();
  const imageUrl = input.imageUrl?.trim() || "";
  const ownerAddress = getAddress(input.ownerAddress);
  const payoutRecipient = getAddress(input.payoutRecipient);
  const hidden = Boolean(input.hidden);
  const creatorAddress =
    input.creatorAddress && isAddress(input.creatorAddress)
      ? getAddress(input.creatorAddress)
      : null;

  const result = await coinPool.query(
    `
      INSERT INTO content_coin_gallery_records (
        address,
        slug,
        title,
        coin_name,
        symbol,
        description,
        media_url,
        image_url,
        owner_address,
        payout_recipient,
        hidden,
        transaction_hash,
        creator_address
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (address) DO UPDATE
      SET title = EXCLUDED.title,
          coin_name = EXCLUDED.coin_name,
          symbol = EXCLUDED.symbol,
          description = EXCLUDED.description,
          media_url = EXCLUDED.media_url,
          image_url = EXCLUDED.image_url,
          owner_address = EXCLUDED.owner_address,
          payout_recipient = EXCLUDED.payout_recipient,
          hidden = EXCLUDED.hidden,
          transaction_hash = EXCLUDED.transaction_hash,
          creator_address = EXCLUDED.creator_address,
          updated_at = now()
      RETURNING *
    `,
    [
      address,
      createSlug(title, address),
      title,
      coinName,
      symbol,
      description,
      mediaUrl,
      imageUrl,
      ownerAddress,
      payoutRecipient,
      hidden,
      input.transactionHash || null,
      creatorAddress,
    ]
  );

  return mapStoredCoin(result.rows[0]);
};

export const listGalleryCoins = async () => {
  try {
    const storedCoins = await listStoredGalleryCoins();
    const storedAddresses = new Set(
      storedCoins.map((coin) => coin.address.toLowerCase())
    );

    return [
      ...storedCoins,
      ...galleryCoins.filter(
        (coin) => !storedAddresses.has(coin.address.toLowerCase())
      ),
    ];
  } catch (error) {
    console.warn("Unable to load stored gallery coins", error);
    return galleryCoins;
  }
};

export const listPublicGalleryCoins = async () => {
  const galleryPublicEnabled = await getGalleryPublicEnabled();
  if (!galleryPublicEnabled) return [];

  const [coins, dummyCoins] = await Promise.all([
    listGalleryCoins(),
    getDummyGalleryCoins(),
  ]);

  const coinAddresses = new Set(
    coins.map((coin) => coin.address.toLowerCase())
  );
  return [
    ...dummyCoins.filter(
      (coin) => !coin.hidden && !coinAddresses.has(coin.address.toLowerCase())
    ),
    ...coins.filter((coin) => !coin.hidden),
  ];
};

export const getGalleryCoinByAddressOrSlug = async (value: string) => {
  const normalized = value.toLowerCase();
  const coins = await listGalleryCoins();

  return (
    coins.find(
      (coin) =>
        coin.address.toLowerCase() === normalized ||
        coin.slug.toLowerCase() === normalized
    ) || null
  );
};

export const getPublicGalleryCoinByAddressOrSlug = async (value: string) => {
  const normalized = value.toLowerCase();
  const coins = await listPublicGalleryCoins();

  return (
    coins.find(
      (coin) =>
        coin.address.toLowerCase() === normalized ||
        coin.slug.toLowerCase() === normalized
    ) || null
  );
};

export const listGalleryCoinsByOwner = async (ownerAddress: string) => {
  const normalizedOwner = ownerAddress.toLowerCase();
  const coins = await listGalleryCoins();

  return coins.filter(
    (coin) => coin.ownerAddress.toLowerCase() === normalizedOwner
  );
};

export const listPublicGalleryCoinsByOwner = async (ownerAddress: string) => {
  const normalizedOwner = ownerAddress.toLowerCase();
  const coins = await listPublicGalleryCoins();

  return coins.filter(
    (coin) => coin.ownerAddress.toLowerCase() === normalizedOwner
  );
};

export const getGalleryPublicEnabled = async () => {
  const coinPool = getPool();
  if (!coinPool) return true;

  await ensureTable();
  const result = await coinPool.query(
    `
      SELECT setting_value
      FROM site_settings
      WHERE setting_key = $1
      LIMIT 1
    `,
    [GALLERY_PUBLIC_SETTING_KEY]
  );

  return result.rows[0]?.setting_value !== "false";
};

export const setGalleryPublicEnabled = async (enabled: boolean) => {
  const coinPool = getPool();
  if (!coinPool) {
    throw new Error("DATABASE_PUBLIC_URL or DATABASE_URL is required.");
  }

  await ensureTable();
  const result = await coinPool.query(
    `
      INSERT INTO site_settings (setting_key, setting_value, updated_at)
      VALUES ($1, $2, now())
      ON CONFLICT (setting_key)
      DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = now()
      RETURNING setting_value
    `,
    [GALLERY_PUBLIC_SETTING_KEY, enabled ? "true" : "false"]
  );

  return result.rows[0]?.setting_value === "true";
};

export const setGalleryCoinHidden = async ({
  address,
  hidden,
}: {
  address: string;
  hidden: boolean;
}) => {
  if (!isAddress(address)) throw new Error("Coin address must be valid.");

  const coin = await getGalleryCoinByAddressOrSlug(address);
  if (!coin) return null;

  return saveGalleryCoin({
    ...coin,
    hidden,
  });
};
