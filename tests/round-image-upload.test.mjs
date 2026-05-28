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

const upload = loadTsModule(
  resolve(process.cwd(), "utils/rounds/round-image-upload.ts")
);

const tests = [];
const test = (name, run) => tests.push({ name, run });

test("accepts supported round image files up to the size limit", () => {
  assert.doesNotThrow(() =>
    upload.validateRoundImageUploadFile({
      type: "image/png",
      size: upload.ROUND_IMAGE_UPLOAD_MAX_BYTES,
    })
  );
});

test("rejects non-image or unsupported round image files", () => {
  assert.throws(
    () =>
      upload.validateRoundImageUploadFile({
        type: "text/html",
        size: 1024,
      }),
    /Choose a supported image file/
  );
  assert.throws(
    () =>
      upload.validateRoundImageUploadFile({
        type: "image/svg+xml",
        size: 1024,
      }),
    /Choose a supported image file/
  );
});

test("rejects round image files above the size limit", () => {
  assert.throws(
    () =>
      upload.validateRoundImageUploadFile({
        type: "image/jpeg",
        size: upload.ROUND_IMAGE_UPLOAD_MAX_BYTES + 1,
      }),
    /Choose an image smaller than 8MB/
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
