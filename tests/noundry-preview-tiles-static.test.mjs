import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const previewComponent = readFileSync(
  resolve(process.cwd(), "components/noundry/NoundryPreview.tsx"),
  "utf8"
);

assert.match(
  previewComponent,
  /className="aspect-square overflow-hidden bg-\[#d7d9e4\]"/,
  "Noundry preview tiles must clip every composed layer to the artwork square."
);
assert.doesNotMatch(
  previewComponent,
  /border border-\[#d7d7d7\] p-3 shadow/,
  "Noundry preview tiles must not add borders, padding, or shadows around the artwork."
);
assert.doesNotMatch(
  previewComponent,
  /fullBleed/,
  "Noundry preview tiles must always render the full artwork without optional framing."
);

assert.match(
  previewComponent,
  /const baseLayers = collectionLayers\.filter\(\s*\(image\) =>\s*image\.trait !== "glasses"\s*&&\s*\(!showEditedTrait \|\| image\.trait !== submission\.traitType\)\s*\);/,
  "Noundry preview tiles must replace the collection image only while rendering an edited trait."
);
assert.match(
  previewComponent,
  /const glassesLayers = collectionLayers\.filter\(\s*\(image\) =>\s*image\.trait === "glasses"\s*&&\s*\(!showEditedTrait \|\| image\.trait !== submission\.traitType\)\s*\);/,
  "Noundry preview tiles must replace glasses only while rendering a custom glasses trait."
);

console.log("ok - Noundry previews stay clipped and borderless");
