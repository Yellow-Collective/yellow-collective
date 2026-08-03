import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const helperPath = resolve(process.cwd(), "utils/rounds/voting-snapshot.ts");

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

const snapshot = existsSync(helperPath) ? loadTsModule(helperPath) : {};
const roundsSource = readFileSync(
  resolve(process.cwd(), "data/rounds.ts"),
  "utf8"
);
const votingPowerApiSource = readFileSync(
  resolve(process.cwd(), "pages/api/rounds/[slug]/voting-power.ts"),
  "utf8"
);
const requestPageSource = readFileSync(
  resolve(process.cwd(), "pages/rounds/request.tsx"),
  "utf8"
);
const adminPageSource = readFileSync(
  resolve(process.cwd(), "pages/admin/dashboard.tsx"),
  "utf8"
);
const roundPageSource = readFileSync(
  resolve(process.cwd(), "pages/rounds/[slug].tsx"),
  "utf8"
);

const tests = [];
const test = (name, run) => tests.push({ name, run });

test("provides reusable round voting snapshot helpers", () => {
  assert.equal(existsSync(helperPath), true);
  assert.equal(typeof snapshot.getEffectiveRoundVotingSnapshotAt, "function");
  assert.equal(typeof snapshot.validateRoundVotingSnapshot, "function");
  assert.equal(typeof snapshot.hasRoundVotingSnapshotChanged, "function");
  assert.equal(typeof snapshot.isRoundVotingSnapshotReady, "function");
});

test("defaults the effective snapshot to voting start", () => {
  assert.equal(
    snapshot.getEffectiveRoundVotingSnapshotAt({
      votingStartsAt: "2026-08-10T16:00:00.000Z",
      votingSnapshotMode: "voting_start",
      votingSnapshotAt: null,
    }),
    "2026-08-10T16:00:00.000Z"
  );
});

test("uses the configured custom snapshot timestamp", () => {
  assert.equal(
    snapshot.getEffectiveRoundVotingSnapshotAt({
      votingStartsAt: "2026-08-10T16:00:00.000Z",
      votingSnapshotMode: "custom",
      votingSnapshotAt: "2026-08-01T12:30:00.000Z",
    }),
    "2026-08-01T12:30:00.000Z"
  );
});

test("requires custom snapshots to be valid and no later than voting start", () => {
  assert.match(
    snapshot.validateRoundVotingSnapshot({
      votingStartsAt: "2026-08-10T16:00:00.000Z",
      votingSnapshotMode: "custom",
      votingSnapshotAt: null,
    }),
    /required/i
  );
  assert.match(
    snapshot.validateRoundVotingSnapshot({
      votingStartsAt: "2026-08-10T16:00:00.000Z",
      votingSnapshotMode: "custom",
      votingSnapshotAt: "2026-08-11T16:00:00.000Z",
    }),
    /at or before voting begins/i
  );
  assert.equal(
    snapshot.validateRoundVotingSnapshot({
      votingStartsAt: "2026-08-10T16:00:00.000Z",
      votingSnapshotMode: "custom",
      votingSnapshotAt: "2026-08-01T12:30:00.000Z",
    }),
    undefined
  );
});

test("detects effective snapshot changes without blocking unrelated edits", () => {
  const current = {
    votingStartsAt: "2026-08-10T16:00:00.000Z",
    votingSnapshotMode: "voting_start",
    votingSnapshotAt: null,
  };

  assert.equal(snapshot.hasRoundVotingSnapshotChanged(current, current), false);
  assert.equal(
    snapshot.hasRoundVotingSnapshotChanged(current, {
      ...current,
      votingStartsAt: "2026-08-11T16:00:00.000Z",
    }),
    true
  );
  assert.equal(
    snapshot.hasRoundVotingSnapshotChanged(current, {
      ...current,
      votingSnapshotMode: "custom",
      votingSnapshotAt: "2026-08-01T12:30:00.000Z",
    }),
    true
  );
});

test("does not consider a future snapshot ready", () => {
  assert.equal(
    snapshot.isRoundVotingSnapshotReady(
      "2026-08-10T16:00:00.000Z",
      Date.parse("2026-08-10T15:59:59.000Z") / 1000
    ),
    false
  );
  assert.equal(
    snapshot.isRoundVotingSnapshotReady(
      "2026-08-10T16:00:00.000Z",
      Date.parse("2026-08-10T16:00:00.000Z") / 1000
    ),
    true
  );
});

test("persists snapshot configuration for rounds and round requests", () => {
  assert.match(roundsSource, /voting_snapshot_mode/);
  assert.match(roundsSource, /voting_snapshot_at/);
  assert.match(roundsSource, /RoundVotingSnapshotMode/);
  assert.match(roundsSource, /request\.votingSnapshotMode/);
  assert.match(roundsSource, /request\.votingSnapshotAt/);
});

test("resolves snapshots for every voting strategy and preserves resolved blocks", () => {
  const start = roundsSource.indexOf(
    "export const getOrCreateRoundVotingSnapshotBlock"
  );
  const end = roundsSource.indexOf("export const listRoundVoteActivity", start);
  const section = roundsSource.slice(start, end);

  assert.doesNotMatch(section, /votingStrategy\s*!==\s*"one_per_nft"/);
  assert.match(section, /getEffectiveRoundVotingSnapshotAt/);
  assert.match(section, /isRoundVotingSnapshotReady/);
  assert.match(section, /voting_snapshot_block/);
});

test("serializes snapshot edits with resolution and rejects timing drift after capture", () => {
  const start = roundsSource.indexOf("export const updateRound");
  const end = roundsSource.indexOf("export const removeRound", start);
  const section = roundsSource.slice(start, end);

  assert.match(section, /pg_advisory_xact_lock/);
  assert.match(section, /voting_snapshot_block/);
  assert.match(section, /hasRoundVotingSnapshotChanged/);
  assert.match(section, /cannot change after its block is resolved/);
});

test("returns an explicit pending snapshot state before capture", () => {
  assert.match(votingPowerApiSource, /votingSnapshotStatus/);
  assert.match(votingPowerApiSource, /pending/);
  assert.match(votingPowerApiSource, /votingSnapshotAt/);
});

test("exposes snapshot selection in admin and request interfaces", () => {
  assert.match(adminPageSource, /Voting power snapshot/);
  assert.match(adminPageSource, /When voting begins/);
  assert.match(adminPageSource, /Custom date/);
  assert.match(requestPageSource, /Voting power snapshot/);
  assert.match(requestPageSource, /When voting begins/);
  assert.match(requestPageSource, /Custom date/);
});

test("exposes the hybrid strategy and base allocation controls", () => {
  for (const source of [adminPageSource, requestPageSource]) {
    assert.match(source, /base_plus_voting_power/);
    assert.match(source, /Base votes \+ voting power/);
    assert.match(source, /Base votes per wallet/);
    assert.match(
      source,
      /Each eligible wallet receives the base allocation plus its[\s\S]*delegated Collective Noun voting power at the voting[\s\S]*snapshot\./
    );
    assert.match(
      source,
      /fixed_per_wallet[\s\S]*base_plus_voting_power|base_plus_voting_power[\s\S]*fixed_per_wallet/
    );
  }
});

test("initializes new hybrid form allocations without resetting deliberate values", () => {
  assert.match(adminPageSource, /hasEditedVotesPerWallet/);
  assert.match(
    adminPageSource,
    /round\.votingStrategy\s*===\s*"fixed_per_wallet"[\s\S]*round\.votingStrategy\s*===\s*"base_plus_voting_power"/
  );
  assert.match(
    adminPageSource,
    /base_plus_voting_power[\s\S]*!hasEditedVotesPerWallet[\s\S]*setVotesPerWallet\([\s\S]*getDefaultRoundVotesPerWallet/
  );
  assert.match(requestPageSource, /hasEditedVotesPerWallet/);
  assert.match(
    requestPageSource,
    /votesPerWallet:[\s\S]*base_plus_voting_power[\s\S]*!hasEditedVotesPerWallet[\s\S]*String\(getDefaultRoundVotesPerWallet/
  );
});

test("contains the admin snapshot controls within their responsive fieldset", () => {
  assert.match(
    adminPageSource,
    /<fieldset className="min-w-0 w-full max-w-full rounded-xl border border-skin-stroke bg-skin-muted p-4"/
  );
  assert.match(adminPageSource, /mt-3 grid min-w-0 gap-3 md:grid-cols-2/);
  assert.match(
    adminPageSource,
    /flex min-w-0 cursor-pointer items-start gap-3 rounded-xl/
  );
});

test("shows public snapshot timing", () => {
  assert.match(roundPageSource, /Voting power snapshot:/);
});

let failures = 0;

for (const { name, run } of tests) {
  try {
    await run();
    console.log(`ok - ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`not ok - ${name}`);
    console.error(error);
  }
}

if (failures > 0) {
  process.exitCode = 1;
}
