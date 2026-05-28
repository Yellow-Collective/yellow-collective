import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(
  resolve(process.cwd(), "pages/rounds/[slug].tsx"),
  "utf8"
);

const tests = [];
const test = (name, run) => tests.push({ name, run });

test("round pages do not hardcode admin wallet ENS labels", () => {
  assert.equal(source.includes("yellowadmin.eth"), false);
  assert.equal(source.includes("roundbuilder.eth"), false);
  assert.equal(source.includes("demoAuthorNames"), false);
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
