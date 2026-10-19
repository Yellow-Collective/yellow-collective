/** Dry-run first; fixture execution is isolated, hosted execution requires separate authorization. */
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync, openSync, fsyncSync, closeSync, unlinkSync } from "node:fs";
import { dirname, resolve, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
const require = createRequire(import.meta.url);
const hash = (value) => createHash("sha256").update(value).digest("hex");
export const roundImageMigrationFingerprint = (record) => hash(JSON.stringify(record, (_key, value) => value && typeof value === "object" && !Array.isArray(value) ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, value[key]])) : value));
const fingerprint = roundImageMigrationFingerprint;
const processing = () => {
  const ts = require("typescript");
  const module = { exports: {} };
  const source = readFileSync(new URL("../utils/rounds/image-processing.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
  vm.runInNewContext(compiled.outputText, { require, module, exports: module.exports, Buffer });
  return module.exports;
};

export async function migrateRoundImages({ records, ids, batchSize = 10, dryRun = true, store, read, conditionalUpdate, journal = async () => {}, processImage = processing().processRoundImage }) {
  if (!Array.isArray(ids) || !ids.length || ids.length > 100 || !Number.isInteger(batchSize) || batchSize < 1 || batchSize > 25) throw new Error("Select 1-100 explicit record IDs and a batch of 1-25.");
  const report = [];
  for (const id of [...new Set(ids)].slice(0, batchSize)) {
    const record = records.find((entry) => entry.id === id);
    if (!record) { report.push({ id, status: "missing" }); continue; }
    const before = fingerprint(record);
    const sourceImages = record.images || (record.imageUrl ? [record.imageUrl] : []);
    if (!Array.isArray(sourceImages) || !sourceImages.length || sourceImages.length > 10 || !/^[A-Za-z0-9_-]{1,100}$/.test(record.roundId) || !/^[A-Za-z0-9_-]{1,100}$/.test(record.id)) { report.push({ id, status: "unsupported" }); continue; }
    if (record.imageAssets?.length === sourceImages.length && sourceImages.every((image, index) => {
      const match = typeof image === "string" && /^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,([A-Za-z0-9+/]+={0,2})$/.exec(image);
      if (!match) return record.imageAssets[index] === null;
      const sha = hash(Buffer.from(match[2], "base64"));
      return record.imageAssets[index]?.sha256 === sha && record.imageAssets[index]?.key === `round-images/v1/${record.roundId}/${record.id}/${index}-${sha}.${match[1] === "image/jpg" ? "jpeg" : match[1].split("/")[1]}`;
    })) { report.push({ id, status: "unchanged" }); continue; }
    const item = { id, status: "prepared", before, beforeAssets: record.imageAssets || null, assets: [], objects: [] };
    try {
      for (const [index, image] of sourceImages.entries()) {
        // Never fetch arbitrary legacy URLs. SVG traits and externally hosted images stay on compatibility reads.
        if (typeof image !== "string" || !/^data:image\/(?:png|jpeg|jpg|webp|gif);base64,/.test(image)) { item.assets.push(null); continue; }
        const decoded = await processImage(image);
        const prefix = `round-images/v1/${record.roundId}/${record.id}/${index}-${decoded.sha256}`;
        const asset = { key: `${prefix}.${decoded.mime.split("/")[1]}`, previewKey: `${prefix}.preview.webp`, sha256: decoded.sha256, bytes: decoded.bytes, mime: decoded.mime, width: decoded.width, height: decoded.height, frames: decoded.frames, previewBytes: decoded.previewBytes };
        item.assets.push(asset);
        for (const [key, bytes] of [[asset.key, decoded.original], [asset.previewKey, decoded.preview]]) {
          item.objects.push({ key, sha256: hash(bytes), bytes: bytes.length });
          if (!dryRun) {
            await journal(item);
            await store(key, bytes);
            const persisted = await read(key);
            if (persisted.length !== bytes.length || hash(persisted) !== hash(bytes)) throw new Error("verification-failed");
          }
        }
      }
      if (JSON.stringify(record.imageAssets) === JSON.stringify(item.assets)) { report.push({ id, status: "unchanged" }); continue; }
      if (dryRun) { report.push({ id, status: "dry-run", images: item.assets.filter(Boolean).length, bytes: item.assets.reduce((sum, asset) => sum + (asset?.bytes || 0), 0) }); continue; }
      // Durably write the prepared journal before the conditional reference update. Legacy bytes remain untouched.
      const next = { ...record, imageAssets: item.assets };
      item.after = fingerprint(next);
      await journal(item);
      item.status = await conditionalUpdate(id, before, next) ? "committed" : "conflict";
      await journal(item);
      report.push({ id, status: item.status, images: item.assets.length });
    } catch {
      item.status = "failed";
      if (!dryRun) await journal(item);
      report.push({ id, status: "failed" });
    }
  }
  return report;
}

export async function rollbackRoundImages({ records, entries, conditionalUpdate }) {
  const results = [];
  for (const entry of [...entries].reverse()) {
    if (!["prepared", "committed", "failed"].includes(entry.status) || !entry.after) continue;
    const current = records.find((record) => record.id === entry.id);
    if (current && fingerprint(current) === entry.before) { results.push({ id: entry.id, status: "already-rolled-back" }); continue; }
    if (!current || fingerprint(current) !== entry.after) { results.push({ id: entry.id, status: "conflict" }); continue; }
    const next = { ...current };
    if (entry.beforeAssets === null) delete next.imageAssets;
    else next.imageAssets = entry.beforeAssets;
    results.push({ id: entry.id, status: await conditionalUpdate(entry.id, entry.after, next) ? "rolled-back" : "conflict" });
  }
  // Objects are deliberately retained: another record or failed batch may still reference them.
  return results;
}

const atomicWrite = (path, value) => {
  const temp = `${path}.tmp`;
  const fd = openSync(temp, "w", 0o600);
  try { writeFileSync(fd, JSON.stringify(value, null, 2)); fsyncSync(fd); } finally { closeSync(fd); }
  renameSync(temp, path);
};

/** Pure adapter construction: a supplied pool is the only database access capability. */
export function createPostgresMigrationAdapter(pool) {
  const records = [];
  return {
    records,
    async loadSelected(ids, batchSize) {
      if (!Array.isArray(ids) || !ids.length || ids.length > 100 || ids.some((id) => !/^[A-Za-z0-9_-]{1,100}$/.test(id)) || !Number.isInteger(batchSize) || batchSize < 1 || batchSize > 25) throw new Error("Invalid explicit migration selection.");
      const result = await pool.query(`SELECT id, round_id AS "roundId", images, image AS "imageUrl", image_assets AS "imageAssets", to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "updatedAt" FROM round_submissions WHERE id = ANY($1::text[]) ORDER BY array_position($1::text[], id) LIMIT $2`, [[...new Set(ids)], batchSize]);
      records.splice(0, records.length, ...result.rows);
      return records;
    },
    async conditionalUpdate(id, before, next) {
      const index = records.findIndex((record) => record.id === id);
      const current = records[index];
      if (!current || fingerprint(current) !== before) return false;
      const result = await pool.query(`UPDATE round_submissions SET image_assets=$1::jsonb WHERE id=$2 AND round_id=$3 AND updated_at=$4::timestamptz AND images IS NOT DISTINCT FROM $5::jsonb AND image IS NOT DISTINCT FROM $6 AND image_assets IS NOT DISTINCT FROM $7::jsonb RETURNING id`, [JSON.stringify(next.imageAssets || []), id, current.roundId, current.updatedAt, JSON.stringify(current.images), current.imageUrl, JSON.stringify(current.imageAssets || [])]);
      if (result.rowCount !== 1) return false;
      records[index] = { ...next, imageAssets: next.imageAssets || [] };
      return true;
    },
  };
}

/** The injected SDK client is never created or contacted by dry-run. */
export function createS3MigrationAdapter({ client, bucket, PutObjectCommand, GetObjectCommand }) {
  const keyPattern = /^round-images\/v1\/[A-Za-z0-9_-]{1,100}\/[A-Za-z0-9_-]{1,100}\/[0-9]-[a-f0-9]{64}(?:\.preview\.webp|\.(?:png|jpeg|webp|gif))$/;
  const validateKey = (key) => { if (!keyPattern.test(key)) throw new Error("Invalid migration object key."); };
  return {
    async store(key, bytes) {
      validateKey(key);
      if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > 8 * 1024 * 1024) throw new Error("Invalid migration object size.");
      const extension = key.split(".").at(-1);
      const mime = extension === "jpeg" ? "image/jpeg" : `image/${extension}`;
      try {
        await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: bytes, ContentLength: bytes.length, ContentType: mime, ChecksumSHA256: createHash("sha256").update(bytes).digest("base64"), CacheControl: "private, max-age=0, no-store", IfNoneMatch: "*" }), { abortSignal: AbortSignal.timeout(15000) });
      } catch (error) { if (error?.$metadata?.httpStatusCode !== 412) throw new Error("Migration storage write failed."); }
    },
    async read(key) {
      validateKey(key);
      const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }), { abortSignal: AbortSignal.timeout(15000) });
      if (!result.Body || (result.ContentLength || 0) > 8 * 1024 * 1024) throw new Error("Migration storage read failed.");
      const chunks = []; let size = 0;
      for await (const chunk of result.Body) { size += chunk.length; if (size > 8 * 1024 * 1024) throw new Error("Migration object exceeds limit."); chunks.push(chunk); }
      return Buffer.concat(chunks);
    },
  };
}

const durableJournal = (journalPath, entries, environment, target) => async (entry) => {
  const index = entries.findIndex((item) => item.id === entry.id && item.before === entry.before);
  const saved = { ...structuredClone(entry), environment, ...(target ? { target } : {}) };
  if (index < 0) entries.push(saved); else entries[index] = saved;
  atomicWrite(journalPath, entries);
};

async function hostedMain(args, flag) {
  const environment = flag("--environment");
  const databaseEnv = flag("--database-env");
  const ids = (flag("--ids") || "").split(",").filter(Boolean);
  const batchSize = Number(flag("--batch") || 10);
  const dryRun = !args.includes("--apply");
  if (!["staging", "production"].includes(environment) || process.env.ROUND_IMAGE_MIGRATION_ENVIRONMENT !== environment || !/^ROUND_IMAGE_MIGRATION_[A-Z_]*URL$/.test(databaseEnv || "") || !process.env[databaseEnv] || !ids.length || ids.length > 100 || ids.some((id) => !/^[A-Za-z0-9_-]{1,100}$/.test(id)) || !Number.isInteger(batchSize) || batchSize < 1 || batchSize > 25 || Number(flag("--concurrency") || 1) !== 1) throw new Error("Explicit matching environment, named migration database URL, selected IDs, bounded batch and concurrency one are required.");
  const databaseUrl = new URL(process.env[databaseEnv]);
  if (!["postgres:", "postgresql:"].includes(databaseUrl.protocol)) throw new Error("Invalid migration database URL.");
  if (!dryRun && (flag("--confirm-environment") !== environment || process.env.ROUND_IMAGE_MIGRATION_ALLOW_WRITES !== "true" || !flag("--journal"))) throw new Error("Apply requires matching explicit confirmation, migration write gate and a durable journal path.");
  if (args.includes("--rollback") && dryRun) throw new Error("Rollback requires explicit apply confirmation.");
  const journalPath = flag("--journal") ? resolve(flag("--journal")) : null;
  const target = hash(JSON.stringify([databaseUrl.host, databaseUrl.pathname]));
  const entries = journalPath && existsSync(journalPath) ? JSON.parse(readFileSync(journalPath, "utf8")) : [];
  if (entries.some((entry) => entry.environment !== environment || entry.target !== target)) throw new Error("Journal environment mismatch.");
  // These imports do not load application startup/schema initialization or ambient .env files.
  const { Pool } = require("pg");
  const pool = new Pool({ connectionString: process.env[databaseEnv], max: 1, connectionTimeoutMillis: 10000, statement_timeout: 15000, query_timeout: 20000, application_name: `round-image-migrate-${environment}` });
  let lock;
  try {
    if (!dryRun) {
      lock = openSync(`${journalPath}.lock`, "wx", 0o600);
      writeFileSync(lock, String(process.pid)); fsyncSync(lock);
      const latestEntries = existsSync(journalPath) ? JSON.parse(readFileSync(journalPath, "utf8")) : [];
      if (latestEntries.some((entry) => entry.environment !== environment || entry.target !== target)) throw new Error("Journal environment mismatch.");
      entries.splice(0, entries.length, ...latestEntries);
      // Verify journal writability before admitting any object or reference writes.
      atomicWrite(journalPath, entries);
    }
    const database = createPostgresMigrationAdapter(pool);
    if (dryRun) await pool.query("BEGIN READ ONLY");
    let storage = {};
    if (!dryRun && !args.includes("--rollback")) {
      const names = ["ROUND_IMAGE_S3_ENDPOINT", "ROUND_IMAGE_S3_REGION", "ROUND_IMAGE_S3_BUCKET", "ROUND_IMAGE_S3_ACCESS_KEY_ID", "ROUND_IMAGE_S3_SECRET_ACCESS_KEY"];
      if (process.env.ROUND_IMAGES_ENABLED !== "true" || process.env.ROUND_IMAGE_WRITES_ENABLED !== "true" || names.some((name) => !process.env[name])) throw new Error("Dedicated image storage is not ready.");
      const endpoint = new URL(process.env.ROUND_IMAGE_S3_ENDPOINT);
      if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password || endpoint.search || endpoint.hash || !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(process.env.ROUND_IMAGE_S3_BUCKET)) throw new Error("Invalid dedicated image storage configuration.");
      const aws = require("@aws-sdk/client-s3");
      const client = new aws.S3Client({ endpoint: process.env.ROUND_IMAGE_S3_ENDPOINT, region: process.env.ROUND_IMAGE_S3_REGION, forcePathStyle: process.env.ROUND_IMAGE_S3_FORCE_PATH_STYLE === "true", maxAttempts: 2, credentials: { accessKeyId: process.env.ROUND_IMAGE_S3_ACCESS_KEY_ID, secretAccessKey: process.env.ROUND_IMAGE_S3_SECRET_ACCESS_KEY } });
      storage = createS3MigrationAdapter({ client, bucket: process.env.ROUND_IMAGE_S3_BUCKET, ...aws });
    }
    const report = [];
    for (const id of [...new Set(ids)].slice(0, batchSize)) {
      // Keep at most one legacy gallery in memory, even when a batch selects 25 records.
      await database.loadSelected([id], 1);
      const options = { ...database, ...storage, ids: [id], batchSize: 1, dryRun, journal: journalPath ? durableJournal(journalPath, entries, environment, target) : undefined };
      report.push(...(args.includes("--rollback") ? await rollbackRoundImages({ ...database, entries: entries.filter((entry) => entry.id === id) }) : await migrateRoundImages(options)));
    }
    if (dryRun) await pool.query("ROLLBACK");
    console.log(JSON.stringify({ environment, dryRun, concurrency: 1, report }, null, 2));
    if (report.some((entry) => ["failed", "conflict", "missing"].includes(entry.status))) process.exitCode = 2;
  } finally {
    try { await pool.end(); } finally {
      if (lock !== undefined) { closeSync(lock); unlinkSync(`${journalPath}.lock`); }
    }
  }
}
async function main() {
  const args = process.argv.slice(2);
  const flag = (name) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
  if (flag("--adapter") === "postgres-s3") return hostedMain(args, flag);
  if (flag("--environment") !== "fixture" || !flag("--input") || !flag("--ids")) throw new Error("Usage: --environment fixture --input local.json --ids id1,id2 [--batch 10] [--apply --objects local-directory --journal local.json] [--rollback]");
  const input = resolve(flag("--input"));
  const dryRun = !args.includes("--apply");
  let records = JSON.parse(readFileSync(input, "utf8"));
  if (!Array.isArray(records)) throw new Error("Fixture must be a local JSON array.");
  const objects = resolve(flag("--objects") || `${input}.objects`);
  const journalPath = resolve(flag("--journal") || `${input}.journal.json`);
  const entries = existsSync(journalPath) ? JSON.parse(readFileSync(journalPath, "utf8")) : [];
  const conditionalUpdate = async (id, before, next) => {
    const latest = JSON.parse(readFileSync(input, "utf8"));
    const index = latest.findIndex((record) => record.id === id);
    if (index < 0 || fingerprint(latest[index]) !== before) return false;
    latest[index] = next; atomicWrite(input, latest); records.splice(0, records.length, ...latest); return true;
  };
  const objectPath = (key) => {
    const path = resolve(objects, key);
    const rel = relative(objects, path);
    if (rel.startsWith("..") || isAbsolute(rel)) throw new Error("Invalid object key.");
    return path;
  };
  const options = {
    records, ids: flag("--ids").split(","), batchSize: Number(flag("--batch") || 10), dryRun, conditionalUpdate,
    store: async (key, bytes) => { const path = objectPath(key); mkdirSync(dirname(path), { recursive: true }); if (!existsSync(path)) writeFileSync(path, bytes, { flag: "wx" }); },
    read: async (key) => readFileSync(objectPath(key)),
    journal: durableJournal(journalPath, entries, "fixture"),
  };
  if (args.includes("--rollback")) {
    if (dryRun) throw new Error("Rollback requires --apply and an existing journal; it affects local fixture files only.");
    const report = await rollbackRoundImages({ records, entries: entries.filter((entry) => options.ids.includes(entry.id)), conditionalUpdate });
    console.log(JSON.stringify(report, null, 2));
    if (report.some((entry) => ["failed", "conflict", "missing"].includes(entry.status))) process.exitCode = 2;
  } else {
    const report = await migrateRoundImages(options);
    console.log(JSON.stringify(report, null, 2));
    if (report.some((entry) => ["failed", "conflict", "missing"].includes(entry.status))) process.exitCode = 2;
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(() => { console.error("Migration failed. Check explicit environment, selection, journal, storage readiness and database configuration. Provider/database details are withheld."); process.exitCode = 1; });
