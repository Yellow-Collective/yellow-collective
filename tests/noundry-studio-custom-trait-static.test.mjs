import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const studioSource = readFileSync(
  resolve(process.cwd(), "pages/noundry.tsx"),
  "utf8"
);

assert.match(
  studioSource,
  /const activateActiveCustomTrait = \(nextPixels: string\[\]\) => \{[\s\S]*?setCustomTraitPixels\(traitType, nextPixels\);[\s\S]*?\[traitType\]: CUSTOM_TRAIT_NAME,/,
  "Studio edits must persist the edited pixels and mark the active layer as custom."
);
assert.match(
  studioSource,
  /const commitPixels = \(nextPixels: string\[\]\) => \{[\s\S]*?activateActiveCustomTrait\(nextPixels\);[\s\S]*?setPixels\(nextPixels\);/,
  "The first committed drawing, fill, move, shape, or clear action must promote a default trait to custom."
);
assert.match(
  studioSource,
  /const continuePixelAction = \(index: number\) => \{[\s\S]*?setCustomTraitPixels\(traitType, nextPixels\);/,
  "Continuous strokes must keep the promoted custom trait pixels in sync."
);
assert.match(
  studioSource,
  /const restoreTouchStrokeSnapshot = \(\) => \{[\s\S]*?persistActiveCustomPixels\(snapshot\.pixels\);[\s\S]*?setPixels\(snapshot\.pixels\);/,
  "Cancelling a touch stroke for a gesture must restore pixels without promoting an unedited default trait."
);

console.log("ok - Noundry studio promotes edited default traits to custom");
