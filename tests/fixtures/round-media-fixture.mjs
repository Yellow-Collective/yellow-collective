import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

// Fixed repository artwork and an eight-frame animated GIF; never downloaded.
export const corpus = [
  ["artwork.png", "image/png"],
  ["portrait.png", "image/png"],
  ["animation.gif", "image/gif"],
].map(([name, mimeType]) => {
  const bytes = readFileSync(new URL(`./round-media/${name}`, import.meta.url));
  return { name, mimeType, bytes, sha256: createHash("sha256").update(bytes).digest("hex"), inline: `data:${mimeType};base64,${bytes.toString("base64")}` };
});

export const fixtureUrl = (submission, index) => {
  const prefix = `https://fixtures.invalid/round-media/${submission}/${index}/`;
  return `${prefix}${"a".repeat(128 - prefix.length - 4)}.png`;
};

export const makeRoundMediaFixture = ({ count = 100, mode = "legacy" } = {}) => {
  const timestamp = "2026-10-19T12:00:00.000Z";
  const round = {
    id: "fixture-round", slug: "bandwidth-fixture", title: "Bandwidth fixture", description: "Deterministic local artwork and gallery fixture.", content: "", image: corpus[0].inline,
    startsAt: "2026-01-01T00:00:00.000Z", submissionsOpenAt: "2026-01-01T00:00:00.000Z", votingStartsAt: "2026-02-01T00:00:00.000Z", votingEndsAt: "2099-01-01T00:00:00.000Z", endsAt: "2099-01-01T00:00:00.000Z",
    active: true, featured: true, isTraitContest: false, traitSubmissionsEnabled: false, status: "published", votingStrategy: "fixed_per_wallet", votesPerWallet: 10, maxVotesPerEntry: null,
    votingSnapshotMode: "none", votingSnapshotAt: null, votingSnapshotBlock: null, winnerCount: 3, maxSubmissionsPerWallet: 10, minTitleLength: 1, maxTitleLength: 200, minDescriptionLength: 1, maxDescriptionLength: 4000,
    createdAt: timestamp, updatedAt: timestamp, deletedAt: null, submissionCount: count, approvedSubmissionCount: count, totalVotes: 0, awards: [], voteActivity: [],
    submissions: Array.from({ length: count }, (_, index) => {
      const id = `submission-${String(index).padStart(3, "0")}`;
      const isMigrated = mode === "migrated" || (mode === "mixed" && index % 2 === 0);
      const images = Array.from({ length: 5 }, (_, imageIndex) => isMigrated ? fixtureUrl(id, imageIndex) : corpus[(index + imageIndex) % corpus.length].inline);
      return { id, roundId: "fixture-round", walletAddress: `0x${(index + 1).toString(16).padStart(40, "0")}`, title: `Artwork ${index + 1}`, description: `Gallery entry ${index + 1}; original image order and animation preserved.`, image: images[0], images, url: "", submissionType: "project", traitId: null, traitType: null, source: "fixture", sourcePayload: { caption: `Fixture ${index + 1}`, nested: { preview: corpus[2].inline } }, status: "approved", createdAt: timestamp, updatedAt: timestamp, approvedAt: timestamp, rejectedAt: null, hiddenAt: null, deletedAt: null, voteCount: 0, winnerPosition: null };
    }),
  };
  if (mode === "migrated") round.image = fixtureUrl("cover", 0);
  return round;
};

// Captured pre-change serializer, kept fixed for the same fixture before/after.
export const createBaselineRoundMediaPayload = (round) => ({
  roundImage: round.image || "",
  submissionImages: Object.fromEntries(round.submissions.map((entry) => [entry.id, entry.image || ""])),
  submissionImageSets: Object.fromEntries(round.submissions.map((entry) => [entry.id, entry.images || [entry.image]])),
});
