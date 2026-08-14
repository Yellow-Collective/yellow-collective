import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const helperPath = resolve(
  process.cwd(),
  "utils/rounds/submission-copy.ts"
);
const submitPageSource = readFileSync(
  resolve(process.cwd(), "pages/rounds/[slug]/submit.tsx"),
  "utf8"
);
const detailPageSource = readFileSync(
  resolve(process.cwd(), "pages/rounds/[slug].tsx"),
  "utf8"
);
const roundsDataSource = readFileSync(
  resolve(process.cwd(), "data/rounds.ts"),
  "utf8"
);

const loadCopyModule = () => {
  assert.equal(
    existsSync(helperPath),
    true,
    "expected utils/rounds/submission-copy.ts to exist"
  );

  const source = readFileSync(helperPath, "utf8");
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

const tests = [];
const test = (name, run) => tests.push({ name, run });

test("builds Round-title-aware submission placeholders", () => {
  const copy = loadCopyModule();

  assert.deepEqual(
    { ...copy.getRoundSubmissionPlaceholders("  Summer Art Show  ") },
    {
      title: "Enter a submission title for Summer Art Show",
      url: "Enter your submission URL",
      image: "Enter an image URL for Summer Art Show",
      description: "Describe your submission for Summer Art Show.",
    }
  );
});

test("uses generic submission placeholders when the Round title is absent", () => {
  const copy = loadCopyModule();
  const expected = {
    title: "Enter a submission title",
    url: "Enter your submission URL",
    image: "Enter an image URL",
    description: "Describe your submission for this round.",
  };

  assert.deepEqual({ ...copy.getRoundSubmissionPlaceholders("") }, expected);
  assert.deepEqual(
    { ...copy.getRoundSubmissionPlaceholders("   ") },
    expected
  );
});

test("the submission form uses persistent labels and contextual placeholders", () => {
  assert.match(
    submitPageSource,
    /getRoundSubmissionPlaceholders\(round\.title\)/
  );
  assert.match(submitPageSource, /placeholder=\{placeholders\.title\}/);
  assert.match(submitPageSource, /placeholder=\{placeholders\.url\}/);
  assert.match(submitPageSource, /placeholder=\{placeholders\.image\}/);
  assert.match(
    submitPageSource,
    /placeholder=\{placeholders\.description\}/
  );
  assert.match(submitPageSource, /<label[\s\S]*htmlFor=/);
  assert.match(submitPageSource, /Submission URL \(optional\)/);
  assert.match(submitPageSource, /Submit entry/);
});

test("public Round pages and validation use submission terminology", () => {
  assert.match(detailPageSource, /Submit entry/);
  assert.match(detailPageSource, /Submission link/);
  assert.match(detailPageSource, /Submissions/);
  assert.match(detailPageSource, /Submission submitted/);
  assert.match(
    roundsDataSource,
    /Submission URL must be a valid URL\./
  );

  const scopedPublicCopy = [
    submitPageSource,
    detailPageSource,
    roundsDataSource,
  ].join("\n");

  for (const legacyCopy of [
    "Project URL",
    "Submit project",
    "Project link",
    '"Projects"',
    "Project submitted",
  ]) {
    assert.equal(
      scopedPublicCopy.includes(legacyCopy),
      false,
      `expected legacy public copy to be removed: ${legacyCopy}`
    );
  }
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
