import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");

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

const helper = loadTsModule(
  resolve(process.cwd(), "utils/noundry/round-trait-submission.ts")
);

const tests = [];
const test = (name, run) => tests.push({ name, run });

test("builds six trait generations and six collection generations", () => {
  const calls = [];
  const plan = helper.buildRoundTraitModalPreviewPlan({
    seedPrefix: "trait-123",
    submittedTraitOverride: { heads: "custom" },
    buildTraits: (seed, overrides) => {
      calls.push({ seed, overrides });
      return { seed, ...overrides };
    },
  });

  assert.equal(plan.generatedTraits.length, 6);
  assert.equal(plan.collectionTraits.length, 6);
  assert.deepEqual(Array.from(plan.generatedEditedIndexes), [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(Array.from(plan.collectionEditedIndexes), [0]);
  assert.equal(calls.length, 12);
});

test("forces the submitted trait into every generated tile and one collection tile", () => {
  const calls = [];
  helper.buildRoundTraitModalPreviewPlan({
    seedPrefix: "trait-123",
    submittedTraitOverride: { heads: "custom" },
    buildTraits: (seed, overrides) => {
      calls.push({ seed, overrides });
      return overrides;
    },
  });

  assert.equal(
    calls
      .slice(0, 6)
      .every(({ overrides }) => overrides.heads === "custom"),
    true
  );
  assert.equal(
    calls
      .slice(6)
      .filter(({ overrides }) => overrides.heads === "custom").length,
    1
  );
  assert.equal(
    calls
      .slice(7)
      .every(({ overrides }) => Object.keys(overrides).length === 0),
    true
  );
});

test("uses stable and distinct seeds for both preview sets", () => {
  const seeds = [];
  helper.buildRoundTraitModalPreviewPlan({
    seedPrefix: "trait-123",
    submittedTraitOverride: { heads: "custom" },
    buildTraits: (seed) => {
      seeds.push(seed);
      return { seed };
    },
  });

  assert.equal(new Set(seeds).size, 12);
  assert.equal(seeds[0], "trait-123-round-generated-0");
  assert.equal(seeds[6], "trait-123-round-collection-0");
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
