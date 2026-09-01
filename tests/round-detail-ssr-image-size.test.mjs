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

const source = readFileSync(
  resolve(process.cwd(), "pages/rounds/[slug].tsx"),
  "utf8"
);
const mediaPayload = loadTsModule(
  resolve(process.cwd(), "utils/rounds/roundMediaPayload.ts")
);

const tests = [];
const test = (name, run) => tests.push({ name, run });

test("round detail defers inline data images out of SSR markup", () => {
  assert.equal(source.includes("const DeferredInlineImage"), true);
  assert.equal(source.includes("src={round.image}"), true);
  assert.equal(source.includes("src={submission.image}"), true);
  assert.equal(
    source.includes('src.startsWith("data:image/") && !isMounted'),
    true
  );
  assert.equal(source.includes("stripRoundInlineMediaForSsr(round)"), true);
});

test("round detail no longer renders direct image tags for large round media", () => {
  assert.equal(
    /<img\s+src=\{(?:round|submission)\.image\}/.test(source),
    false
  );
});

test("round detail SSR props strip inline data images before serialization", () => {
  const largeDataImage = `data:image/jpeg;base64,${"a".repeat(256_000)}`;
  const round = {
    id: "round-1",
    slug: "future-yellow-rounds",
    image: largeDataImage,
    submissions: [
      {
        id: "submission-1",
        image: largeDataImage,
        images: [largeDataImage, "https://example.com/second.png"],
      },
      {
        id: "submission-2",
        image: "https://example.com/image.png",
        images: ["https://example.com/image.png"],
      },
    ],
    voteActivity: [],
  };

  const stripped = mediaPayload.stripRoundInlineMediaForSsr(round);
  const serialized = JSON.stringify({ props: { round: stripped } });

  assert.equal(serialized.includes("data:image/"), false);
  assert.ok(Buffer.byteLength(serialized, "utf8") < 4096);
  assert.equal(stripped.image, "");
  assert.equal(stripped.submissions[0].image, "");
  assert.deepEqual(Array.from(stripped.submissions[0].images), [
    "",
    "https://example.com/second.png",
  ]);
  assert.equal(stripped.submissions[1].image, "https://example.com/image.png");
});

test("round media payload restores stripped inline images client-side", () => {
  const media = {
    roundImage: "data:image/jpeg;base64,round",
    submissionImages: {
      "submission-1": "data:image/jpeg;base64,submission",
    },
    submissionImageSets: {
      "submission-1": [
        "data:image/jpeg;base64,submission",
        "data:image/jpeg;base64,second",
      ],
    },
  };
  const round = {
    image: "",
    submissions: [
      {
        id: "submission-1",
        image: "",
        images: ["", ""],
      },
    ],
  };

  const hydrated = mediaPayload.hydrateRoundInlineMedia(round, media);

  assert.equal(hydrated.image, media.roundImage);
  assert.equal(
    hydrated.submissions[0].image,
    media.submissionImages["submission-1"]
  );
  assert.deepEqual(Array.from(hydrated.submissions[0].images), [
    "data:image/jpeg;base64,submission",
    "data:image/jpeg;base64,second",
  ]);
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
