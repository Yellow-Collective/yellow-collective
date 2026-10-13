import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import pg from "pg";
import {
  PREVIEW_TARGET_ID,
  parsePreviewTarget,
  sha256,
  verifyPreviewConfirmation,
} from "./round-video-preview-target.mjs";

const flags = new Set(process.argv.slice(2));
if (flags.has("--help")) {
  console.log(
    "Read-only: --inspect. Mutating rehearsal: --initialize-target --run (initially empty disposable preview only), then --run. Inject ROUND_VIDEO_PREVIEW_DATABASE_URL, ROUND_VIDEO_PREVIEW_TARGET_ID=yellow-round-video-preview, ROUND_VIDEO_PREVIEW_TARGET_SHA256 and ROUND_VIDEO_PREVIEW_SERVER_SHA256. Public TLS is verified by default; require mode must be explicitly selected if necessary. No ordinary DATABASE_URL fallback."
  );
  process.exit(0);
}
if (!flags.has("--inspect") && !flags.has("--run"))
  throw new Error("Choose --inspect or --run.");
const target = parsePreviewTarget(process.env);
const admin = new pg.Client(target.connection);
const require = createRequire(import.meta.url);
const ts = require("typescript");
let schema;
let isolatedPool;
let phase = "connect";
const source = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const load = (path, overrides = {}) => {
  const module = { exports: {} };
  const { outputText } = ts.transpileModule(source(path), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  });
  vm.runInNewContext(outputText, {
    module,
    exports: module.exports,
    require: (key) => (key in overrides ? overrides[key] : require(key)),
    process: { env: { DATABASE_URL: "explicit-preview-only" } },
    AbortSignal,
    fetch: () => {
      throw new Error(
        "No network providers are allowed in the database rehearsal."
      );
    },
  });
  return module.exports;
};

try {
  await admin.connect();
  const identity = (
    await admin.query(
      "SELECT current_database() AS db,current_user AS role,(SELECT oid FROM pg_database WHERE datname=current_database())::text AS database_oid,current_setting('server_version') AS version"
    )
  ).rows[0];
  const serverFingerprint = sha256(JSON.stringify(identity));
  if (flags.has("--inspect")) {
    console.log(
      JSON.stringify({
        mode: "read-only",
        targetFingerprint: target.fingerprint,
        serverFingerprint,
        postgresVersion: identity.version,
      })
    );
  }
  if (flags.has("--run")) {
    phase = "target_confirmation";
    verifyPreviewConfirmation(process.env, target, serverFingerprint);
    phase = "preview_marker";
    if (flags.has("--initialize-target")) {
      const count = (
        await admin.query(
          "SELECT count(*)::int AS count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','f','S')"
        )
      ).rows[0].count;
      if (count !== 0)
        throw new Error(
          "Preview initialization requires an empty public schema."
        );
      await admin.query("BEGIN");
      try {
        await admin.query(
          "CREATE TABLE public.round_video_preview_target (target_id text PRIMARY KEY,target_fingerprint text NOT NULL,server_fingerprint text NOT NULL,created_at timestamptz NOT NULL DEFAULT now())"
        );
        await admin.query(
          "INSERT INTO public.round_video_preview_target(target_id,target_fingerprint,server_fingerprint) VALUES($1,$2,$3)",
          [PREVIEW_TARGET_ID, target.fingerprint, serverFingerprint]
        );
        await admin.query("COMMIT");
      } catch (error) {
        await admin.query("ROLLBACK");
        throw error;
      }
    }
    const marker = (
      await admin.query(
        "SELECT target_fingerprint,server_fingerprint FROM public.round_video_preview_target WHERE target_id=$1",
        [PREVIEW_TARGET_ID]
      )
    ).rows[0];
    if (
      !marker ||
      marker.target_fingerprint !== target.fingerprint ||
      marker.server_fingerprint !== serverFingerprint
    )
      throw new Error("Verified disposable preview marker is required.");
    phase = "schema_bootstrap";
    schema = `round_video_rehearsal_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
    assert.match(schema, /^round_video_rehearsal_[a-f0-9]{12}$/);
    await admin.query(`CREATE SCHEMA "${schema}"`);
    isolatedPool = new pg.Pool({
      ...target.connection,
      max: 2,
      options: `-c search_path=${schema}`,
    });
    const legacy = source("scripts/rounds-schema.sql");
    const firstTwoTables = legacy.slice(
      0,
      legacy.indexOf("CREATE TABLE IF NOT EXISTS round_votes")
    );
    assert(
      !firstTwoTables.includes("UPDATE ") && !firstTwoTables.includes("DROP ")
    );
    await isolatedPool.query(firstTwoTables);
    const now = Date.now();
    await isolatedPool.query(
      `INSERT INTO rounds(id,slug,title,description,content,starts_at,submissions_open_at,voting_starts_at,voting_ends_at,ends_at,active,status,max_submissions_per_wallet) VALUES('synthetic-round','synthetic-round','Synthetic rehearsal','Synthetic description','Synthetic content',$1,$1,$2,$3,$3,true,'published',1)`,
      [new Date(now - 60000), new Date(now + 3600000), new Date(now + 7200000)]
    );
    await isolatedPool.query(
      `INSERT INTO round_submissions(id,round_id,wallet_address,title,description,image,images,url,status) VALUES('synthetic-legacy','synthetic-round','synthetic-legacy-wallet','Legacy image','Preserved legacy image submission','https://example.invalid/cover.png','["https://example.invalid/cover.png"]'::jsonb,'','approved')`
    );
    const baseline = (
      await isolatedPool.query(
        "SELECT image,images,title,description,status FROM round_submissions WHERE id='synthetic-legacy'"
      )
    ).rows[0];
    phase = "migration";
    const migration = source("scripts/round-video-schema.sql");
    assert(!/(?:^|;)\s*(UPDATE|DELETE|DROP|TRUNCATE)\b/im.test(migration));
    await isolatedPool.query(migration);
    await isolatedPool.query(migration);
    const after = (
      await isolatedPool.query(
        "SELECT image,images,title,description,status FROM round_submissions WHERE id='synthetic-legacy'"
      )
    ).rows[0];
    assert.deepEqual(after, baseline);
    assert.equal(
      (
        await isolatedPool.query(
          "SELECT data_type FROM information_schema.columns WHERE table_schema=$1 AND table_name='round_video_uploads' AND column_name='round_id'",
          [schema]
        )
      ).rows[0].data_type,
      "text"
    );
    console.log(
      "ok - additive migration/reapply preserves existing image submission and uses compatible text foreign keys"
    );

    phase = "lock_check";
    const first = await isolatedPool.connect();
    const second = await isolatedPool.connect();
    try {
      const firstPid = (await first.query("SELECT pg_backend_pid() AS pid"))
        .rows[0].pid;
      const secondPid = (await second.query("SELECT pg_backend_pid() AS pid"))
        .rows[0].pid;
      assert.notEqual(firstPid, secondPid);
      await first.query("BEGIN");
      await second.query("BEGIN");
      await first.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
        "submission:synthetic-round:synthetic-lock-wallet",
      ]);
      assert.equal(
        (
          await second.query(
            "SELECT pg_try_advisory_xact_lock(hashtext($1)) AS acquired",
            ["submission:synthetic-round:synthetic-lock-wallet"]
          )
        ).rows[0].acquired,
        false
      );
      await first.query("COMMIT");
      assert.equal(
        (
          await second.query(
            "SELECT pg_try_advisory_xact_lock(hashtext($1)) AS acquired",
            ["submission:synthetic-round:synthetic-lock-wallet"]
          )
        ).rows[0].acquired,
        true
      );
      await second.query("COMMIT");
    } finally {
      await first.query("ROLLBACK");
      await second.query("ROLLBACK");
      first.release();
      second.release();
    }
    console.log(
      "ok - two independent PostgreSQL connections enforce shared transaction-scoped wallet locking"
    );

    phase = "application_setup";
    const policy = load("utils/rounds/video-policy.ts");
    const common = {
      pg: {
        Pool: function () {
          return isolatedPool;
        },
      },
      viem: { getAddress: (value) => value, isAddress: () => true },
      "@/utils/rounds/state": load("utils/rounds/state.ts"),
      "@/utils/rounds/getCollectiveNounVotingPower": {},
      "@/utils/rounds/voting-snapshot": load("utils/rounds/voting-snapshot.ts"),
      "data/noundry/submissions": {},
      "@/utils/rounds/validateRoundVote": load(
        "utils/rounds/validateRoundVote.ts"
      ),
      "@/utils/noundry/round-trait-submission": {},
      "@/utils/url-safety": {
        normalizeSafeImageUrl: (value) => String(value || ""),
        normalizeSafeProjectUrl: (value) => String(value || ""),
      },
      "data/dummy-content": {},
      "@/utils/rounds/voting-strategy": load("utils/rounds/voting-strategy.ts"),
      "data/ens": {},
      "@/utils/rounds/submission-images": load(
        "utils/rounds/submission-images.ts"
      ),
      "@/utils/rounds/video-storage": {
        videosEnabled: () => true,
        videoUploadPost: async (key) => ({
          fields: { key },
          url: "https://example.invalid",
        }),
      },
      "@/utils/rounds/video-policy": policy,
    };
    const rounds = load("data/rounds.ts", common);
    const videos = load("data/round-videos.ts", {
      ...common,
      "./rounds": rounds,
    });
    const round = await rounds.getRoundById("synthetic-round");
    const payload = (wallet) => ({
      walletAddress: wallet,
      title: "Synthetic entry",
      description: "A synthetic database integration submission.",
      images: ["https://example.invalid/cover.png"],
      image: "https://example.invalid/cover.png",
    });
    phase = "reservation_race";
    const racing = await Promise.allSettled([
      videos.reserveRoundVideo(round, "synthetic-wallet-a"),
      videos.reserveRoundVideo(round, "synthetic-wallet-a"),
    ]);
    assert.equal(
      racing.filter((result) => result.status === "fulfilled").length,
      1
    );
    assert.equal(
      (
        await isolatedPool.query(
          "SELECT count(*)::int AS count FROM round_video_uploads WHERE wallet_address='synthetic-wallet-a'"
        )
      ).rows[0].count,
      1
    );
    const reservation = racing.find(
      (result) => result.status === "fulfilled"
    ).value;
    const metadata = {
      objectKey: `round-videos/approved/${reservation.id}.mp4`,
      bytes: 1024,
      duration: 10,
      width: 640,
      height: 480,
    };
    await isolatedPool.query(
      "UPDATE round_video_uploads SET status='ready',metadata=$2::jsonb WHERE id=$1",
      [reservation.id, JSON.stringify(metadata)]
    );
    await assert.rejects(
      rounds.createRoundSubmission(round, {
        ...payload("synthetic-wallet-other"),
        videoUploadId: reservation.id,
      }),
      /belongs to another wallet/
    );
    await assert.rejects(
      rounds.createRoundSubmission(round, payload("synthetic-wallet-a")),
      /limit/
    );
    phase = "attachment_race";
    const attach = await Promise.allSettled([
      rounds.createRoundSubmission(round, {
        ...payload("synthetic-wallet-a"),
        videoUploadId: reservation.id,
      }),
      rounds.createRoundSubmission(round, {
        ...payload("synthetic-wallet-a"),
        videoUploadId: reservation.id,
      }),
    ]);
    assert.equal(
      attach.filter((result) => result.status === "fulfilled").length,
      1
    );
    const attached = (
      await isolatedPool.query(
        "SELECT status,submission_id FROM round_video_uploads WHERE id=$1",
        [reservation.id]
      )
    ).rows[0];
    assert.equal(attached.status, "attached");
    const saved = (
      await isolatedPool.query(
        "SELECT video FROM round_submissions WHERE id=$1",
        [attached.submission_id]
      )
    ).rows[0];
    assert.deepEqual(saved.video, metadata);
    console.log(
      "ok - actual reservation/attachment functions deny parallel quota bypass, wrong owner, image slot theft and video reuse"
    );
    phase = "image_races";
    const imageRace = await Promise.allSettled([
      rounds.createRoundSubmission(round, payload("synthetic-wallet-image")),
      rounds.createRoundSubmission(round, payload("synthetic-wallet-image")),
    ]);
    assert.equal(
      imageRace.filter((result) => result.status === "fulfilled").length,
      1
    );
    const reserveImageRace = await Promise.allSettled([
      videos.reserveRoundVideo(round, "synthetic-wallet-mixed"),
      rounds.createRoundSubmission(round, payload("synthetic-wallet-mixed")),
    ]);
    assert.equal(
      reserveImageRace.filter((result) => result.status === "fulfilled").length,
      1
    );
    console.log(
      "ok - actual image/image and reservation/image races preserve one-slot admission across independent connections"
    );
    console.log(
      JSON.stringify({
        result: "passed",
        targetFingerprint: target.fingerprint,
        serverFingerprint,
        postgresVersion: identity.version,
        migrationSha256: sha256(migration),
        providerCalls: 0,
      })
    );
  }
} catch (error) {
  console.error(
    JSON.stringify({
      result: "failed",
      phase,
      code: typeof error.code === "string" ? error.code : "REHEARSAL_FAILED",
    })
  );
  process.exitCode = 1;
} finally {
  if (isolatedPool) await isolatedPool.end();
  if (schema) {
    assert.match(schema, /^round_video_rehearsal_[a-f0-9]{12}$/);
    try {
      await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
    } catch {
      console.error(
        "Rehearsal schema cleanup failed; operator review required."
      );
      process.exitCode = 1;
    }
  }
  await admin.end();
}
