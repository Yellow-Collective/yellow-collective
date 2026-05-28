import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "data/rounds.ts"), "utf8");

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
