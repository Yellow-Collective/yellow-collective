import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const loadTsModule = (filePath) => {
  const source = readFileSync(filePath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: filePath,
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
    calls.slice(0, 6).every(({ overrides }) => overrides.heads === "custom"),
    true
  );
  assert.equal(
    calls.slice(6).filter(({ overrides }) => overrides.heads === "custom")
      .length,
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

test("derives bounded text when optional input is blank or short", () => {
  const blank = helper.fitRoundTraitText({
    value: "   ",
    fallback: "Noundry head trait",
    minLength: 30,
    maxLength: 48,
  });
  const short = helper.fitRoundTraitText({
    value: "Nice trait",
    fallback: "Noundry head trait",
    minLength: 20,
    maxLength: 24,
  });

  assert.ok(blank.length >= 30 && blank.length <= 48);
  assert.ok(short.startsWith("Nice trait"));
  assert.ok(short.length >= 20 && short.length <= 24);
});

test("truncates derived text to the configured maximum", () => {
  assert.equal(
    helper.fitRoundTraitText({
      value: "A very long canonical Noundry trait title",
      fallback: "Noundry trait",
      minLength: 3,
      maxLength: 12,
    }),
    "A very long "
  );
});

test("escapes every SVG attribute metacharacter in stored pixel colors", () => {
  assert.equal(
    helper.escapeSvgAttribute("red\"/><script>&'"),
    "red&quot;/&gt;&lt;script&gt;&amp;&#39;"
  );
});

test("omits blank optional text from the trait submission payload", () => {
  assert.deepEqual(
    { ...helper.buildRoundTraitSubmissionPayload("trait-123", "   ") },
    { traitId: "trait-123" }
  );
});

test("trims and includes a provided optional description", () => {
  assert.deepEqual(
    {
      ...helper.buildRoundTraitSubmissionPayload(
        "trait-123",
        "  Made for this round.  "
      ),
    },
    { traitId: "trait-123", description: "Made for this round." }
  );
});

test("accepts only the trusted generated image and canonical trait link", () => {
  const valid = {
    title: "Yellow head",
    description: "Noundry head trait submitted to this round.",
    image: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
    url: "/noundry/traits/trait-123",
  };
  const bounds = {
    traitId: "trait-123",
    minTitleLength: 3,
    maxTitleLength: 80,
    minDescriptionLength: 20,
    maxDescriptionLength: 400,
  };

  assert.equal(
    helper.validateDerivedRoundTraitSubmission({ ...valid, ...bounds }),
    undefined
  );
  assert.match(
    helper.validateDerivedRoundTraitSubmission({
      ...valid,
      ...bounds,
      image: "data:image/png;base64,abcd",
    }),
    /preview image is invalid/i
  );
  assert.match(
    helper.validateDerivedRoundTraitSubmission({
      ...valid,
      ...bounds,
      url: "/noundry/traits/someone-else",
    }),
    /trait link is invalid/i
  );
});

test("renders the canonical Noundry trait page link in Round details", () => {
  const { SubmissionLinks } = loadTsModule(
    resolve(process.cwd(), "components/rounds/SubmissionLinks.tsx")
  );
  const markup = renderToStaticMarkup(
    React.createElement(SubmissionLinks, {
      submission: {
        url: "/noundry/traits/trait-123",
        submissionType: "trait",
      },
    })
  );

  assert.match(markup, /href="\/noundry\/traits\/trait-123"/);
  assert.match(markup, />Noundry trait page</);
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
