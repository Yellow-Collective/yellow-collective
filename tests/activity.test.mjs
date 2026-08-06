import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const loadTsModule = (path) => {
  const source = readFileSync(path, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} };

  vm.runInNewContext(output, {
    Buffer,
    Date,
    JSON,
    Map,
    Number,
    Object,
    Set,
    module,
    exports: module.exports,
    require,
  });

  return module.exports;
};

const activity = loadTsModule(resolve(process.cwd(), "utils/activity.ts"));

const item = (id, category, timestamp) => ({
  id,
  category,
  type: category === "rounds" ? "round-vote" : "auction-bid",
  timestamp,
  title: id,
  href: "/",
});

test("validates category, limit, cursor, and singular API query values", () => {
  const defaults = activity.parseActivityQuery({});
  assert.equal(defaults.value.category, "all");
  assert.equal(defaults.value.limit, 10);
  assert.match(
    activity.parseActivityQuery({ category: "private" }).error,
    /Unsupported/
  );
  assert.match(activity.parseActivityQuery({ limit: "51" }).error, /1 to 50/);
  assert.match(activity.parseActivityQuery({ category: ["all"] }).error, /singular/);
  assert.match(activity.parseActivityQuery({ cursor: "not-a-cursor" }).error, /cursor/);
});

test("sorts newest first, uses deterministic IDs for ties, and deduplicates", () => {
  const sorted = activity.sortAndDedupeActivity([
    item("z", "rounds", "2026-08-01T12:00:00.000Z"),
    item("b", "rounds", "2026-08-02T12:00:00.000Z"),
    item("a", "auctions", "2026-08-02T12:00:00.000Z"),
    item("a", "auctions", "2026-08-02T12:00:00.000Z"),
    item("invalid", "rounds", "not-a-date"),
  ]);

  assert.equal(sorted.map(({ id }) => id).join(","), "a,b,z");
});

test("filters before cursor pagination and returns pages without overlap", () => {
  const items = [
    item("a", "auctions", "2026-08-05T12:00:00.000Z"),
    item("b", "rounds", "2026-08-04T12:00:00.000Z"),
    item("c", "rounds", "2026-08-03T12:00:00.000Z"),
    item("d", "rounds", "2026-08-02T12:00:00.000Z"),
  ];
  const first = activity.paginateActivity({
    items,
    category: "rounds",
    limit: 2,
  });
  const second = activity.paginateActivity({
    items,
    category: "rounds",
    limit: 2,
    cursor: first.nextCursor,
  });

  assert.equal(first.items.map(({ id }) => id).join(","), "b,c");
  assert.equal(second.items.map(({ id }) => id).join(","), "d");
  assert.equal(second.nextCursor, null);
});

test("activity providers expose only supported timestamp-backed event variants", () => {
  const source = readFileSync(resolve(process.cwd(), "data/activity.ts"), "utf8");
  assert.match(source, /type: "auction-bid"/);
  assert.match(source, /bidTime/);
  assert.match(source, /type: "round-submission"/);
  assert.match(source, /timestamp: submission\.createdAt/);
  assert.match(source, /type: "round-vote"/);
  assert.match(source, /timestamp: vote\.updatedAt \|\| vote\.createdAt/);
  assert.match(source, /type: "proposal-created"/);
  assert.match(source, /type: "proposal-vote"/);
  assert.match(source, /type: "proposal-queued"/);
  assert.match(source, /type: "proposal-executed"/);
  assert.match(source, /type: "proposal-canceled"/);
  assert.match(source, /type: "proposal-vetoed"/);
  assert.match(source, /queuedAt/);
  assert.match(source, /executedAt/);
  assert.match(source, /canceledAt/);
  assert.match(source, /vetoedAt/);
  assert.match(source, /timestamp/);
  assert.match(source, /case "against"/);
  assert.match(source, /case "for"/);
  assert.match(source, /type: "noundry-submission"/);
  assert.doesNotMatch(source, /type: "auction-settled"/);
});

test("dashboard feed uses ten-item pages, scroll containment, governance filters, and profile identity", () => {
  const source = readFileSync(
    resolve(process.cwd(), "components/dashboard/ActivityFeed.tsx"),
    "utf8"
  );

  assert.match(source, /proposals: "Governance"/);
  assert.match(source, /limit: "10"/);
  assert.match(source, /h-\[640px\]/);
  assert.match(source, /overflow-y-auto/);
  assert.match(source, /aria-label="Activity filters"/);
  assert.match(source, /overflow-x-auto pb-1 pt-1/);
  assert.match(source, /BLUE_3D_BUTTON_CLASSES/);
  assert.match(source, /#0f5f99/);
  assert.match(source, /#9ca3af/);
  assert.match(source, /bg-white/);
  assert.match(source, /useEnsNames/);
  assert.match(source, /useEnsAvatar/);
  assert.match(source, /fallbackAvatarUrl/);
  assert.match(source, /NounPreviewTile/);
  assert.match(source, /aria-label="View transaction on BaseScan"/);
  assert.match(source, /title="View transaction on BaseScan"/);
  assert.doesNotMatch(source, />\s*Basescan\s*</);
  assert.match(source, /item\.type === "auction-bid" \|\| item\.type === "proposal-vote"/);
  assert.match(source, /whitespace-pre-wrap/);
});

test("activity avatars advance through unique image candidates and always render a visible fallback", () => {
  const source = readFileSync(
    resolve(process.cwd(), "components/dashboard/ActivityFeed.tsx"),
    "utf8"
  );

  assert.match(source, /const avatarCandidates = useMemo/);
  assert.match(source, /new Set\(/);
  assert.match(source, /profile\?\.profile\?\.avatarUrl/);
  assert.match(source, /ensAvatar\?\.ensAvatar/);
  assert.match(source, /profile\?\.fallbackAvatarUrl/);
  assert.match(source, /avatarCandidates\.find/);
  assert.match(source, /setFailedImages/);
  assert.match(source, /hasGeneratedNounFallback/);
  assert.match(source, /artwork && submission && hasGeneratedNounFallback/);
  assert.match(source, /<div className="h-full w-full">/);
  assert.match(source, /<Jazzicon/);
  assert.doesNotMatch(source, /const \[failedImage, setFailedImage\]/);
  assert.doesNotMatch(
    source,
    /<span className="h-full w-full animate-pulse bg-\[#fff7bf\]/
  );
});

test("governance activity exposes titles and separate vote reasons without proposal bodies", () => {
  const source = readFileSync(resolve(process.cwd(), "data/activity.ts"), "utf8");

  assert.match(source, /getProposalName\(proposal\.title \|\| ""\)/);
  assert.doesNotMatch(source, /getProposalName\(proposal\.description/);
  assert.doesNotMatch(source, /description\s*\n\s*}/);
  assert.match(source, /description: sanitizeActivityText\(vote\.reason, Number\.MAX_SAFE_INTEGER\)/);
  assert.match(source, /sanitizeActivityText\(bid\.comment, Number\.MAX_SAFE_INTEGER\)/);
});

test("API and database queries enforce read-only validation and public records", () => {
  const api = readFileSync(resolve(process.cwd(), "pages/api/activity.ts"), "utf8");
  const rounds = readFileSync(resolve(process.cwd(), "data/rounds.ts"), "utf8");
  const noundry = readFileSync(
    resolve(process.cwd(), "data/noundry/submissions.ts"),
    "utf8"
  );
  assert.match(api, /req\.method !== "GET"/);
  assert.match(api, /res\.setHeader\("Allow", "GET"\)/);
  assert.match(api, /parseActivityQuery\(req\.query\)/);
  assert.match(rounds, /s\.status = 'approved'/);
  assert.match(rounds, /r\.status = 'published'/);
  assert.match(rounds, /r\.active = true/);
  assert.match(noundry, /WHERE status = 'approved'/);
  const approvedList = noundry.match(
    /export const listApprovedNoundrySubmissions[\s\S]*?return result\.rows\.map\(mapSubmission\);/
  )?.[0];
  assert.ok(approvedList);
  assert.match(approvedList, /WHERE status = 'approved'/);
  assert.match(approvedList, /LIMIT\s+100/);
  const activitySource = readFileSync(
    resolve(process.cwd(), "data/activity.ts"),
    "utf8"
  );
  assert.match(activitySource, /listApprovedNoundrySubmissions\(\)/);
  assert.doesNotMatch(activitySource, /Snorkel/i);
});

test("feed is connected-user-only, follows the panel grid, and leaves admin separate", () => {
  const dashboard = readFileSync(resolve(process.cwd(), "pages/dashboard.tsx"), "utf8");
  const admin = readFileSync(resolve(process.cwd(), "pages/admin/dashboard.tsx"), "utf8");
  assert.match(dashboard, /isMounted && isConnected \? "\/api\/dashboard" : null/);
  assert.ok(dashboard.indexOf("<ActivityFeed />") > dashboard.indexOf("<DashboardPanel"));
  assert.doesNotMatch(admin, /ActivityFeed/);
});
