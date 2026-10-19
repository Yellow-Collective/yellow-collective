import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { gzipSync, brotliCompressSync, constants } from "node:zlib";
import { corpus, makeRoundMediaFixture, createBaselineRoundMediaPayload, fixtureUrl } from "../tests/fixtures/round-media-fixture.mjs";
import { loadRoundMediaModule } from "../tests/fixtures/load-round-media-module.mjs";

const { createRoundMediaPayload, stripRoundInlineMediaForSsr } = loadRoundMediaModule("utils/rounds/roundMediaPayload.ts");
const { processRoundImage } = loadRoundMediaModule("utils/rounds/image-processing.ts");
const sizes = (value) => {
  const bytes = Buffer.from(JSON.stringify(value));
  return { raw: bytes.length, gzip9: gzipSync(bytes, { level: 9 }).length, brotli11: brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length };
};
const legacy = makeRoundMediaFixture();
const migrated = makeRoundMediaFixture({ mode: "migrated" });
const before = createBaselineRoundMediaPayload(legacy);
const after = createRoundMediaPayload(legacy, 2);
const target = createRoundMediaPayload(migrated, 2);
const processed = [];
for (const item of corpus) {
  const result = await processRoundImage(item.inline);
  assert.equal(result.sha256, item.sha256);
  assert.deepEqual(result.original, item.bytes);
  processed.push({ name: item.name, originalBytes: result.bytes, previewBytes: result.previewBytes, gridBytes: result.mime === "image/gif" ? result.bytes : result.previewBytes, width: result.width, height: result.height, frames: result.frames, sha256: result.sha256 });
}
const previewTotal = Array.from({ length: 100 }, (_, index) => processed[index % 3].gridBytes).reduce((a, b) => a + b, processed[0].gridBytes);
const query = sizes(after);
const targetSize = sizes(target);
const beforeSize = sizes(before);
const voteBefore = sizes({ submissions: legacy.submissions, votingPower: 10, votingSnapshotBlock: 100 });
const voteAfter = sizes({ committed: true, acceptedVotes: 2, usedVotes: 7, remainingVotes: 3, votingPower: 10, votingSnapshotBlock: 100 });
assert.ok(voteAfter.raw < 2048, `Vote receipt: ${voteAfter.raw} bytes`);
const baselineSsr = { ...legacy, image: "", submissions: legacy.submissions.map((entry) => ({ ...entry, image: "", images: entry.images.map(() => "") })) };
const ssrBeforeSize = sizes({ pageProps: { round: baselineSsr } });
const ssrAfterSize = sizes({ pageProps: { round: stripRoundInlineMediaForSsr(migrated) } });
assert.ok(targetSize.raw < 100 * 1024, `128-byte URL manifest: ${targetSize.raw} bytes`);
assert.equal(fixtureUrl("submission-000", 0).length, 128);
assert.equal(JSON.stringify(after).includes("data:image/"), false);
assert.equal(JSON.stringify(stripRoundInlineMediaForSsr(migrated)).includes("data:image/"), false);
const report = {
  fixture: { submissions: 100, imagesPerSubmission: 5, distinctOriginals: 3, compression: "JSON UTF-8, gzip level 9, Brotli quality 11; identical corpus reused across entries", corpus: processed },
  mediaJson: { before: beforeSize, afterGatewayManifest: query, migrated128ByteUrls: targetSize },
  voteJson: { before: voteBefore, after: voteAfter, postCommitFullSubmissionReads: { before: 1, after: 0 } },
  ssrProps: { before: ssrBeforeSize, after: ssrAfterSize },
  // Full fixture grid loaded to bound lazy browser behavior from above: each entry
  // has its own resource URL even when the corpus repeats. Excludes app shell/JS.
  initialMediaNavigation: {
    before: { requests: 1, ...beforeSize, originalsEmbedded: 500, previewImageRequests: 0, databaseReads: 4 },
    legacyGateway: { applicationRequests: 102, storageRequests: 0, raw: query.raw + previewTotal, gzip9: query.gzip9 + previewTotal, brotli11: query.brotli11 + previewTotal, originalsFetched: 33, staticOriginalsFetched: 0, hiddenGalleryOriginalsFetched: 0, previewImageRequests: 101, databaseReads: 103, coldThumbnailDecodes: 2 },
    migratedPrivateStorage: { applicationRequests: 102, storageRequests: 100, raw: query.raw + previewTotal, gzip9: query.gzip9 + previewTotal, brotli11: query.brotli11 + previewTotal, originalsFetched: 33, staticOriginalsFetched: 0, hiddenGalleryOriginalsFetched: 0, previewImageRequests: 101, databaseReads: 103, thumbnailDecodes: 1, legacyCoverRequests: 1 },
  },
  openingOriginal: { corpusFirstPng: { additionalApplicationRequests: 1, additionalStorageRequestsIfMigrated: 1, bytes: processed[0].originalBytes }, animatedGif: { additionalApplicationRequests: 1, additionalStorageRequestsIfMigrated: 1, bytes: processed[2].originalBytes, frames: processed[2].frames, sha256: processed[2].sha256 }, hiddenGalleryRequests: 0 },
  assumptions: ["Transfer totals model media only and omit HTML/app JS/TLS/header bytes; actual browser evidence is separate.", "Database reads count two manifest queries and one eligibility read per asset; schema work is excluded after initialization.", "Private storage redirects add a request per displayed asset; legacy fallback serves one bounded asset through the function and performs cold preview work.", "Signed provider URL lengths are not measured by this fixture; actual offline presigning is reported separately if available.", "No production requests, uploads, database access, or billable transforms.", "The three repeated originals yield unusually strong Brotli compression. Full-grid modeled Brotli bytes regress versus that baseline; the fixture is retained unchanged and this miss is reported."],
};
mkdirSync("output/round-media", { recursive: true });
writeFileSync("output/round-media/benchmark.json", `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
