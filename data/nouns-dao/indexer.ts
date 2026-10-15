import { attachDatabasePool } from "@vercel/functions";
import { Pool } from "pg";

const DEFAULT_INDEXER_SCHEMA = "ponder_live_camp";
const INDEXER_SCHEMA =
  process.env.NOUNS_DAO_INDEXER_SCHEMA || DEFAULT_INDEXER_SCHEMA;

let indexerPool: Pool | null = null;

const getIndexerConnectionString = () =>
  process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;

export const getNounsDaoIndexerPool = () => {
  const connectionString = getIndexerConnectionString();
  if (!connectionString) return null;

  if (!indexerPool) {
    indexerPool = new Pool({
      connectionString,
      connectionTimeoutMillis: 8000,
      idleTimeoutMillis: 5000,
      max: 2,
      ssl: connectionString.includes("railway.internal")
        ? undefined
        : { rejectUnauthorized: false },
    });
    if (process.env.VERCEL) attachDatabasePool(indexerPool);
  }

  return indexerPool;
};

export const getNounsDaoIndexerSchema = () => {
  if (/^[a-zA-Z0-9_]+$/.test(INDEXER_SCHEMA)) return INDEXER_SCHEMA;
  throw new Error("Invalid NOUNS_DAO_INDEXER_SCHEMA value");
};
