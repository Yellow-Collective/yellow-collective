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
    URL,
    Buffer,
    atob,
    process: { env: { DATABASE_URL: "postgres://synthetic" } },
    console: { error() {} },
    require: (key) =>
      key in overrides
        ? overrides[key]
        : key.startsWith("@/") || key.startsWith("data/")
          ? {}
          : require(key),
  });
  return module.exports;
};
const policy = load("utils/rounds/submission-edit.ts");
const round = {
  status: "published",
  active: true,
  votingStartsAt: "2030-01-01T00:00:00Z",
};
const entry = {
  walletAddress: "wallet",
  status: "approved",
  userEditedAt: null,
};
assert.equal(
  policy.canEditRoundSubmission(round, entry, "WALLET", new Date("2029-01-01")),
  true
);
for (const changed of [
  { userEditedAt: "2029-01-01" },
  { status: "hidden" },
  { status: "rejected" },
  { deletedAt: "2029-01-01" },
  { walletAddress: "other" },
]) {
  assert.equal(
    policy.canEditRoundSubmission(
      round,
      { ...entry, ...changed },
      "wallet",
      new Date("2029-01-01")
    ),
    false
  );
}
assert.equal(
  policy.canEditRoundSubmission(round, entry, "wallet", new Date("2030-01-01")),
  false
);
assert.equal(
  policy.canEditRoundSubmission(
    { ...round, active: false },
    entry,
    "wallet",
    new Date("2029-01-01")
  ),
  false
);
for (const input of [
  null,
  [],
  { walletAddress: "other" },
  { title: 1 },
  { images: [] },
  { videoUploadId: "new" },
  { userEditedAt: null },
  { sourcePayload: {} },
  { title: "OK", traitId: "other" },
]) {
  assert.throws(() => policy.parseRoundSubmissionEdit(input));
}
assert.equal(
  policy.parseRoundSubmissionEdit({
    title: "Changed",
    images: ["https://example.invalid/image.gif"],
  }).title,
  "Changed"
);
console.log("ok - owner edit eligibility and strict editable-field allowlist");
const images = load("utils/rounds/submission-images.ts");
const urls = load("utils/url-safety.ts");
const trait = load("utils/noundry/round-trait-submission.ts");
const cover = "https://example.invalid/cover.png";
function fixture(options = {}) {
  const roundRow = {
    id: "round",
    slug: "test",
    status: "published",
    active: true,
    voting_starts_at: "2030-01-01",
    min_title_length: 1,
    max_title_length: 100,
    min_description_length: 1,
    max_description_length: 1000,
    ...options.round,
  };
  const state = {
    row: {
      id: "entry",
      round_id: "round",
      wallet_address: "wallet",
      title: "Original",
      description: "Description",
      image: cover,
      images: [cover],
      url: "",
      submission_type: "project",
      source: "project",
      source_payload: { original: true },
      video: { objectKey: "original.mp4" },
      status: "approved",
      user_edited_at: null,
      ...options.entry,
    },
    updates: 0,
    commits: 0,
    rollbacks: 0,
    locks: [],
    releases: 0,
  };
  let locked = false;
  const waiting = [];
  const acquire = () =>
    new Promise((resolve) => {
      if (locked) waiting.push(resolve);
      else {
        locked = true;
        resolve();
      }
    });
  const unlock = () => {
    const next = waiting.shift();
    if (next) next();
    else locked = false;
  };
  const readOwned = (args) =>
    args[0] === state.row.round_id &&
    args[1] === state.row.id &&
    args[2].toLowerCase() === state.row.wallet_address.toLowerCase() &&
    !state.row.deleted_at;
  const pool = {
    query: async (sql, args = []) => {
      if (sql.includes("FROM rounds r"))
        return {
          rows:
            args[0] === roundRow.slug || args[0] === roundRow.id
              ? [roundRow]
              : [],
        };
      if (sql.includes("SELECT s.* FROM round_submissions") && args.length === 3)
        return {
          rows:
            readOwned(args) &&
            ["approved", "pending"].includes(state.row.status)
              ? [state.row]
              : [],
        };
      if (sql.includes("SELECT s.*") && args.length === 2)
        return {
          rows:
            args[0] === roundRow.id &&
            args[1] === state.row.wallet_address &&
            ["approved", "pending"].includes(state.row.status)
              ? [state.row]
              : [],
        };
      if (sql.includes("FROM round_submissions s"))
        return {
          rows: args[0] === "round" && args[1] === "entry" ? [state.row] : [],
        };
      if (
        sql.includes("UPDATE round_submissions") &&
        sql.includes("images = $7::jsonb")
      ) {
        state.row.title = args[3];
        return { rows: [{ id: "entry" }] };
      }
      return { rows: [], rowCount: 0 };
    },
    connect: async () => {
      let hasLock = false,
        transaction;
      return {
        release() {
          state.releases++;
          if (hasLock) unlock();
        },
        query: async (sql, args = []) => {
          if (sql === "BEGIN" || sql.startsWith("SET LOCAL"))
            return { rows: [] };
          if (sql.includes("FROM rounds WHERE slug=")) {
            state.locks.push("round");
            assert.match(sql, /FOR SHARE/);
            return {
              rows:
                args[0] === roundRow.slug && !roundRow.deleted_at
                  ? [roundRow]
                  : [],
            };
          }
          if (sql.includes("FOR UPDATE")) {
            state.locks.push("submission");
            await acquire();
            hasLock = true;
            transaction = { ...state.row };
            return { rows: readOwned(args) ? [transaction] : [] };
          }
          if (sql.includes("UPDATE round_submissions AS s")) {
            assert.match(sql, /user_edited_at IS NULL/);
            assert.match(sql, /clock_timestamp\(\) < r\.voting_starts_at/);
            assert.doesNotMatch(
              sql.split("FROM rounds")[0],
              /wallet_address=|source_payload=|video=|status=/
            );
            if (options.expireAtUpdate || transaction.user_edited_at)
              return { rows: [] };
            state.updates++;
            Object.assign(transaction, {
              title: args[3],
              description: args[4],
              image: args[5],
              images: JSON.parse(args[6]),
              url: args[7],
              user_edited_at: "2026-10-15T12:00:00Z",
            });
            return { rows: [transaction] };
          }
          if (sql === "COMMIT") {
            state.commits++;
            state.row = transaction;
            return { rows: [] };
          }
          if (sql === "ROLLBACK") {
            state.rollbacks++;
            return { rows: [] };
          }
          throw new Error(`Unexpected fixture query: ${sql}`);
        },
      };
    },
  };
  const rounds = load("data/rounds.ts", {
    pg: {
      Pool: function () {
        return pool;
      },
    },
    viem: { getAddress: (value) => value, isAddress: () => true },
    "@/utils/rounds/submission-images": images,
    "@/utils/rounds/submission-edit": policy,
    "@/utils/url-safety": urls,
    "@/utils/noundry/round-trait-submission": trait,
    "@/utils/rounds/voting-snapshot": {
      isRoundVotingSnapshotMode: () => false,
    },
  });
  return { rounds, state };
}
const success = fixture();
const saved = await success.rounds.editOwnedRoundSubmission(
  "test",
  "entry",
  "wallet",
  { title: "Changed", images: [cover, "https://example.invalid/extra.gif"] }
);
assert.equal(saved.title, "Changed");
assert.ok(saved.userEditedAt);
assert.equal(success.state.row.source_payload.original, true);
assert.equal(success.state.row.video.objectKey, "original.mp4");
assert.equal(success.state.row.wallet_address, "wallet");
assert.equal(success.state.row.status, "approved");
assert.deepEqual(success.state.locks, ["round", "submission"]);
await assert.rejects(
  success.rounds.editOwnedRoundSubmission("test", "entry", "wallet", {
    title: "Again",
  }),
  /once/
);
assert.equal(success.state.updates, 1);
await success.rounds.updateRoundSubmission("round", "entry", {
  title: "Admin edit",
});
assert.ok(
  success.state.row.user_edited_at,
  "Admin edits must not reset owner edit ledger"
);
console.log(
  "ok - narrow atomic owner update preserves source/video/status; admin edit preserves consumed ledger"
);
for (const options of [
  { entry: { status: "hidden" } },
  { entry: { status: "rejected" } },
  { entry: { deleted_at: "2026-01-01" } },
  { entry: { user_edited_at: "2026-01-01" } },
  { round: { status: "archived" } },
  { round: { active: false } },
  { round: { status: "draft" } },
  { round: { deleted_at: "2026-01-01" } },
  { round: { voting_starts_at: "2020-01-01" } },
  { expireAtUpdate: true },
]) {
  const denied = fixture(options);
  await assert.rejects(
    denied.rounds.editOwnedRoundSubmission("test", "entry", "wallet", {
      title: "Changed",
    })
  );
  assert.equal(denied.state.commits, 0);
  assert.equal(denied.state.updates, 0);
}
for (const [slug, id, wallet] of [
  ["test", "entry", "other"],
  ["wrong", "entry", "wallet"],
  ["test", "other-entry", "wallet"],
]) {
  const denied = fixture();
  await assert.rejects(
    denied.rounds.editOwnedRoundSubmission(slug, id, wallet, {
      title: "Changed",
    })
  );
  assert.equal(denied.state.commits, 0);
}
console.log(
  "ok - owner, resource, moderation, deletion, edit-use and round deadline checks reject without consumption"
);
for (const changes of [
  { title: "" },
  { title: "Original" },
  { images: [] },
  { images: ["javascript:alert(1)"] },
  { images: ["data:image/gif;base64,PHNjcmlwdD4="] },
  { walletAddress: "other" },
  { userEditedAt: null },
  { videoUploadId: "new" },
]) {
  const invalid = fixture();
  await assert.rejects(
    invalid.rounds.editOwnedRoundSubmission("test", "entry", "wallet", changes)
  );
  assert.equal(invalid.state.commits, 0);
  assert.equal(invalid.state.row.user_edited_at, null);
}
const pending = fixture({ entry: { status: "pending" } });
await pending.rounds.editOwnedRoundSubmission("test", "entry", "wallet", {
  title: "Changed",
});
assert.equal(pending.state.row.status, "pending");
console.log(
  "ok - invalid/no-op saves preserve allowance; pending status remains pending"
);
const concurrent = fixture();
const attempts = await Promise.allSettled([
  concurrent.rounds.editOwnedRoundSubmission("test", "entry", "wallet", {
    title: "First",
  }),
  concurrent.rounds.editOwnedRoundSubmission("test", "entry", "wallet", {
    title: "Second",
  }),
]);
assert.equal(
  attempts.filter((value) => value.status === "fulfilled").length,
  1
);
assert.equal(concurrent.state.commits, 1);
assert.equal(concurrent.state.releases, 2);
console.log(
  "ok - serialized concurrent fixture attempts have one successful edit (model, not PostgreSQL concurrency proof)"
);
const svg = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1" fill="yellow" /></svg>').toString("base64")}`;
const traitEntry = {
  submission_type: "trait",
  source: "noundry",
  trait_id: "trait-one",
  trait_type: "head",
  image: svg,
  images: [svg],
  url: "/noundry/traits/trait-one",
};
const derived = fixture({ entry: traitEntry });
await derived.rounds.editOwnedRoundSubmission("test", "entry", "wallet", {
  description: "A custom trait description",
});
assert.equal(derived.state.row.image, svg);
assert.equal(derived.state.row.images[0], svg);
assert.equal(derived.state.row.trait_id, "trait-one");
assert.equal(derived.state.row.url, "/noundry/traits/trait-one");
for (const changes of [
  { images: [cover] },
  { url: "https://example.invalid/new" },
]) {
  const denied = fixture({ entry: traitEntry });
  await assert.rejects(
    denied.rounds.editOwnedRoundSubmission("test", "entry", "wallet", changes),
    /Trait edits/
  );
}
assert.equal(
  trait.isRoundTraitAutoDescription({
    submissionType: "trait",
    traitType: "head",
    walletAddress: "wallet",
    description: "Custom",
    userEditedAt: "2026-10-15",
    sourcePayload: { roundSubmissionAutoDescription: true },
  }),
  false
);
console.log(
  "ok - Noundry text edits preserve canonical SVG/link/source and custom descriptions render"
);
const reads = fixture();
assert.equal(
  await reads.rounds.getOwnedRoundSubmission("test", "entry", "other"),
  null
);
assert.equal(
  (await reads.rounds.getOwnedRoundSubmission("test", "entry", "wallet")).id,
  "entry"
);
const summaries = await reads.rounds.listOwnedRoundSubmissionSummaries(
  "test",
  "wallet"
);
assert.equal(summaries.length, 1);
assert.deepEqual(Array.from(summaries[0].images), [cover]);
assert.equal(summaries[0].description, "Description");
assert.equal(summaries[0].image, cover);
assert.equal(
  (await reads.rounds.listOwnedRoundSubmissionSummaries("test", "other"))
    .length,
  0
);
console.log(
  "ok - private owner reads filter wallet and list full submission media"
);
let authWallet = "wallet",
  actualAction,
  dataCalls = 0;
const auth = {
  verifyRoundWalletSignedRequest: async ({ req, res, action }) => {
    actualAction = action;
    if (!authWallet) {
      res.status(401).json({ error: "Signed request required." });
      return undefined;
    }
    return authWallet;
  },
};
const apiFixture = fixture();
const apiData = {
  getOwnedRoundSubmission: async (...args) => {
    dataCalls++;
    return apiFixture.rounds.getOwnedRoundSubmission(...args);
  },
  listOwnedRoundSubmissionSummaries: async (...args) => {
    dataCalls++;
    return apiFixture.rounds.listOwnedRoundSubmissionSummaries(...args);
  },
  editOwnedRoundSubmission: async (...args) => {
    dataCalls++;
    return apiFixture.rounds.editOwnedRoundSubmission(...args);
  },
};
const api = load("pages/api/rounds/[slug]/submissions/[submissionId]/edit.ts", {
  "data/rounds": apiData,
  "@/utils/rounds/server-auth": auth,
  "@/utils/rounds/submission-edit": policy,
});
const listApi = load("pages/api/rounds/[slug]/my-submissions.ts", {
  "data/rounds": apiData,
  "@/utils/rounds/server-auth": auth,
});
const callApi = async (
  method,
  body = {},
  query = {},
  handler = api.default
) => {
  const res = {
    code: 0,
    payload: null,
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.code = code;
      return this;
    },
    json(value) {
      this.payload = value;
      return this;
    },
  };
  await handler(
    { method, query: { slug: "test", submissionId: "entry", ...query }, body },
    res
  );
  assert.match(res.headers["Cache-Control"], /no-store/);
  return res;
};
authWallet = null;
assert.equal((await callApi("GET")).code, 401);
assert.equal(
  (await callApi("PATCH", { submission: { title: "Changed" } })).code,
  401
);
assert.equal(dataCalls, 0);
authWallet = "other";
assert.equal((await callApi("GET", {}, { walletAddress: "wallet" })).code, 404);
assert.equal(
  (
    await callApi(
      "PATCH",
      { submission: { title: "Changed" } },
      { walletAddress: "wallet" }
    )
  ).code,
  404
);
authWallet = "wallet";
assert.equal((await callApi("GET")).code, 200);
assert.equal(actualAction, "submission-read");
assert.equal((await callApi("POST")).code, 405);
assert.equal(
  (await callApi("PATCH", { submission: { title: "Changed" }, admin: true }))
    .code,
  400
);
assert.equal(
  (await callApi("PATCH", { submission: { walletAddress: "other" } })).code,
  400
);
const apiSaved = await callApi("PATCH", {
  submission: { title: "API changed" },
});
assert.equal(apiSaved.code, 200);
assert.equal(actualAction, "edit");
assert.ok(apiSaved.payload.submission.userEditedAt);
assert.equal(apiSaved.payload.submission.sourcePayload, null);
assert.equal(
  (await callApi("PATCH", { submission: { title: "Again" } })).code,
  409
);
assert.equal((await callApi("GET", {}, {}, listApi.default)).code, 200);
assert.equal(actualAction, "submission-read");
console.log(
  "ok - signed API actions, owner-derived scope, no-store errors, method/extra-field denial and durable used-edit recovery"
);
const adminFirst = fixture();
await adminFirst.rounds.updateRoundSubmission("round", "entry", {
  title: "Admin edited first",
});
assert.equal(adminFirst.state.row.user_edited_at, null);
await adminFirst.rounds.editOwnedRoundSubmission("test", "entry", "wallet", {
  title: "Owner still has one edit",
});
assert.ok(adminFirst.state.row.user_edited_at);
console.log(
  "ok - admin changes before owner edit do not consume the owner allowance"
);
