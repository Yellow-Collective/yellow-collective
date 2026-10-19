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
    atob,
    URL,
    Buffer,
    console: { error() {} },
    process: { env: { DATABASE_URL: "postgres://synthetic" } },
    require: (key) =>
      key in overrides
        ? overrides[key]
        : key.startsWith("@/") || key.startsWith("data/")
          ? {}
          : require(key),
  });
  return module.exports;
};
const cover = "https://example.invalid/cover.png";
const gif =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
const images = load("utils/rounds/submission-images.ts");
const urlSafety = load("utils/url-safety.ts");
const processing = load("utils/rounds/image-processing.ts");
const prepareImages = load("utils/rounds/prepare-image-assets.ts", { "./image-processing": processing });
const state = {
  updates: 0,
  row: {
    id: "entry",
    round_id: "round",
    wallet_address: "wallet",
    title: "Entry",
    description: "Description",
    image: cover,
    images: [cover],
    status: "approved",
    url: "",
    source: "project",
    source_payload: {},
    vote_count: 12,
    video: { objectKey: "untouched" },
  },
};
const pool = {
  query: async (sql, args = []) => {
    if (sql.includes("FROM rounds r"))
      return {
        rows: [
          {
            id: "round",
            min_title_length: 1,
            max_title_length: 100,
            min_description_length: 1,
            max_description_length: 1000,
          },
        ],
      };
    if (sql.includes("FROM round_submissions s"))
      return {
        rows: args[0] === "round" && args[1] === "entry" ? [state.row] : [],
      };
    if (
      sql.includes("UPDATE round_submissions") &&
      sql.includes("images = $7::jsonb")
    ) {
      assert.equal(args[0], "round");
      assert.equal(args[1], "entry");
      state.updates++;
      Object.assign(state.row, {
        wallet_address: args[2],
        title: args[3],
        description: args[4],
        image: args[5],
        images: JSON.parse(args[6]),
        url: args[7],
      });
      return { rows: [{ id: "entry" }] };
    }
    return { rows: [], rowCount: 0 };
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
  "@/utils/url-safety": urlSafety,
  "@/utils/rounds/prepare-image-assets": prepareImages,
  "@/utils/rounds/voting-snapshot": { isRoundVotingSnapshotMode: () => false },
});
let session = null,
  permission = true;
const auth = load("utils/admin-api.ts", {
  "data/admin-access": {
    isAdminWalletAddress: async () => true,
    hasWalletAdminPermission: async (_, required) => {
      assert.equal(required, "rounds");
      return permission;
    },
  },
  "./admin-session": { getAdminSessionAddress: () => session },
  "./admin-auth": { getAdminSignedRequestAction: () => "admin" },
  "./signature-auth-server": {
    setNoStoreHeaders() {},
    verifySignedRequest: async (_, res) => {
      res.status(401).json({ error: "Unauthorized" });
      return null;
    },
  },
});
const api = load("pages/api/admin/rounds/[id]/submissions/[submissionId].ts", {
  "data/rounds": rounds,
  "@/utils/admin-api": auth,
});
const request = async (
  body,
  method = "PATCH",
  roundId = "round",
  submissionId = "entry"
) => {
  const res = {
    code: 0,
    payload: null,
    setHeader() {},
    status(code) {
      this.code = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
  await api.default(
    { method, query: { id: roundId, submissionId }, body },
    res
  );
  return res;
};
assert.equal(api.config.api.bodyParser.sizeLimit, "4mb");
assert.equal(
  (await request({ submission: { images: [cover, gif] } })).code,
  401
);
assert.equal(state.updates, 0);
session = "admin";
permission = false;
assert.equal(
  (await request({ submission: { images: [cover, gif] } })).code,
  403
);
assert.equal(state.updates, 0);
permission = true;
assert.equal((await request({}, "GET")).code, 405);
const saved = await request({ submission: { images: [cover, gif] } });
assert.equal(saved.code, 200);
assert.equal(state.updates, 1, "Saving media must perform one update");
assert.deepEqual(Array.from(saved.payload.submission.images), [cover, gif]);
assert.equal(saved.payload.submission.image, cover);
assert.equal(saved.payload.submission.voteCount, 12);
assert.equal(saved.payload.submission.video.objectKey, "untouched");
console.log(
  "ok - admin rounds permission guards and round-scoped ordered GIF persistence preserve cover, video and votes"
);
for (const invalid of [
  [],
  "not-an-array",
  [null],
  [""],
  [cover, "data:image/gif;base64,PHNjcmlwdD4="],
  Array(11).fill(cover),
  [cover, `data:image/gif;base64,${"a".repeat(1400000)}`],
]) {
  const before = state.updates;
  assert.equal((await request({ submission: { images: invalid } })).code, 400);
  assert.equal(state.updates, before);
}
assert.equal(
  (
    await request(
      { submission: { images: [cover, gif] } },
      "PATCH",
      "other-round"
    )
  ).code,
  404
);
console.log(
  "ok - malformed, oversized, excessive and wrong-round images cannot persist"
);
state.row.images = [
  cover,
  `https://example.invalid/${"a".repeat(3 * 1024 * 1024)}`,
];
const legacy = await request({ submission: { title: "Updated legacy entry" } });
assert.equal(legacy.code, 200);
assert.equal(legacy.payload.submission.images[1], state.row.images[1]);
console.log(
  "ok - metadata edits preserve legacy galleries above the new upload budget"
);
