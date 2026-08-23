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
const roundPageSource = readFileSync(
  resolve(process.cwd(), "pages/rounds/[slug].tsx"),
  "utf8"
);
const roundsDataSource = readFileSync(
  resolve(process.cwd(), "data/rounds.ts"),
  "utf8"
);
const walletIdentitySource = readFileSync(
  resolve(process.cwd(), "components/WalletIdentityLink.tsx"),
  "utf8"
);
const noundryGallerySource = readFileSync(
  resolve(process.cwd(), "pages/noundry.tsx"),
  "utf8"
);
const profilePageSource = readFileSync(
  resolve(process.cwd(), "pages/profile/[addressOrEns].tsx"),
  "utf8"
);
const previewComponentSource = readFileSync(
  resolve(process.cwd(), "components/noundry/NoundryPreview.tsx"),
  "utf8"
);
const traitPageSource = readFileSync(
  resolve(process.cwd(), "pages/noundry/traits/[id].tsx"),
  "utf8"
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

test("prefers ENS, then profile name, then the full wallet for trait submitters", () => {
  const walletAddress = "0xDcf37D8Aa17142f053AAA7dc56025aB00D897a19";

  assert.equal(
    helper.selectRoundTraitSubmitterLabel({
      ensName: "satori.eth",
      profileName: "Satori",
      walletAddress,
    }),
    "satori.eth"
  );
  assert.equal(
    helper.selectRoundTraitSubmitterLabel({
      ensName: "   ",
      profileName: "  Satori  ",
      walletAddress,
    }),
    "Satori"
  );
  assert.equal(
    helper.selectRoundTraitSubmitterLabel({
      ensName: undefined,
      profileName: "",
      walletAddress,
    }),
    walletAddress
  );
});

test("recognizes legacy and explicitly marked autogenerated trait descriptions", () => {
  const walletAddress = "0xDcf37D8Aa17142f053AAA7dc56025aB00D897a19";

  assert.equal(
    helper.isRoundTraitAutoDescription({
      submissionType: "trait",
      traitType: "heads",
      walletAddress,
      description: `Noundry heads trait submitted by ${walletAddress}.`,
      sourcePayload: {},
    }),
    true
  );
  assert.equal(
    helper.isRoundTraitAutoDescription({
      submissionType: "trait",
      traitType: "heads",
      walletAddress,
      description: "Noundry heads trait submitted by satori.eth.",
      sourcePayload: { roundSubmissionAutoDescription: true },
    }),
    true
  );
  assert.equal(
    helper.isRoundTraitAutoDescription({
      submissionType: "trait",
      traitType: "heads",
      walletAddress,
      description: "I made this custom description for the heads round.",
      sourcePayload: {},
    }),
    false
  );
});

test("round trait descriptions render a live ENS or profile identity", () => {
  assert.match(roundPageSource, /isRoundTraitAutoDescription\(submission\)/);
  assert.match(
    roundPageSource,
    /submitterProfile\?\.profile\?\.username \|\| storedIdentityLabel/
  );
  assert.match(walletIdentitySource, /resolvedEnsName \|\| profileName \|\| fallbackLabel/);
});

test("new autogenerated trait descriptions record the best identity and marker", () => {
  assert.match(roundsDataSource, /selectRoundTraitSubmitterLabel\(\{/);
  assert.match(roundsDataSource, /roundSubmissionAutoDescription:\s*!hasCustomDescription/);
  assert.match(roundsDataSource, /roundSubmissionIdentityLabel:\s*submitterLabel/);
  assert.doesNotMatch(roundsDataSource, /from "data\/profile"/);
});

test("round info omits submission type and trait links show the trait title", () => {
  const detailsStart = roundPageSource.indexOf("const RoundDetailsPanel");
  const detailsEnd = roundPageSource.indexOf("const RoundStat", detailsStart);
  const detailsSource = roundPageSource.slice(detailsStart, detailsEnd);
  const linksStart = roundPageSource.indexOf("const SubmissionLinks");
  const linksEnd = roundPageSource.indexOf("const NoundryModalPreviewSet", linksStart);
  const linksSource = roundPageSource.slice(linksStart, linksEnd);

  assert.doesNotMatch(detailsSource, /Submission type/);
  assert.match(
    linksSource,
    /submission\.submissionType === "trait"\s*\?\s*submission\.title\s*:\s*submission\.url/
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

test("shows trait round actions only to the connected trait author", () => {
  assert.match(
    previewComponentSource,
    /getTraitRoundSubmissionPath\(submission\.id\)/,
    "Trait cards must link to the existing trait round-submission flow."
  );
  assert.match(
    noundryGallerySource,
    /address\?\.toLowerCase\(\) === submission\.artist\.toLowerCase\(\)/,
    "Gallery cards must compare the connected wallet to the trait author."
  );
  assert.match(
    profilePageSource,
    /isConnected && isOwnProfile/,
    "Profile cards must only show the action for the connected profile owner."
  );
  assert.match(
    traitPageSource,
    /router\.query\.submitRound === "1" && isCreator/,
    "The trait page must open its existing round-submission modal from card links only for the author."
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
