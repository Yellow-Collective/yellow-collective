import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import {
  PREVIEW_TARGET_ID,
  parsePreviewTarget,
  verifyPreviewConfirmation,
} from "../scripts/round-video-preview-target.mjs";
const env = {
  ROUND_VIDEO_PREVIEW_DATABASE_URL:
    "postgresql://synthetic-user:synthetic-secret@preview.example.invalid:5432/preview",
};
const target = parsePreviewTarget(env);
assert.match(target.fingerprint, /^[a-f0-9]{64}$/);
assert.equal(target.connection.ssl.rejectUnauthorized, true);
assert.equal(
  parsePreviewTarget({
    ...env,
    ROUND_VIDEO_PREVIEW_DATABASE_URL:
      env.ROUND_VIDEO_PREVIEW_DATABASE_URL.replace(
        "synthetic-secret",
        "different-secret"
      ),
  }).fingerprint,
  target.fingerprint
);
for (const invalid of [
  {},
  { ...env, DATABASE_URL: env.ROUND_VIDEO_PREVIEW_DATABASE_URL },
  { ...env, DATABASE_PUBLIC_URL: env.ROUND_VIDEO_PREVIEW_DATABASE_URL },
  {
    ...env,
    ROUND_VIDEO_PREVIEW_DATABASE_URL:
      "postgresql://user:secret@production.example.invalid/database",
  },
  {
    ...env,
    ROUND_VIDEO_PREVIEW_DATABASE_URL:
      "postgresql://user:secret@preview.example.invalid/production",
  },
  { ...env, ROUND_VIDEO_PREVIEW_DB_SSL_MODE: "disable" },
  {
    ...env,
    ROUND_VIDEO_PREVIEW_DATABASE_URL:
      env.ROUND_VIDEO_PREVIEW_DATABASE_URL + "?options=-csearch_path=public",
  },
])
  assert.throws(() => parsePreviewTarget(invalid));
try {
  parsePreviewTarget({
    ...env,
    ROUND_VIDEO_PREVIEW_DATABASE_URL: "INVALID synthetic-secret URL",
  });
  assert.fail();
} catch (error) {
  assert(!error.message.includes("synthetic-secret"));
  assert(!("input" in error));
}
assert.equal(
  parsePreviewTarget({
    ...env,
    ROUND_VIDEO_PREVIEW_DATABASE_URL:
      "postgresql://user:secret@127.0.0.1:5432/preview",
    ROUND_VIDEO_PREVIEW_DB_SSL_MODE: "disable",
  }).connection.ssl,
  false
);
assert.throws(() => verifyPreviewConfirmation({}, target, "synthetic-server"));
verifyPreviewConfirmation(
  {
    ROUND_VIDEO_PREVIEW_TARGET_ID: PREVIEW_TARGET_ID,
    ROUND_VIDEO_PREVIEW_TARGET_SHA256: target.fingerprint,
    ROUND_VIDEO_PREVIEW_SERVER_SHA256: "synthetic-server",
  },
  target,
  "synthetic-server"
);
assert.throws(() =>
  verifyPreviewConfirmation(
    {
      ROUND_VIDEO_PREVIEW_TARGET_ID: PREVIEW_TARGET_ID,
      ROUND_VIDEO_PREVIEW_TARGET_SHA256: target.fingerprint,
      ROUND_VIDEO_PREVIEW_SERVER_SHA256: "other-server",
    },
    target,
    "synthetic-server"
  )
);
console.log(
  "ok - explicit isolated database guard rejects production, ordinary DB fallback, confirmation mismatch, unsafe TLS/query options and secret-bearing URL errors"
);

const normalizeSql = (value) =>
  value
    .replace(/^--.*$/gm, "")
    .replace(/\s+/g, " ")
    .trim();
const runtime = readFileSync("data/rounds.ts", "utf8");
const migration = readFileSync("scripts/round-video-schema.sql", "utf8");
const start = runtime.indexOf(
  "ALTER TABLE round_submissions ADD COLUMN IF NOT EXISTS video"
);
const end = runtime.indexOf("CREATE TABLE IF NOT EXISTS round_votes", start);
assert.equal(normalizeSql(runtime.slice(start, end)), normalizeSql(migration));
assert(!/(?:^|;)\s*(UPDATE|DELETE|DROP|TRUNCATE)\b/im.test(migration));
console.log(
  "ok - standalone additive video migration matches runtime schema without unrelated data mutations"
);
