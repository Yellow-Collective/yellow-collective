import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(
  resolve(process.cwd(), "components/rounds/RoundTimeline.tsx"),
  "utf8"
);

const tests = [];
const test = (name, run) => tests.push({ name, run });

test("desktop timeline track is centered through milestone circles", () => {
  assert.equal(source.includes("top-[46px]"), false);
  assert.equal(source.match(/top-\[52px\]/g)?.length, 2);
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
