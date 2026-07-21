import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const proposalDetailSource = readFileSync(
  resolve(process.cwd(), "pages/vote/[proposalid].tsx"),
  "utf8"
);

const getTimeSource = proposalDetailSource.match(
  /const getTime = \(timestamp: number\) => \{[\s\S]*?\n  \};/
)?.[0];

assert.ok(getTimeSource, "Proposal detail time formatter must be present.");

const transpiled = ts.transpileModule(
  `${getTimeSource}\nmodule.exports = getTime;`,
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }
).outputText;

const module = { exports: {} };
vm.runInNewContext(transpiled, { module, exports: module.exports, Date });
const getTime = module.exports;

test("proposal times zero-pad single-digit minutes", () => {
  const timestamp = new Date(2026, 6, 18, 10, 9).getTime() / 1000;

  assert.equal(getTime(timestamp), "10:09 AM");
});
