import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const loadTsModule = (path, dependencies = {}) => {
  const source = readFileSync(path, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  const module = { exports: {} };

  vm.runInNewContext(output, {
    Date,
    module,
    exports: module.exports,
    require: (specifier) => dependencies[specifier] ?? require(specifier),
  });

  return module.exports;
};

const dashboard = loadTsModule(resolve(process.cwd(), "utils/dashboard.ts"), {
  "./getProposalName": {
    getProposalName: (description) => description.split("&&")[0],
  },
  "./proposal-routing": {
    getYellowProposalPath: ({ proposalNumber }) =>
      `/proposals/${proposalNumber}`,
  },
  "./rounds/state": {
    getRoundState: (round) => round.testState,
  },
  "data/snapshot": {
    parseNounsProposalNumber: ({ title }) => {
      const match = title.match(/^(?:Nouns\s*#?)?(\d+)\s*:/i);
      return match ? Number(match[1]) : null;
    },
  },
});
const snapshot = loadTsModule(resolve(process.cwd(), "data/snapshot.ts"), {
  "constants/metagov": {
    SNAPSHOT_GRAPHQL_URL: "https://example.com/graphql",
    SNAPSHOT_SPACE_ID: "yellow.eth",
    SNAPSHOT_SPACE_URL: "https://snapshot.org/#/yellow.eth",
  },
});

const round = (slug, testState, deadline) => ({
  id: slug,
  slug,
  title: slug,
  testState,
  votingStartsAt: deadline,
  votingEndsAt: deadline,
  approvedSubmissionCount: 2,
  totalVotes: 4,
});

test("filters every dashboard section and sorts the nearest deadline first", () => {
  const payload = dashboard.buildDashboardPayload({
    rounds: {
      data: [
        round("later-submit", "submissions_open", "2026-08-20T00:00:00Z"),
        round("vote", "voting_open", "2026-08-08T00:00:00Z"),
        round("closed", "ended", "2026-08-01T00:00:00Z"),
        round("soon-submit", "submissions_open", "2026-08-07T00:00:00Z"),
      ],
    },
    yellowProposals: {
      data: [
        {
          proposalId: "0x1",
          proposalNumber: 10,
          description: "Active&&body",
          state: 1,
          proposal: { voteEnd: 1_800_000_000, forVotes: 5, againstVotes: 2, abstainVotes: 1 },
        },
        {
          proposalId: "0x2",
          proposalNumber: 9,
          description: "Closed&&body",
          state: 4,
          proposal: { voteEnd: 1_700_000_000, forVotes: 0, againstVotes: 0, abstainVotes: 0 },
        },
      ],
    },
    nouns: {
      data: {
        enabled: true,
        snapshots: [
          { id: "s1", title: "Nouns 101: Fund builders", state: "active", end: 1_750_000_000 },
          { id: "s2", title: "102: Closed", state: "closed", end: 1_740_000_000 },
        ],
        proposals: [{ proposalNumber: 101, title: "Fund builders" }],
      },
    },
  });

  assert.equal(
    payload.submissions.items.map(({ href }) => href).join(","),
    "/rounds/soon-submit/submit,/rounds/later-submit/submit"
  );
  assert.equal(payload.voting.items.map(({ href }) => href).join(","), "/rounds/vote");
  assert.equal(payload.submissions.items[0].deadlineLabel, "Voting starts");
  assert.equal(payload.voting.items[0].deadlineLabel, "Voting ends");
  assert.equal(payload.yellowProposals.items.map(({ href }) => href).join(","), "/proposals/10");
  assert.equal(payload.nounsProposals.items.map(({ href }) => href).join(","), "/proposals/nouns/101");
});

test("keeps empty sections useful and isolates provider failures", () => {
  const payload = dashboard.buildDashboardPayload({
    rounds: { error: "Rounds are unavailable right now." },
    yellowProposals: { data: [] },
    nouns: { data: { enabled: false, snapshots: [], proposals: [] } },
  });

  assert.equal(payload.submissions.error, "Rounds are unavailable right now.");
  assert.equal(payload.voting.error, "Rounds are unavailable right now.");
  assert.equal(payload.yellowProposals.error, undefined);
  assert.equal(payload.yellowProposals.total, 0);
  assert.equal(payload.nounsProposals.total, 0);
});

test("caps compact rows at three while retaining the accurate active count", () => {
  const payload = dashboard.buildDashboardPayload({
    rounds: {
      data: [1, 2, 3, 4].map((number) =>
        round(`round-${number}`, "submissions_open", `2026-08-${number + 10}T00:00:00Z`)
      ),
    },
    yellowProposals: { data: [] },
    nouns: { data: { enabled: true, snapshots: [], proposals: [] } },
  });

  assert.equal(payload.submissions.items.length, 3);
  assert.equal(payload.submissions.total, 4);
});

test("maps Snapshot titles and canonical proposal links to Nouns proposal numbers", () => {
  assert.equal(snapshot.parseNounsProposalNumber({ title: "123: Title" }), 123);
  assert.equal(
    snapshot.parseNounsProposalNumber({ title: "Nouns #124: Title" }),
    124
  );
  assert.equal(
    snapshot.parseNounsProposalNumber({
      title: "Metagov vote",
      body: "Review https://nouns.wtf/vote/125",
    }),
    125
  );
});

test("dashboard page loads public dashboard data without wallet connection", () => {
  const source = readFileSync(resolve(process.cwd(), "pages/dashboard.tsx"), "utf8");
  assert.match(source, /useSWR<DashboardPayload>\(\s*"\/api\/dashboard"/);
  assert.match(source, /<CustomConnectButton/);
  assert.match(source, /isMounted && !isConnected &&/);
  assert.doesNotMatch(source, /isMounted && isConnected \? "\/api\/dashboard" : null/);
  assert.match(source, /grid gap-5 lg:grid-cols-2/);
  assert.match(
    source,
    /key === "yellowProposals" \|\| key === "nounsProposals"/
  );
  assert.match(source, /isFullWidthPanel\(key\) \? "lg:col-span-2"/);
});

test("header policy has desktop/mobile parity without exposing admin navigation", () => {
  const nav = loadTsModule(resolve(process.cwd(), "utils/header-navigation.ts"));
  assert.equal(
    nav.getHomeNavigationItems(false, false).map(({ label }) => label).join(","),
    "Home,Dashboard"
  );
  assert.equal(
    nav.getHomeNavigationItems(true, false).map(({ label }) => label).join(","),
    "Home,Dashboard"
  );
  assert.equal(
    nav.getHomeNavigationItems(true, true).map(({ label }) => label).join(","),
    "Home,Dashboard,Admin Dashboard"
  );

  const header = readFileSync(resolve(process.cwd(), "components/Header.tsx"), "utf8");
  assert.match(header, /<NavDropdown label="Home" items=\{homeItems\} \/>/);
  assert.match(header, /<MobileNavGroup\s+label="Home"\s+items=\{homeItems\}/);
  assert.equal((header.match(/homeItems \?/g) || []).length, 0);
});
