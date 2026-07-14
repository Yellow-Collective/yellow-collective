import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
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
  });

  return module.exports;
};

const helperPath = resolve(process.cwd(), "utils/rounds/admin-votes.ts");
assert.equal(existsSync(helperPath), true, "admin vote helper must exist");

const {
  createAdminRoundVotesCsv,
  getAdminRoundVotesCsvFilename,
  parseAdminRoundVoteFilters,
  validateAdminRoundVoteCount,
} = loadTsModule(helperPath);

assert.equal(validateAdminRoundVoteCount(3), undefined);
assert.equal(validateAdminRoundVoteCount(0), "Vote count must be a positive integer.");
assert.equal(validateAdminRoundVoteCount(-1), "Vote count must be a positive integer.");
assert.equal(validateAdminRoundVoteCount(1.5), "Vote count must be a positive integer.");
assert.equal(validateAdminRoundVoteCount("3"), "Vote count must be a positive integer.");

assert.deepEqual(
  JSON.parse(
    JSON.stringify(
      parseAdminRoundVoteFilters({
        search: "  alpha  ",
        submissionId: " submission-1 ",
        walletAddress: " wallet ",
        sort: "highest",
        direction: "asc",
      })
    )
  ),
  {
    search: "alpha",
    submissionId: "submission-1",
    walletAddress: "wallet",
    sort: "highest",
    direction: "desc",
  }
);
assert.deepEqual(
  JSON.parse(
    JSON.stringify(
      parseAdminRoundVoteFilters({ sort: "unsafe", direction: "sideways" })
    )
  ),
  {
    search: "",
    submissionId: "",
    walletAddress: "",
    sort: "newest",
    direction: "desc",
  }
);

const csv = createAdminRoundVotesCsv({
  round: { id: "round-1", slug: "Yellow Round! 01", title: "Yellow Round" },
  votes: [
    {
      id: "vote-1",
      roundId: "round-1",
      walletAddress: "=HYPERLINK(\"https://bad.example\")",
      submissionId: "submission-1",
      submissionTitle: 'Alpha, "Poster"',
      submissionStatus: "hidden",
      submissionDeleted: true,
      voteCount: 4,
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-02T00:00:00.000Z",
    },
  ],
});

assert.ok(csv.startsWith("\ufeffVote ID,Round ID,Round Slug,Round Title"));
assert.match(csv, /"Alpha, ""Poster"""/);
assert.match(csv, /"'=HYPERLINK\(""https:\/\/bad\.example""\)"/);
assert.match(csv, /hidden,true/);
assert.equal(
  getAdminRoundVotesCsvFilename({ id: "round-1", slug: "Yellow Round! 01" }),
  "yellow-round-01-votes.csv"
);

const dataSource = readFileSync(resolve(process.cwd(), "data/rounds.ts"), "utf8");
assert.match(dataSource, /export const listAdminRoundVotes/);
assert.match(dataSource, /LEFT JOIN round_submissions/);
assert.match(dataSource, /round_vote_admin_audit/);
assert.match(dataSource, /pg_advisory_xact_lock/);
assert.match(dataSource, /before_state/);
assert.match(dataSource, /after_state/);
assert.match(dataSource, /export const updateAdminRoundVote/);
assert.match(dataSource, /export const removeAdminRoundVote/);

const listRoutePath = resolve(
  process.cwd(),
  "pages/api/admin/rounds/[id]/votes/index.ts"
);
const mutationRoutePath = resolve(
  process.cwd(),
  "pages/api/admin/rounds/[id]/votes/[voteId].ts"
);
const exportRoutePath = resolve(
  process.cwd(),
  "pages/api/admin/rounds/[id]/votes/export.ts"
);

for (const routePath of [listRoutePath, mutationRoutePath, exportRoutePath]) {
  assert.equal(existsSync(routePath), true, `${routePath} must exist`);
  const source = readFileSync(routePath, "utf8");
  assert.match(source, /requireAdminRequest\(req, res, "rounds"\)/);
}

const mutationSource = readFileSync(mutationRoutePath, "utf8");
assert.match(mutationSource, /req\.method !== "PATCH" && req\.method !== "DELETE"/);
assert.match(mutationSource, /validateAdminRoundVoteCount/);
assert.match(mutationSource, /updateAdminRoundVote/);
assert.match(mutationSource, /removeAdminRoundVote/);

const exportSource = readFileSync(exportRoutePath, "utf8");
assert.match(exportSource, /text\/csv; charset=utf-8/);
assert.match(exportSource, /createAdminRoundVotesCsv/);
assert.match(exportSource, /Content-Disposition/);

const dashboardSource = readFileSync(
  resolve(process.cwd(), "pages/admin/dashboard.tsx"),
  "utf8"
);
assert.match(dashboardSource, /Submissions/);
assert.match(dashboardSource, /Votes \(/);
assert.match(dashboardSource, /Export votes CSV/);
assert.match(dashboardSource, /Edit vote/);
assert.match(dashboardSource, /Delete vote/);
assert.match(dashboardSource, /getProfilePath/);
assert.match(dashboardSource, /window\.confirm/);
const voteEditorSource = dashboardSource.slice(
  dashboardSource.indexOf("const RoundVoteEditorModal"),
  dashboardSource.indexOf("const RoundSubmissionModal")
);
assert.match(voteEditorSource, /type="number"[\s\S]*disabled=\{isSaving\}/);
assert.match(voteEditorSource, /maxLength=\{1000\}[\s\S]*disabled=\{isSaving\}/);

console.log("ok - admin round vote management");
