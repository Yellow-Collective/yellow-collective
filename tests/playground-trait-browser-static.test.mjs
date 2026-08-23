import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const playgroundSource = readFileSync(
  resolve(process.cwd(), "pages/playground.tsx"),
  "utf8"
);
const studioSource = readFileSync(
  resolve(process.cwd(), "pages/noundry.tsx"),
  "utf8"
);
const routeSource = readFileSync(
  resolve(process.cwd(), "pages/api/playground/trait-assets.ts"),
  "utf8"
);
const helperPath = resolve(process.cwd(), "utils/playground/trait-assets.ts");
const helperSource = readFileSync(helperPath, "utf8");
const transpiled = ts.transpileModule(helperSource, {
  compilerOptions: {
    esModuleInterop: true,
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
  fileName: helperPath,
});
const module = { exports: {} };
vm.runInNewContext(transpiled.outputText, {
  module,
  exports: module.exports,
});

const { getOriginalTraitAssetEntries, getTraitRemixHref } = module.exports;

assert.match(playgroundSource, /View all traits/);
assert.match(playgroundSource, /Download trait assets/);
assert.match(playgroundSource, /<Dialog open=\{isTraitBrowserOpen\}/);
assert.match(playgroundSource, /data\.orderedLayers\.map/);
assert.match(
  playgroundSource,
  /getTraitRemixHref\(\s*image\.trait,\s*image\.name\s*\)/
);
assert.match(playgroundSource, /method: "HEAD"/);
assert.match(playgroundSource, /isDownloadingTraitAssets/);
assert.match(playgroundSource, /Download started\./);

assert.equal(
  getTraitRemixHref("heads", "paper plane"),
  "/noundry?remixLayer=heads&remixTrait=paper%20plane"
);
assert.deepEqual(
  JSON.parse(
    JSON.stringify(
      getOriginalTraitAssetEntries({
        renderLayers: [],
        orderedLayers: [],
        images: [
          {
            name: "yellow",
            trait: "backgrounds",
            uri: "/playground/yellow.png",
            sourceUri:
              "ipfs://bafybeicwsv2lnwjkcru3yfu73vpsp4xcf7ylh35dldybql5xlyks5hl4om/0-backgrounds/yellow.png",
          },
          {
            name: "ignored",
            trait: "heads",
            uri: "/playground/ignored.png",
            sourceUri: "ipfs://untrusted/heads/ignored.png",
          },
        ],
      })
    )
  ),
  [
    {
      name: "0-backgrounds/yellow.png",
      sourceUrl:
        "https://gateway.pinata.cloud/ipfs/bafybeicwsv2lnwjkcru3yfu73vpsp4xcf7ylh35dldybql5xlyks5hl4om/0-backgrounds/yellow.png",
    },
  ]
);

assert.match(studioSource, /router\.query\.remixLayer/);
assert.match(studioSource, /router\.query\.remixTrait/);
assert.match(studioSource, /remixTarget\.trait\] = remixTrait/);
assert.match(routeSource, /req\.method !== "GET" && req\.method !== "HEAD"/);
assert.match(routeSource, /application\/zip/);
assert.match(routeSource, /getOriginalTraitAssetEntries/);
assert.match(routeSource, /download-errors\.txt/);

console.log("ok - Playground trait browser, remix URLs, and ZIP export wiring");
