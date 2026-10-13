import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import {
  validateProbe,
  MAX_BYTES,
} from "../workers/round-video/validation.mjs";
const require = createRequire(import.meta.url);
const ts = require("typescript");
const load = (path, overrides = {}, globals = {}) => {
  const module = { exports: {} };
  const output = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;
  vm.runInNewContext(output, {
    module,
    exports: module.exports,
    require: (key) => (key in overrides ? overrides[key] : require(key)),
    process: {
      env: {
        ROUND_VIDEOS_ENABLED: "true",
        ROUND_VIDEO_WORKER_URL: "https://worker.invalid/validate",
        ROUND_VIDEO_WORKER_TOKEN: "synthetic",
      },
    },
    AbortSignal,
    URL,
    ...globals,
  });
  return module.exports;
};
const policy = load("utils/rounds/video-policy.ts");
const header = Buffer.alloc(16);
header.write("ftyp", 4);
header.write("isom", 8);
const probe = {
  format: { duration: "10", format_name: "mov,mp4,m4a,3gp,3g2,mj2" },
  streams: [
    {
      codec_type: "video",
      codec_name: "h264",
      width: 640,
      height: 480,
      pix_fmt: "yuv420p",
    },
    { codec_type: "audio", codec_name: "aac" },
  ],
};
assert.equal(validateProbe(probe, 1024, header).duration, 10);
for (const bad of [
  { ...probe, format: { duration: "121" } },
  { ...probe, format: { duration: "NaN" } },
  { ...probe, streams: [{ ...probe.streams[0], codec_name: "hevc" }] },
  {
    ...probe,
    streams: [probe.streams[0], { codec_type: "audio", codec_name: "mp3" }],
  },
  { ...probe, streams: [{ ...probe.streams[0], width: 99999 }] },
  { ...probe, streams: [...probe.streams, { codec_type: "subtitle" }] },
])
  assert.throws(() => validateProbe(bad, 1024, header));
assert.throws(() => validateProbe(probe, MAX_BYTES + 1, header));
assert.throws(() => validateProbe(probe, 1024, Buffer.alloc(16)));
const metadata = {
  objectKey: "round-videos/approved/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.mp4",
  bytes: 1024,
  duration: 10,
  width: 640,
  height: 480,
};
assert.equal(policy.validateVideoMetadata(metadata).bytes, 1024);
assert.throws(() =>
  policy.validateVideoMetadata({
    ...metadata,
    objectKey: "https://evil.invalid/video.mp4",
  })
);
console.log(
  "ok - authoritative format, codec, duration, dimensions and metadata limits"
);

const round = {
  id: "round",
  status: "published",
  active: true,
  maxSubmissionsPerWallet: 2,
};
const rows = new Map();
let daily = 0,
  active = 0,
  closed = false,
  unlock;
let lock = Promise.resolve();
const pool = {
  query: async (sql, args = []) => {
    if (sql.startsWith("SELECT * FROM round_video_uploads")) {
      const row = rows.get(args[0]);
      return {
        rows:
          row &&
          row.round_id === args[1] &&
          row.wallet_address.toLowerCase() === args[2].toLowerCase() &&
          row.expires_at > Date.now()
            ? [row]
            : [],
      };
    }
    if (sql.includes("SET status='validating'")) {
      const row = rows.get(args[0]);
      if (row?.status !== "pending") return { rowCount: 0 };
      row.status = "validating";
      return { rowCount: 1 };
    }
    if (sql.includes("SET status='ready'")) {
      const row = rows.get(args[0]);
      if (row.status !== "validating" || row.expires_at < Date.now())
        return { rowCount: 0 };
      row.status = "ready";
      row.metadata = JSON.parse(args[1]);
      return { rowCount: 1 };
    }
    if (sql.includes("SET status='rejected'")) {
      rows.get(args[0]).status = "rejected";
      return { rowCount: 1 };
    }
    if (sql.includes("SET status='cancelled'")) {
      const row = rows.get(args[0]);
      if (
        row &&
        row.wallet_address.toLowerCase() === args[2].toLowerCase() &&
        row.status !== "attached"
      )
        row.status = "cancelled";
      return { rowCount: 1 };
    }
    throw new Error("Unexpected query");
  },
  connect: async () => {
    let release;
    return {
      release() {
        release?.();
      },
      query: async (sql, args = []) => {
        if (sql.includes("round-video-budget")) {
          const previous = lock;
          lock = new Promise((resolve) => {
            release = resolve;
          });
          await previous;
          return { rows: [] };
        }
        if (sql.includes("SELECT status,active"))
          return {
            rows: closed ? [] : [{ status: "published", active: true }],
          };
        if (sql.includes("AS daily"))
          return {
            rows: [
              {
                daily,
                wallet_daily: daily,
                pending: [...rows.values()].filter(
                  (r) => r.status === "pending" && r.wallet_address === args[1]
                ).length,
                active,
              },
            ],
          };
        if (sql.includes("INSERT INTO round_video_uploads")) {
          rows.set(args[0], {
            id: args[0],
            round_id: args[1],
            wallet_address: args[2],
            staging_key: args[3],
            object_key: args[4],
            status: "pending",
            expires_at: Date.now() + 1800000,
          });
          daily++;
          return { rows: [] };
        }
        return { rows: [] };
      },
    };
  },
};
let workerCalls = 0,
  workerStatus = 200,
  networkFailure = false;
const lifecycle = load(
  "data/round-videos.ts",
  {
    "./rounds": {
      getRoundsPool: () => pool,
      ensureRoundsTables: async () => {},
      getRoundById: async () => (closed ? null : round),
    },
    "@/utils/rounds/state": {
      getRoundState: (value) =>
        value?.status === "published" ? "submissions_open" : "ended",
    },
    "@/utils/rounds/video-storage": {
      videosEnabled: () => true,
      videoUploadPost: async (key) => ({
        url: "https://bucket.invalid",
        fields: { key },
      }),
    },
    "@/utils/rounds/video-policy": policy,
  },
  {
    fetch: async (url, options) => {
      workerCalls++;
      if (networkFailure) throw new Error("Timeout");
      const job = JSON.parse(options.body);
      return {
        ok: workerStatus === 200,
        status: workerStatus,
        json: async () => ({ ...metadata, objectKey: job.objectKey }),
      };
    },
  }
);
const concurrent = await Promise.allSettled([
  lifecycle.reserveRoundVideo(round, "wallet"),
  lifecycle.reserveRoundVideo(round, "wallet"),
]);
assert.equal(
  concurrent.filter((result) => result.status === "fulfilled").length,
  1
);
const reservation = concurrent.find(
  (result) => result.status === "fulfilled"
).value;
await assert.rejects(
  lifecycle.finalizeRoundVideo(round, "other", reservation.id),
  /not found/
);
const ready = await lifecycle.finalizeRoundVideo(
  round,
  "wallet",
  reservation.id
);
assert.equal(ready.id, reservation.id);
await lifecycle.finalizeRoundVideo(round, "wallet", reservation.id);
assert.equal(workerCalls, 1);
rows.get(reservation.id).status = "attached";
await assert.rejects(
  lifecycle.finalizeRoundVideo(round, "wallet", reservation.id),
  /cannot be reused/
);
closed = true;
await assert.rejects(
  lifecycle.reserveRoundVideo(round, "new"),
  /not accepting/
);
closed = false;
rows.get(reservation.id).expires_at = 0;
await assert.rejects(
  lifecycle.finalizeRoundVideo(round, "wallet", reservation.id),
  /expired/
);
const second = await lifecycle.reserveRoundVideo(round, "second");
workerStatus = 422;
await assert.rejects(lifecycle.finalizeRoundVideo(round, "second", second.id));
assert.equal(rows.get(second.id).status, "rejected");
const third = await lifecycle.reserveRoundVideo(round, "third");
networkFailure = true;
await assert.rejects(lifecycle.finalizeRoundVideo(round, "third", third.id));
assert.equal(rows.get(third.id).status, "validating");
await lifecycle.cancelRoundVideo(round, "wrong", third.id);
assert.equal(rows.get(third.id).status, "validating");
await lifecycle.cancelRoundVideo(round, "third", third.id);
assert.equal(rows.get(third.id).status, "cancelled");
console.log(
  "ok - admission serialization, owner denial, expiry, closure, finalization idempotency and unknown outcome quarantine"
);

let authenticated = false;
const handlers = load("pages/api/rounds/[slug]/videos.ts", {
  "data/rounds": { getRoundBySlug: async () => round },
  "data/round-videos": { ...lifecycle },
  "@/utils/rounds/server-auth": {
    verifyRoundWalletSignedRequest: async ({ res }) => {
      if (!authenticated) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      return "wallet";
    },
  },
  "@/utils/rounds/video-storage": { videosEnabled: () => false },
}).default;
const res = {
  code: 200,
  setHeader() {},
  status(code) {
    this.code = code;
    return this;
  },
  json(value) {
    this.value = value;
    return this;
  },
};
await handlers(
  { method: "POST", query: { slug: "round" }, body: { operation: "reserve" } },
  res
);
assert.equal(res.code, 401);
await handlers(
  {
    method: "POST",
    query: { slug: "round" },
    body: { operation: "reserve", objectKey: "evil" },
  },
  res
);
assert.equal(res.code, 400);
await handlers({ method: "GET", query: { slug: "round" } }, res);
assert.equal(res.value.enabled, false);
console.log(
  "ok - protected upload handler rejects anonymous and unexpected fields; configuration disables UI"
);

const playback = load("pages/api/rounds/[slug]/video-playback.ts", {
  "data/rounds": {
    getRoundBySlug: async () => round,
    getRoundSubmission: async () => ({
      ...metadata,
      video: metadata,
      status: "hidden",
    }),
  },
  "@/utils/rounds/video-storage": {
    videosEnabled: () => true,
    videoPlaybackUrl: async () => {
      throw new Error("Hidden video must never be signed");
    },
  },
}).default;
await playback({ method: "GET", query: { slug: "round", id: "hidden" } }, res);
assert.equal(res.code, 404);
console.log("ok - hidden submission playback cannot acquire signed object URL");

const { cleanVideoCandidates } =
  await import("../workers/round-video/cleanup.mjs");
const candidate = {
  id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  staging_key: "round-videos/staging/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.mp4",
  object_key: metadata.objectKey,
};
let deleted = [];
let marked = [];
const cleanup = {
  remove: async (key) => deleted.push(key),
  mark: async (id) => marked.push(id),
};
await cleanVideoCandidates([candidate], cleanup);
assert.equal(deleted.length, 0);
await cleanVideoCandidates([candidate], { ...cleanup, apply: true });
assert.equal(deleted.length, 2);
assert.equal(marked.length, 1);
await assert.rejects(
  cleanVideoCandidates([{ ...candidate, object_key: "arbitrary/file" }], {
    ...cleanup,
    apply: true,
  })
);
console.log(
  "ok - cleanup defaults to dry-run and rejects keys outside reserved namespace"
);

const storageEnv = {
  ROUND_VIDEOS_ENABLED: "true",
  ROUND_VIDEO_S3_ENDPOINT: "https://storage.example.invalid",
  ROUND_VIDEO_S3_REGION: "auto",
  ROUND_VIDEO_S3_BUCKET: "private-video-bucket",
  ROUND_VIDEO_S3_ACCESS_KEY_ID: "synthetic",
  ROUND_VIDEO_S3_SECRET_ACCESS_KEY: "synthetic",
  ROUND_VIDEO_WORKER_URL: "https://worker.example.invalid/validate",
  ROUND_VIDEO_WORKER_TOKEN: "x".repeat(32),
};
const storage = load(
  "utils/rounds/video-storage.ts",
  { "./video-policy": policy },
  { process: { env: storageEnv } }
);
assert.equal(storage.videosEnabled(), true);
const signedPost = await storage.videoUploadPost(
  "round-videos/staging/test.mp4"
);
const postPolicy = JSON.parse(
  Buffer.from(signedPost.fields.Policy, "base64").toString("utf8")
);
assert(
  postPolicy.conditions.some(
    (condition) =>
      Array.isArray(condition) &&
      condition[0] === "content-length-range" &&
      condition[2] === MAX_BYTES
  )
);
assert(
  postPolicy.conditions.some(
    (condition) =>
      Array.isArray(condition) &&
      condition[0] === "eq" &&
      condition[1] === "$Content-Type" &&
      condition[2] === "video/mp4"
  )
);
assert.equal(signedPost.fields.key, "round-videos/staging/test.mp4");
const playbackUrl = new URL(await storage.videoPlaybackUrl(metadata.objectKey));
assert.equal(playbackUrl.searchParams.get("X-Amz-Expires"), "900");
assert(playbackUrl.pathname.endsWith(metadata.objectKey));
storageEnv.ROUND_VIDEOS_ENABLED = "false";
assert.equal(storage.videosEnabled(), false);
storageEnv.ROUND_VIDEOS_ENABLED = "true";
storageEnv.ROUND_VIDEO_WORKER_TOKEN = "short";
assert.equal(storage.videosEnabled(), false);
console.log(
  "ok - scoped signed POST enforces content length/type and GET has bounded expiry; missing configuration fails closed"
);
active = 2;
await assert.rejects(lifecycle.reserveRoundVideo(round, "fourth"), /quota/);
active = 0;
daily = 10;
await assert.rejects(lifecycle.reserveRoundVideo(round, "quota"), /quota/);
console.log(
  "ok - active submission quota and wallet daily budget deny before issuing storage credentials"
);

const { cleanAttachedStagingCandidates } =
  await import("../workers/round-video/cleanup.mjs");
const attachedRows = Array.from({ length: 201 }, (_, index) => {
  const id = `${index.toString(16).padStart(8, "0")}-0000-0000-0000-000000000000`;
  return {
    id,
    staging_key: `round-videos/staging/${id}.mp4`,
    staging_cleaned_at: null,
  };
});
const nextBatch = () =>
  attachedRows.filter((row) => row.staging_cleaned_at === null).slice(0, 100);
const deletedStaging = [];
const stagingCleanup = {
  apply: true,
  remove: async (key) => deletedStaging.push(key),
  mark: async (id) => {
    attachedRows.find((row) => row.id === id).staging_cleaned_at = "completed";
  },
};
await cleanAttachedStagingCandidates(nextBatch(), stagingCleanup);
assert.equal(nextBatch().length, 100);
await cleanAttachedStagingCandidates(nextBatch(), stagingCleanup);
assert.equal(nextBatch().length, 1);
assert.equal(new Set(deletedStaging).size, 200);
let failedMarked = false;
await assert.rejects(
  cleanAttachedStagingCandidates(nextBatch(), {
    apply: true,
    remove: async () => {
      throw new Error("Delete failed");
    },
    mark: async () => {
      failedMarked = true;
    },
  })
);
assert.equal(failedMarked, false);
assert.equal(nextBatch().length, 1);
await assert.rejects(
  cleanAttachedStagingCandidates(
    [{ id: attachedRows[0].id, staging_key: "arbitrary/file" }],
    stagingCleanup
  )
);
await cleanAttachedStagingCandidates(nextBatch(), {
  ...stagingCleanup,
  apply: false,
});
assert.equal(nextBatch().length, 1);
console.log(
  "ok - attached staging cleanup advances beyond the first 100 rows, validates namespace and marks only successful deletions"
);
