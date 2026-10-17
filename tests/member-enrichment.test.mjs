import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const module = { exports: {} };
vm.runInNewContext(
  ts.transpileModule(readFileSync("utils/collect-with-deadline.ts", "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText,
  { module, exports: module.exports, setTimeout, clearTimeout }
);
const { collectWithDeadline } = module.exports;
let active = 0;
let peak = 0;
const loaded = await collectWithDeadline(
  [1, 2, 3, 4],
  async (value) => {
    peak = Math.max(peak, ++active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active--;
    if (value === 3) throw new Error("upstream failed");
    return value;
  },
  { concurrency: 2, timeoutMs: 1000 }
);
assert.deepEqual([...loaded].sort(), [1, 2, 4]);
assert.equal(peak, 2);
let started = 0;
let release;
const partial = await collectWithDeadline(
  [1, 2, 3],
  async (value) => {
    started++;
    if (value === 2)
      await new Promise((resolve) => {
        release = resolve;
      });
    return value;
  },
  { concurrency: 1, timeoutMs: 20 }
);
assert.deepEqual(
  [...partial],
  [1],
  "A slow item must not erase completed values"
);
release();
await new Promise((resolve) => setTimeout(resolve, 5));
assert.equal(started, 2, "No more work starts after the deadline");
assert.deepEqual(
  [...partial],
  [1],
  "Returned snapshots cannot mutate after timeout"
);
console.log(
  "ok - enrichment preserves partial results and bounds upstream work"
);
