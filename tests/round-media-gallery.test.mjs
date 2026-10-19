import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { corpus, makeRoundMediaFixture, fixtureUrl } from "./fixtures/round-media-fixture.mjs";
import { loadRoundMediaModule } from "./fixtures/load-round-media-module.mjs";
const require = createRequire(import.meta.url);
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const media = loadRoundMediaModule("utils/rounds/roundMediaPayload.ts");
const { RoundImageGallery } = loadRoundMediaModule("components/rounds/RoundImageGallery.tsx", { "@/utils/rounds/roundMediaPayload": media });
const { processRoundImage } = loadRoundMediaModule("utils/rounds/image-processing.ts");

const images = [
  "/api/rounds/test/asset?id=one&index=0&variant=preview&v=1",
  "/api/rounds/test/asset?id=one&index=1&variant=original&v=1",
  "/api/rounds/test/asset?id=one&index=2&variant=original&v=1",
];
const html = renderToStaticMarkup(React.createElement(RoundImageGallery, { images, title: "Gallery artwork" }));
assert.equal((html.match(/<img\b/g) || []).length, 1);
assert.match(html, /index=0&amp;variant=original/);
assert.equal(html.includes("index=1"), false);
assert.equal(html.includes("index=2"), false);
assert.match(html, /Show image 3 of 3/);
assert.match(html, /aria-pressed="true"/);
assert.match(renderToStaticMarkup(React.createElement(RoundImageGallery, { images: [], title: "Unavailable" })), /Artwork is unavailable/);
console.log("ok - real gallery component mounts only the selected original and accessible numbered controls");

const processed = await processRoundImage(corpus[2].inline);
assert.equal(processed.frames, 8);
assert.deepEqual(processed.original, corpus[2].bytes);
assert.equal(processed.sha256, "af3b049ea9ae0d4a51d695340db65672e248e584f3aa6fb767ac0e42b1c5b513");
assert.ok(processed.previewBytes < processed.bytes);
console.log("ok - eight-frame GIF remains byte-identical; stored still fallback is smaller but grid delivery preserves animation");

const fixture = makeRoundMediaFixture({ mode: "migrated" });
const payload = media.createRoundMediaPayload(fixture, 2);
assert.ok(Buffer.byteLength(JSON.stringify(payload)) < 100 * 1024);
assert.equal(Object.hasOwn(payload, "submissionImages"), false);
assert.equal(fixtureUrl("submission-000", 0).length, 128);
assert.equal(JSON.stringify(payload).includes("data:image/"), false);
assert.equal(JSON.stringify(media.stripRoundInlineMediaForSsr(fixture)).includes("data:image/"), false);
console.log("ok - 100 entries times five 128-byte ASCII URLs satisfy manifest budget and scrub nested SSR media");
