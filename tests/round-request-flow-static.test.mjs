import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "data/rounds.ts"), "utf8");
const schemaSource = readFileSync(
  resolve(process.cwd(), "scripts/rounds-schema.sql"),
  "utf8"
);

const tests = [];
const test = (name, run) => tests.push({ name, run });

test("admin request list excludes approved round requests", () => {
  const start = source.indexOf("export const listAdminRoundRequests");
  const end = source.indexOf("export const createRoundRequest", start);
  const section = source.slice(start, end);

  assert.match(section, /status\s*<>\s*'approved'/);
});

test("approving a round request creates a draft round", () => {
  const start = source.indexOf("export const approveRoundRequest");
  const end = source.indexOf("export const removeRoundRequest", start);
  const section = source.slice(start, end);

  assert.match(section, /status:\s*"draft"/);
  assert.match(section, /active:\s*false/);
  assert.match(section, /votingSnapshotMode:\s*request\.votingSnapshotMode/);
  assert.match(section, /votingSnapshotAt:\s*request\.votingSnapshotAt/);
  assert.match(section, /votingStrategy:\s*request\.votingStrategy/);
  assert.match(section, /votesPerWallet:\s*request\.votesPerWallet/);
});

test("runtime and standalone schemas migrate both strategy constraints", () => {
  for (const schema of [source, schemaSource]) {
    assert.match(
      schema,
      /rounds_voting_strategy_check[\s\S]*base_plus_voting_power/
    );
    assert.match(
      schema,
      /round_requests_voting_strategy_check[\s\S]*base_plus_voting_power/
    );
    assert.match(
      schema,
      /DROP CONSTRAINT IF EXISTS rounds_voting_strategy_check/
    );
    assert.match(
      schema,
      /DROP CONSTRAINT IF EXISTS round_requests_voting_strategy_check/
    );
  }
});

test("round request normalization uses the strategy-specific allocation default", () => {
  const start = source.indexOf("const normalizeRoundRequestInput");
  const end = source.indexOf("export const validateRoundRequestInput", start);
  const section = source.slice(start, end);

  assert.match(section, /getDefaultRoundVotesPerWallet\(votingStrategy\)/);
});

let failures = 0;

for (const { name, run } of tests) {
  try {
    run();
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
