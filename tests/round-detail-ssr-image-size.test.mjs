import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(
  resolve(process.cwd(), "pages/rounds/[slug].tsx"),
  "utf8"
);

const tests = [];
const test = (name, run) => tests.push({ name, run });

test("round detail defers inline data images out of SSR markup", () => {
  assert.equal(source.includes("const DeferredInlineImage"), true);
  assert.equal(source.includes('src={round.image}'), true);
  assert.equal(source.includes('src={submission.image}'), true);
  assert.equal(source.includes("isInlineDataImage(src) && !isMounted"), true);
});

test("round detail no longer renders direct image tags for large round media", () => {
  assert.equal(
    /<img\s+src=\{(?:round|submission)\.image\}/.test(source),
    false
  );
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
