import { randomUUID } from "crypto";
import { Pool } from "pg";

export type NoundrySubmissionStatus = "pending" | "approved" | "removed";

export type NoundrySubmission = {
  id: string;
  title: string;
  artist: string;
  traitType: string;
  pixels: string[];
  selectedTraits: Record<string, string>;
  previewTraits: Record<string, string>;
  status: NoundrySubmissionStatus;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  removedAt?: string;
};

export type CreateNoundrySubmissionInput = {
  title: string;
  artist: string;
  traitType: string;
  pixels: string[];
  selectedTraits: Record<string, string>;
  previewTraits: Record<string, string>;
};

export type UpdateNoundrySubmissionInput =
  Partial<CreateNoundrySubmissionInput>;

export type UpdateNoundrySubmissionMetadataInput = Pick<
  CreateNoundrySubmissionInput,
  "title" | "traitType"
>;

const GRID_PIXEL_COUNT = 32 * 32;
const MAX_TITLE_LENGTH = 80;
const MAX_TRAIT_TYPE_LENGTH = 64;
const WALLET_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

let pool: Pool | null = null;
let tableReady: Promise<void> | null = null;

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

const ensureTable = async () => {
  if (!tableReady) {
    tableReady = getPool()
      .query(
        `
          CREATE TABLE IF NOT EXISTS noundry_submissions (
            id text PRIMARY KEY,
            title text NOT NULL,
            artist text NOT NULL,
            trait_type text NOT NULL,
            pixels jsonb NOT NULL,
            selected_traits jsonb NOT NULL,
            preview_traits jsonb NOT NULL,
            status text NOT NULL DEFAULT 'approved',
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
            approved_at timestamptz,
            removed_at timestamptz
          )
        `
      )
      .then(() =>
        getPool().query(`
          ALTER TABLE noundry_submissions
            ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved',
            ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
            ADD COLUMN IF NOT EXISTS approved_at timestamptz,
            ADD COLUMN IF NOT EXISTS removed_at timestamptz
        `)
      )
      .then(() => undefined);
  }

  return tableReady;
};

const isStringRecord = (value: unknown): value is Record<string, string> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  return Object.values(value).every((entry) => typeof entry === "string");
};

export const validateNoundrySubmission = (
  input: Partial<CreateNoundrySubmissionInput>
) => {
  const metadataValidationError = validateNoundryAuthorMetadata(input);
  if (metadataValidationError) return metadataValidationError;

  if (!input.artist || !WALLET_ADDRESS_PATTERN.test(input.artist)) {
    return "A connected wallet address is required.";
  }

  if (
    !Array.isArray(input.pixels) ||
    input.pixels.length !== GRID_PIXEL_COUNT ||
    input.pixels.some((pixel) => typeof pixel !== "string")
  ) {
    return "Trait pixels are invalid.";
  }

  if (!isStringRecord(input.selectedTraits)) {
    return "Selected traits are invalid.";
  }

  if (!isStringRecord(input.previewTraits)) {
    return "Preview traits are invalid.";
  }

  return undefined;
};

export const validateNoundryAuthorMetadata = (
  input: Partial<UpdateNoundrySubmissionMetadataInput>
) => {
  if (typeof input.title !== "string" || !input.title.trim()) {
    return "A trait name is required.";
  }

  if (input.title.trim().length > MAX_TITLE_LENGTH) {
    return `Trait name must be ${MAX_TITLE_LENGTH} characters or fewer.`;
  }

  if (typeof input.traitType !== "string" || !input.traitType.trim()) {
    return "A trait type is required.";
  }

  if (input.traitType.trim().length > MAX_TRAIT_TYPE_LENGTH) {
    return "Trait type is invalid.";
  }

  return undefined;
};

const parseJson = <T>(value: T | string): T =>
  typeof value === "string" ? JSON.parse(value) : value;

const formatDate = (value?: Date | string | null) =>
  value
    ? value instanceof Date
      ? value.toISOString()
      : new Date(value).toISOString()
    : undefined;

const selectFields = `
  id,
  title,
  artist,
  trait_type,
  pixels,
  selected_traits,
  preview_traits,
  status,
  created_at,
  updated_at,
  approved_at,
  removed_at
`;

const mapSubmission = (row: {
  id: string;
  title: string;
  artist: string;
  trait_type: string;
  pixels: string[] | string;
  selected_traits: Record<string, string> | string;
  preview_traits: Record<string, string> | string;
  status: NoundrySubmissionStatus;
  created_at: Date | string;
  updated_at: Date | string;
  approved_at?: Date | string | null;
  removed_at?: Date | string | null;
}): NoundrySubmission => ({
  id: row.id,
  title: row.title,
  artist: row.artist,
  traitType: row.trait_type,
  pixels: parseJson<string[]>(row.pixels),
  selectedTraits: parseJson<Record<string, string>>(row.selected_traits),
  previewTraits: parseJson<Record<string, string>>(row.preview_traits),
  status: row.status,
  createdAt: formatDate(row.created_at) ?? "",
  updatedAt: formatDate(row.updated_at) ?? "",
  approvedAt: formatDate(row.approved_at),
  removedAt: formatDate(row.removed_at),
});

export const listApprovedNoundrySubmissions = async () => {
  await ensureTable();

  const result = await getPool().query(
    `
      SELECT ${selectFields}
      FROM noundry_submissions
      WHERE status = 'approved'
      ORDER BY created_at DESC
      LIMIT 100
    `
  );

  return result.rows.map(mapSubmission);
};

export const countApprovedNoundrySubmissionsByArtists = async (
  artists: string[]
) => {
  await ensureTable();

  const normalizedArtists = Array.from(
    new Set(
      artists
        .filter((artist) => WALLET_ADDRESS_PATTERN.test(artist))
        .map((artist) => artist.toLowerCase())
    )
  );

  if (normalizedArtists.length === 0) return new Map<string, number>();

  const result = await getPool().query(
    `
      SELECT lower(artist) as artist, count(*)::int as count
      FROM noundry_submissions
      WHERE status = 'approved'
        AND lower(artist) = ANY($1::text[])
      GROUP BY lower(artist)
    `,
    [normalizedArtists]
  );

  return new Map<string, number>(
    result.rows.map((row) => [String(row.artist), Number(row.count || 0)])
  );
};

export const listNoundrySubmissions = listApprovedNoundrySubmissions;

export const getNoundrySubmissionById = async (
  id: string,
  { approvedOnly = false }: { approvedOnly?: boolean } = {}
) => {
  await ensureTable();

  const result = await getPool().query(
    `
      SELECT ${selectFields}
      FROM noundry_submissions
      WHERE id = $1
        ${approvedOnly ? "AND status = 'approved'" : ""}
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] ? mapSubmission(result.rows[0]) : null;
};

export const listAdminNoundrySubmissions = async () => {
  await ensureTable();

  const result = await getPool().query(
    `
      SELECT ${selectFields}
      FROM noundry_submissions
      ORDER BY created_at DESC
      LIMIT 250
    `
  );

  return result.rows.map(mapSubmission);
};

export const createNoundrySubmission = async (
  input: CreateNoundrySubmissionInput
) => {
  await ensureTable();

  const id = randomUUID();
  const result = await getPool().query(
    `
      INSERT INTO noundry_submissions (
        id,
        title,
        artist,
        trait_type,
        pixels,
        selected_traits,
        preview_traits,
        status,
        approved_at
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, 'approved', now())
      RETURNING ${selectFields}
    `,
    [
      id,
      input.title.trim(),
      input.artist,
      input.traitType,
      JSON.stringify(input.pixels),
      JSON.stringify(input.selectedTraits),
      JSON.stringify(input.previewTraits),
    ]
  );

  return mapSubmission(result.rows[0]);
};

export const approveNoundrySubmission = async (id: string) => {
  await ensureTable();

  const result = await getPool().query(
    `
      UPDATE noundry_submissions
      SET status = 'approved',
          approved_at = now(),
          removed_at = null,
          updated_at = now()
      WHERE id = $1
      RETURNING ${selectFields}
    `,
    [id]
  );

  return result.rows[0] ? mapSubmission(result.rows[0]) : null;
};

export const updateNoundrySubmission = async (
  id: string,
  input: UpdateNoundrySubmissionInput
) => {
  await ensureTable();

  const currentResult = await getPool().query(
    `SELECT ${selectFields} FROM noundry_submissions WHERE id = $1`,
    [id]
  );
  const current = currentResult.rows[0]
    ? mapSubmission(currentResult.rows[0])
    : null;

  if (!current) return null;

  const merged = {
    title: input.title ?? current.title,
    artist: input.artist ?? current.artist,
    traitType: input.traitType ?? current.traitType,
    pixels: input.pixels ?? current.pixels,
    selectedTraits: input.selectedTraits ?? current.selectedTraits,
    previewTraits: input.previewTraits ?? current.previewTraits,
  };
  const validationError = validateNoundrySubmission(merged);

  if (validationError) {
    throw new Error(validationError);
  }

  const result = await getPool().query(
    `
      UPDATE noundry_submissions
      SET title = $2,
          artist = $3,
          trait_type = $4,
          pixels = $5::jsonb,
          selected_traits = $6::jsonb,
          preview_traits = $7::jsonb,
          updated_at = now()
      WHERE id = $1
      RETURNING ${selectFields}
    `,
    [
      id,
      merged.title.trim(),
      merged.artist,
      merged.traitType,
      JSON.stringify(merged.pixels),
      JSON.stringify(merged.selectedTraits),
      JSON.stringify(merged.previewTraits),
    ]
  );

  return result.rows[0] ? mapSubmission(result.rows[0]) : null;
};

export const updateNoundrySubmissionMetadata = async (
  id: string,
  input: UpdateNoundrySubmissionMetadataInput,
  expectedArtist: string
) => {
  await ensureTable();

  const validationError = validateNoundryAuthorMetadata(input);
  if (validationError) throw new Error(validationError);

  const result = await getPool().query(
    `
      UPDATE noundry_submissions
      SET title = $2,
          trait_type = $3,
          updated_at = now()
      WHERE id = $1
        AND status = 'approved'
        AND lower(artist) = lower($4)
      RETURNING ${selectFields}
    `,
    [id, input.title.trim(), input.traitType.trim(), expectedArtist]
  );

  return result.rows[0] ? mapSubmission(result.rows[0]) : null;
};

export const removeNoundrySubmission = async (id: string) => {
  await ensureTable();

  const result = await getPool().query(
    `
      UPDATE noundry_submissions
      SET status = 'removed',
          removed_at = now(),
          updated_at = now()
      WHERE id = $1
      RETURNING ${selectFields}
    `,
    [id]
  );

  return result.rows[0] ? mapSubmission(result.rows[0]) : null;
};

export const removeNoundrySubmissionByAuthor = async (
  id: string,
  expectedArtist: string
) => {
  await ensureTable();

  const result = await getPool().query(
    `
      UPDATE noundry_submissions
      SET status = 'removed',
          removed_at = now(),
          updated_at = now()
      WHERE id = $1
        AND status = 'approved'
        AND lower(artist) = lower($2)
      RETURNING ${selectFields}
    `,
    [id, expectedArtist]
  );

  return result.rows[0] ? mapSubmission(result.rows[0]) : null;
};
