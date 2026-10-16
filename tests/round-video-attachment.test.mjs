import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import vm from "node:vm";
const require = createRequire(import.meta.url);
const ts = require("typescript");
const load = (path, overrides = {}) => {
  const module = { exports: {} };
  const { outputText } = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  });
  vm.runInNewContext(outputText, {
    module,
    exports: module.exports,
    Error,
    require: (key) => (key in overrides ? overrides[key] : require(key)),
    process: { env: { DATABASE_URL: "postgres://synthetic" } },
  });
  return module.exports;
};
const policy = load("utils/rounds/video-policy.ts");
const images = load("utils/rounds/submission-images.ts");
const uploadId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const metadata = {
  objectKey: `round-videos/approved/${uploadId}.mp4`,
  bytes: 1024,
  duration: 10,
  width: 640,
  height: 480,
};
const round = {
  id: "round",
  status: "published",
  active: true,
  maxSubmissionsPerWallet: 1,
  minTitleLength: 1,
  maxTitleLength: 100,
  minDescriptionLength: 1,
  maxDescriptionLength: 1000,
};
const input = {
  walletAddress: "wallet",
  title: "Video entry",
  description: "A valid entry.",
  image: "https://example.invalid/cover.png",
  images: ["https://example.invalid/cover.png"],
  videoUploadId: uploadId,
};

function fixture({
  owner = "wallet",
  status = "ready",
  expired = false,
  enabled = true,
  closeRound = false,
  failConsume = false,
  videoRound = "round",
  failRead = false,
  failCommit = false,
} = {}) {
  const state = {
    upload: {
      id: uploadId,
      round_id: videoRound,
      wallet_address: owner,
      status,
      expires_at: expired ? 0 : Date.now() + 100000,
      metadata,
    },
    submissions: [],
    insertAttempts: 0,
    released: 0,
    commits: 0,
    rollbacks: 0,
  };
  const pool = {
    query: async (sql, args = []) => {
      if (sql.includes("FROM round_submissions s")) {
        assert.equal(
          state.released,
          1,
          "Post-commit read must follow client release"
        );
        if (failRead) throw new Error("Read failed");
        return { rows: state.submissions.filter((row) => row.id === args[1]) };
      }
      return { rows: [], rowCount: 0 };
    },
    connect: async () => {
      let transaction;
      return {
        release() {
          state.released++;
        },
        query: async (sql, args = []) => {
          if (sql === "BEGIN") {
            transaction = {
              submissions: [...state.submissions],
              upload: { ...state.upload },
            };
            return { rows: [] };
          }
          if (sql === "COMMIT") {
            if (failCommit) throw new Error("Commit response lost");
            state.submissions = transaction.submissions;
            state.upload = transaction.upload;
            state.commits++;
            return { rows: [] };
          }
          if (sql === "ROLLBACK") {
            state.rollbacks++;
            return { rows: [] };
          }
          if (sql.includes("SELECT * FROM rounds"))
            return {
              rows: [
                {
                  id: "round",
                  status: closeRound ? "archived" : "published",
                  active: !closeRound,
                  max_submissions_per_wallet: 1,
                },
              ],
            };
          if (sql.includes("SELECT metadata FROM round_video_uploads")) {
            const row = transaction.upload;
            return {
              rows:
                row.id === args[0] &&
                row.round_id === args[1] &&
                row.wallet_address.toLowerCase() === args[2].toLowerCase() &&
                row.status === "ready" &&
                row.expires_at > Date.now()
                  ? [{ metadata: row.metadata }]
                  : [],
              get rowCount() {
                return this.rows.length;
              },
            };
          }
          if (
            sql.includes("COUNT(*)::int AS count") &&
            sql.includes("FROM round_submissions")
          )
            return { rows: [{ count: transaction.submissions.length }] };
          if (
            sql.includes(
              "SELECT count(*)::int AS count FROM round_video_uploads"
            )
          ) {
            const row = transaction.upload;
            return {
              rows: [
                {
                  count:
                    row.round_id === args[0] &&
                    row.wallet_address.toLowerCase() ===
                      args[1].toLowerCase() &&
                    ["pending", "validating", "ready"].includes(row.status) &&
                    row.expires_at > Date.now() &&
                    row.id !== args[2]
                      ? 1
                      : 0,
                },
              ],
            };
          }
          if (sql.includes("INSERT INTO round_submissions")) {
            state.insertAttempts++;
            transaction.submissions.push({
              id: args[0],
              round_id: args[1],
              wallet_address: args[2],
              title: args[3],
              description: args[4],
              image: args[5],
              images: JSON.parse(args[6]),
              url: args[7],
              status: "approved",
            });
            return { rows: [{ id: args[0] }] };
          }
          if (sql.includes("UPDATE round_submissions SET video")) {
            transaction.submissions.find((row) => row.id === args[0]).video =
              JSON.parse(args[1]);
            return { rows: [] };
          }
          if (
            sql.includes("UPDATE round_video_uploads SET status='attached'")
          ) {
            if (failConsume) throw new Error("Consume failed");
            transaction.upload.status = "attached";
            transaction.upload.submission_id = args[1];
            return { rows: [] };
          }
          return { rows: [] };
        },
      };
    },
  };
  const modules = {
    pg: {
      Pool: function () {
        return pool;
      },
    },
    viem: { getAddress: (value) => value, isAddress: () => true },
    "@/utils/rounds/state": {
      getRoundState: (value) =>
        value.status === "published" && value.active
          ? "submissions_open"
          : "archived",
    },
    "@/utils/rounds/getCollectiveNounVotingPower": {},
    "@/utils/rounds/voting-snapshot": {
      isRoundVotingSnapshotMode: () => false,
    },
    "data/noundry/submissions": {},
    "@/utils/rounds/validateRoundVote": {},
    "@/utils/noundry/round-trait-submission": {},
    "@/utils/url-safety": {
      normalizeSafeImageUrl: (value) => String(value || ""),
      normalizeSafeProjectUrl: (value) => String(value || ""),
    },
    "data/dummy-content": {},
    "@/utils/rounds/voting-strategy": {},
    "data/ens": {},
    "@/utils/rounds/submission-images": images,
    "@/utils/rounds/submission-edit": load("utils/rounds/submission-edit.ts"),
    "@/utils/rounds/video-storage": { videosEnabled: () => enabled },
    "@/utils/rounds/video-policy": policy,
  };
  return { state, rounds: load("data/rounds.ts", modules) };
}

for (const options of [
  { owner: "other" },
  { videoRound: "other-round" },
  { status: "pending" },
  { expired: true },
  { enabled: false },
  { closeRound: true },
]) {
  const { state, rounds } = fixture(options);
  await assert.rejects(rounds.createRoundSubmission(round, input));
  assert.equal(state.insertAttempts, 0);
  assert.equal(state.commits, 0);
  assert.equal(state.upload.status, options.status || "ready");
}
console.log(
  "ok - attachment rejects wrong owner, unready, expired, disabled and closed-round uploads before inserting"
);

const accepted = fixture();
const created = await accepted.rounds.createRoundSubmission(round, input);
assert.equal(created.video.objectKey, metadata.objectKey);
assert.equal(accepted.state.upload.status, "attached");
assert.equal(accepted.state.upload.submission_id, created.id);
assert.equal(accepted.state.commits, 1);
await assert.rejects(accepted.rounds.createRoundSubmission(round, input));
assert.equal(accepted.state.insertAttempts, 1);
console.log(
  "ok - video metadata and consumed reservation commit together; same upload cannot attach twice"
);

const imageOnly = fixture({ status: "pending" });
const withoutVideo = { ...input };
delete withoutVideo.videoUploadId;
await assert.rejects(
  imageOnly.rounds.createRoundSubmission(round, withoutVideo),
  /limit/
);
assert.equal(imageOnly.state.insertAttempts, 0);
const noReservation = fixture({ status: "cancelled", enabled: false });
await noReservation.rounds.createRoundSubmission(round, withoutVideo);
assert.equal(noReservation.state.submissions.length, 1);
console.log(
  "ok - image submissions count outstanding reservations; own ready video reservation is excluded for attachment"
);

const failedConsume = fixture({ failConsume: true });
await assert.rejects(
  failedConsume.rounds.createRoundSubmission(round, input),
  /Consume failed/
);
assert.equal(failedConsume.state.submissions.length, 0);
assert.equal(failedConsume.state.upload.status, "ready");
assert.equal(failedConsume.state.rollbacks, 1);
console.log(
  "ok - failed reservation consumption rolls back inserted submission and preserves readiness"
);

const failedRead = fixture({ failRead: true });
await assert.rejects(
  failedRead.rounds.createRoundSubmission(round, input),
  /Read failed/
);
assert.equal(failedRead.state.commits, 1);
assert.equal(failedRead.state.rollbacks, 0);
assert.equal(failedRead.state.released, 1);
assert.equal(failedRead.state.submissions.length, 1);
console.log(
  "ok - post-commit reread runs after release and reread failure never rolls back committed data"
);

for (const [options, expected] of [[{ failConsume: true }, "not_saved"], [{ failRead: true }, "unknown"], [{ failCommit: true }, "unknown"]]) {
  const f = fixture(options);
  await assert.rejects(f.rounds.createRoundSubmission(round, input), error => {
    assert.equal(error.outcome, expected); return true;
  });
  const response = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  // Use a fresh transaction fixture for the API because a readback failure has already committed.
  const fresh = fixture(options);
  const freshApi = load("pages/api/rounds/[slug]/submit.ts", {
    "data/rounds": { ...fresh.rounds, getRoundBySlug: async () => round },
    "@/utils/rounds/server-auth": { verifyRoundWalletSignedRequest: async () => "wallet" },
  }).default;
  await freshApi({ method: "POST", query: { slug: "round" }, body: { submission: input } }, response);
  assert.equal(response.body.outcome, expected);
  assert.equal(response.code, 400);
}
const invalid = fixture();
await assert.rejects(invalid.rounds.createRoundSubmission(round, { ...input, title: "" }), error => error.outcome === "not_saved");
assert.equal(invalid.state.insertAttempts, 0);
console.log("ok - submit outcome distinguishes validation/rollback from attempted commit and committed readback failure");
