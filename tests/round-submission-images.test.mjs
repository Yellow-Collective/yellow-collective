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

const submissionImages = loadTsModule(
  resolve(process.cwd(), "utils/rounds/submission-images.ts")
);
const dataSource = readFileSync(
  resolve(process.cwd(), "data/rounds.ts"),
  "utf8"
);
const schemaSource = readFileSync(
  resolve(process.cwd(), "scripts/rounds-schema.sql"),
  "utf8"
);
const submitApiSource = readFileSync(
  resolve(process.cwd(), "pages/api/rounds/[slug]/submit.ts"),
  "utf8"
);
const submitPageSource = readFileSync(
  resolve(process.cwd(), "pages/rounds/[slug]/submit.tsx"),
  "utf8"
);

const tests = [];
const test = (name, run) => tests.push({ name, run });

test("normalizes legacy cover images into an ordered image list", () => {
  assert.deepEqual(
    Array.from(
      submissionImages.normalizeRoundSubmissionImages({
        image: "https://example.com/cover.png",
      })
    ),
    ["https://example.com/cover.png"]
  );
});

test("preserves explicit submission image order", () => {
  assert.deepEqual(
    Array.from(
      submissionImages.normalizeRoundSubmissionImages({
        image: "https://example.com/legacy.png",
        images: ["https://example.com/one.png", "https://example.com/two.png"],
      })
    ),
    ["https://example.com/one.png", "https://example.com/two.png"]
  );
});

test("defines a ten-image and aggregate payload limit", () => {
  assert.equal(submissionImages.ROUND_SUBMISSION_MAX_IMAGES, 10);
  assert.equal(
    submissionImages.ROUND_SUBMISSION_MAX_TOTAL_IMAGE_BYTES,
    7 * 1024 * 1024
  );
});

test("rejects too many images and oversized aggregate payloads", () => {
  assert.match(
    submissionImages.getRoundSubmissionImagesValidationError(
      Array.from(
        { length: 11 },
        (_, index) => `https://example.com/${index}.png`
      )
    ),
    /up to 10 images/
  );

  assert.match(
    submissionImages.getRoundSubmissionImagesValidationError([
      `data:image/jpeg;base64,${"a".repeat(
        submissionImages.ROUND_SUBMISSION_MAX_TOTAL_IMAGE_BYTES
      )}`,
    ]),
    /combined image size/
  );
});

test("persists ordered images and keeps the legacy cover column", () => {
  assert.match(dataSource, /ADD COLUMN IF NOT EXISTS images jsonb/);
  assert.match(dataSource, /s\.images/);
  assert.match(dataSource, /images = \$7::jsonb/);
  assert.match(dataSource, /image = \$6/);
  assert.match(schemaSource, /images jsonb NOT NULL DEFAULT '\[\]'::jsonb/);
  assert.match(schemaSource, /SET images = jsonb_build_array\(image\)/);
  assert.match(schemaSource, /WHERE jsonb_array_length\(images\) = 0/);
});

test("validates image collections at the server boundary", () => {
  assert.match(submitApiSource, /images\?: string\[\]/);
  assert.match(dataSource, /getRoundSubmissionImagesValidationError/);
  assert.match(dataSource, /ROUND_SUBMISSION_MAX_IMAGES/);
});

test("submission UI uploads multiple files and exposes ordered removal", () => {
  assert.match(submitPageSource, /multiple/);
  assert.match(submitPageSource, /Upload images/);
  assert.match(submitPageSource, /Remove image/);
  assert.match(submitPageSource, /images: values\.images/);
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

if (failures > 0) process.exitCode = 1;
