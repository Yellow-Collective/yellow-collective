import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const loadTsModule = (filePath) => {
  const source = readFileSync(filePath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  });
  const module = { exports: {} };

  vm.runInNewContext(transpiled.outputText, {
    require,
    module,
    exports: module.exports,
    Date,
    Map,
  });

  return module.exports;
};

const {
  createRoundSubmissionsCsv,
  getRoundSubmissionPlacements,
  getRoundSubmissionsCsvFilename,
} = loadTsModule(
  resolve(process.cwd(), "utils/rounds/admin-submissions-export.ts")
);

const round = {
  id: "round-1",
  slug: "yellow-test-round",
  votingEndsAt: "2026-01-01T00:00:00.000Z",
};

const submissions = [
  {
    id: "submission-a",
    walletAddress: "0x1111111111111111111111111111111111111111",
    title: 'Alpha, "Poster"',
    status: "approved",
    createdAt: "2025-12-01T00:00:00.000Z",
    voteCount: 5,
  },
  {
    id: "submission-b",
    walletAddress: "0x2222222222222222222222222222222222222222",
    title: "Beta\nVideo",
    status: "approved",
    createdAt: "2025-12-02T00:00:00.000Z",
    voteCount: 9,
  },
  {
    id: "submission-c",
    walletAddress: "0x3333333333333333333333333333333333333333",
    title: "Rejected project",
    status: "rejected",
    createdAt: "2025-12-03T00:00:00.000Z",
    voteCount: 99,
  },
];

const profiles = [
  {
    walletAddress: "0x1111111111111111111111111111111111111111",
    username: "alice",
  },
  {
    walletAddress: "0x2222222222222222222222222222222222222222",
    username: "bob",
  },
];

const placements = getRoundSubmissionPlacements(round, submissions);
assert.equal(placements.get("submission-b"), 1);
assert.equal(placements.get("submission-a"), 2);
assert.equal(placements.get("submission-c"), undefined);

const csv = createRoundSubmissionsCsv({
  round,
  submissions,
  profiles,
});

assert.match(
  csv,
  /^Username,Wallet Address,Project Title,Date Submitted,Place After Voting\n/
);
assert.match(
  csv,
  /alice,0x1111111111111111111111111111111111111111,"Alpha, ""Poster""",2025-12-01T00:00:00.000Z,2/
);
assert.match(
  csv,
  /bob,0x2222222222222222222222222222222222222222,"Beta\nVideo",2025-12-02T00:00:00.000Z,1/
);
assert.match(
  csv,
  /0x3333333333333333333333333333333333333333,Rejected project,2025-12-03T00:00:00.000Z,$/
);

const futureCsv = createRoundSubmissionsCsv({
  round: { ...round, votingEndsAt: "2999-01-01T00:00:00.000Z" },
  submissions,
  profiles,
});
assert.doesNotMatch(futureCsv, /,1\n/);
assert.doesNotMatch(futureCsv, /,2\n/);

assert.equal(
  getRoundSubmissionsCsvFilename({
    id: "fallback-id",
    slug: "Yellow Round! 01",
  }),
  "yellow-round-01-submissions.csv"
);

console.log("ok - round submissions CSV export");
