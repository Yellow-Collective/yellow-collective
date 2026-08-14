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
    Date,
    Map,
  });

  return module.exports;
};

const {
  createRoundSubmissionsCsv,
  createRoundSubmissionsZipCsv,
  getRoundSubmissionArtworkFilename,
  getRoundSubmissionPlacements,
  getRoundSubmissionsCsvFilename,
  getRoundSubmissionsZipFilename,
  isRoundExportable,
} = loadTsModule(
  resolve(process.cwd(), "utils/rounds/admin-submissions-export.ts")
);

const round = {
  id: "round-1",
  slug: "yellow-test-round",
  votingEndsAt: "2026-01-01T00:00:00.000Z",
  awards: [
    {
      position: 1,
      title: "Grand Prize",
      value: "1 ETH",
      description: "Top voted project",
    },
    {
      position: 2,
      title: "Runner-up Prize",
      value: "0.5 ETH",
      description: "Second place project",
    },
  ],
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
  /^Username,Wallet Address,Project Title,Date Submitted,Place After Voting,Prize Title,Prize Value,Prize Description\n/
);
assert.match(
  csv,
  /alice,0x1111111111111111111111111111111111111111,"Alpha, ""Poster""",2025-12-01T00:00:00.000Z,2,Runner-up Prize,0.5 ETH,Second place project/
);
assert.match(
  csv,
  /bob,0x2222222222222222222222222222222222222222,"Beta\nVideo",2025-12-02T00:00:00.000Z,1,Grand Prize,1 ETH,Top voted project/
);
assert.match(
  csv,
  /0x3333333333333333333333333333333333333333,Rejected project,2025-12-03T00:00:00.000Z,,,,/
);

const futureCsv = createRoundSubmissionsCsv({
  round: { ...round, votingEndsAt: "2999-01-01T00:00:00.000Z" },
  submissions,
  profiles,
});
assert.doesNotMatch(futureCsv, /,1\n/);
assert.doesNotMatch(futureCsv, /,2\n/);
assert.doesNotMatch(futureCsv, /Grand Prize/);

assert.equal(
  getRoundSubmissionsCsvFilename({
    id: "fallback-id",
    slug: "Yellow Round! 01",
  }),
  "yellow-round-01-submissions.csv"
);

assert.equal(
  typeof isRoundExportable,
  "function",
  "ZIP export eligibility helper must be implemented"
);
assert.equal(
  typeof createRoundSubmissionsZipCsv,
  "function",
  "ZIP CSV helper must be implemented"
);
assert.equal(
  typeof getRoundSubmissionArtworkFilename,
  "function",
  "artwork filename helper must be implemented"
);
assert.equal(
  typeof getRoundSubmissionsZipFilename,
  "function",
  "ZIP filename helper must be implemented"
);

const eligibilityNow = new Date("2026-07-13T12:00:00.000Z");
assert.equal(
  isRoundExportable(
    {
      status: "published",
      votingEndsAt: "2026-07-13T11:59:59.000Z",
    },
    eligibilityNow
  ),
  true
);
assert.equal(
  isRoundExportable(
    {
      status: "archived",
      votingEndsAt: "2026-07-01T00:00:00.000Z",
    },
    eligibilityNow
  ),
  true
);
assert.equal(
  isRoundExportable(
    {
      status: "published",
      votingEndsAt: "2026-07-13T12:00:01.000Z",
    },
    eligibilityNow
  ),
  false
);
assert.equal(
  isRoundExportable(
    {
      status: "draft",
      votingEndsAt: "2026-01-01T00:00:00.000Z",
    },
    eligibilityNow
  ),
  false
);

const artworkFilenameA = getRoundSubmissionArtworkFilename({
  index: 0,
  submission: {
    id: "submission/A",
    title: "CON: Yellow / Poster ..",
  },
  contentType: "image/png",
});
const artworkFilenameB = getRoundSubmissionArtworkFilename({
  index: 1,
  submission: {
    id: "submission/B",
    title: "CON: Yellow / Poster ..",
  },
  contentType: "image/jpeg",
});
assert.equal(artworkFilenameA, "001-con-yellow-poster-submission-a.png");
assert.equal(artworkFilenameB, "002-con-yellow-poster-submission-b.jpg");
assert.notEqual(artworkFilenameA, artworkFilenameB);
assert.equal(
  getRoundSubmissionsZipFilename({ id: "fallback-id", slug: "Yellow Round! 01" }),
  "yellow-round-01-submissions.zip"
);

const zipRound = {
  id: "round-1",
  slug: "yellow-test-round",
  title: "Yellow Test Round",
};
const zipSubmissions = [
  {
    id: "submission-a",
    roundId: "round-1",
    walletAddress: "0x1111111111111111111111111111111111111111",
    title: "=HYPERLINK(\"https://bad.example\")",
    description: "Line one, quoted \"text\"\nLine two — 黄色",
    image: "https://cdn.example/art.png",
    url: "https://example.com/project",
    submissionType: "project",
    traitId: null,
    traitType: null,
    source: "project",
    sourcePayload: null,
    status: "approved",
    voteCount: 7,
    winnerPosition: 1,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-02T00:00:00.000Z",
    approvedAt: "2026-06-03T00:00:00.000Z",
    rejectedAt: null,
    hiddenAt: null,
  },
  {
    id: "submission-b",
    roundId: "round-1",
    walletAddress: "0x2222222222222222222222222222222222222222",
    title: "Poster Two",
    description: "No image available",
    image: "https://cdn.example/missing.png",
    url: "",
    submissionType: "trait",
    traitId: "trait-1",
    traitType: "head",
    source: "noundry",
    sourcePayload: { artist: "yellow" },
    status: "hidden",
    voteCount: 0,
    winnerPosition: null,
    createdAt: "2026-06-04T00:00:00.000Z",
    updatedAt: "2026-06-05T00:00:00.000Z",
    approvedAt: null,
    rejectedAt: null,
    hiddenAt: "2026-06-06T00:00:00.000Z",
  },
];
const zipCsv = createRoundSubmissionsZipCsv({
  round: zipRound,
  submissions: zipSubmissions,
  artworkResults: {
    "submission-a": {
      status: "exported",
      filename: "001-poster-submission-a.png",
      error: "",
    },
    "submission-b": {
      status: "failed",
      filename: "",
      error: "Artwork request returned 404.",
    },
  },
});
assert.ok(zipCsv.startsWith("\ufeffsubmission_id,round_id,round_slug"));
assert.match(zipCsv, /"'=HYPERLINK\(""https:\/\/bad\.example""\)"/);
assert.match(zipCsv, /"Line one, quoted ""text""\nLine two — 黄色"/);
assert.match(zipCsv, /artwork\/001-poster-submission-a\.png,exported,/);
assert.match(zipCsv, /submission-b[\s\S]*,failed,Artwork request returned 404\./);
assert.match(zipCsv, /"\{""artist"":""yellow""\}"/);

const zipRoutePath = resolve(
  process.cwd(),
  "pages/api/admin/rounds/[id]/export.ts"
);
assert.equal(existsSync(zipRoutePath), true, "protected ZIP API route must exist");
const zipRouteSource = readFileSync(zipRoutePath, "utf8");
assert.match(zipRouteSource, /req\.method !== "GET"/);
assert.match(zipRouteSource, /requireAdminRequest\(req, res, "rounds"\)/);
assert.match(zipRouteSource, /isRoundExportable\(round\)/);
assert.match(zipRouteSource, /application\/zip/);
assert.match(zipRouteSource, /private, no-store/);
assert.match(zipRouteSource, /archiver\("zip"/);

const dashboardSource = readFileSync(
  resolve(process.cwd(), "pages/admin/dashboard.tsx"),
  "utf8"
);
assert.match(dashboardSource, /Export submissions \(\.zip\)/);
assert.match(dashboardSource, /isRoundExportable\(round\)/);
assert.match(dashboardSource, /Preparing export…/);
assert.match(dashboardSource, /URL\.revokeObjectURL/);

console.log("ok - round submissions CSV export");
