import type { Round, RoundWithSubmissions, RoundSubmission } from "data/rounds";
export type RoundMediaSource = Pick<RoundWithSubmissions, "slug" | "image" | "updatedAt"> & {
  submissions: Pick<RoundSubmission, "id" | "updatedAt" | "image" | "images">[];
};

export type RoundMediaPayload = {
  version?: 2;
  revision?: string;
  roundImage: string;
  submissionImages?: Record<string, string>;
  submissionImageSets: Record<string, string[]>;
};

export const isInlineDataImage = (src?: string | null) =>
  typeof src === "string" && src.startsWith("data:image/");

export const stripInlineDataImage = (src?: string | null) =>
  isInlineDataImage(src) ? "" : src || "";

// Domain records retain source metadata for exports/admin. Only serialization
// copies are scrubbed, including legacy/nested preview fields.
export const stripNestedInlineMedia = (value: any): any => {
  if (typeof value === "string") return /data:image\//i.test(value) ? "" : value;
  if (Array.isArray(value)) return value.map(stripNestedInlineMedia);
  if (value && typeof value === "object") return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, stripNestedInlineMedia(item)])
  );
  return value;
};

const selectFields = (value: any, fields: string[]) => Object.fromEntries(fields.filter((key) => value[key] !== undefined).map((key) => [key, value[key]]));
const roundFields = "id slug title description content image startsAt submissionsOpenAt votingStartsAt votingEndsAt endsAt active featured isTraitContest traitSubmissionsEnabled status votingStrategy votesPerWallet maxVotesPerEntry votingSnapshotMode votingSnapshotAt votingSnapshotBlock winnerCount maxSubmissionsPerWallet minTitleLength maxTitleLength minDescriptionLength maxDescriptionLength createdAt updatedAt approvedSubmissionCount totalVotes".split(" ");
const submissionFields = "id roundId walletAddress title description image images url submissionType traitId traitType source status createdAt updatedAt userEditedAt voteCount winnerPosition".split(" ");
const traitFields = "id title artist traitType pixels selectedTraits previewTraits status createdAt updatedAt roundSubmissionAutoDescription roundSubmissionIdentityLabel".split(" ");

// Keep domain/storage records intact. Only these presentation copies leave the server.
export const serializePublicRoundSubmission = (submission: RoundSubmission): RoundSubmission => ({
  ...stripNestedInlineMedia(selectFields(submission, submissionFields)),
  sourcePayload: submission.sourcePayload ? stripNestedInlineMedia(selectFields(submission.sourcePayload, traitFields)) : null,
  image: stripInlineDataImage(submission.image),
  images: (submission.images || [submission.image]).map(stripInlineDataImage),
  // Playback resolves the object key on the server after checking public eligibility.
  video: submission.video ? { duration: submission.video.duration, width: submission.video.width, height: submission.video.height } : null,
} as RoundSubmission);

export const serializePublicRound = (round: Round): Round => ({
  ...stripNestedInlineMedia(selectFields(round, roundFields)),
  image: stripInlineDataImage(round.image),
  awards: (round.awards || []).map((award) => selectFields(award, "id position title description value".split(" "))),
} as Round);

export type PublicRoundSummary = Pick<Round, "id" | "slug" | "title" | "description" | "image" | "status" | "active" | "startsAt" | "submissionsOpenAt" | "votingStartsAt" | "votingEndsAt" | "approvedSubmissionCount" | "totalVotes">;
export const serializePublicRoundSummary = (round: Round): PublicRoundSummary => ({
  ...stripNestedInlineMedia(selectFields(round, "id slug title description status active startsAt submissionsOpenAt votingStartsAt votingEndsAt approvedSubmissionCount totalVotes".split(" "))),
  image: isInlineDataImage(round.image) ? roundAssetUrl(round.slug, null, 0, "preview", round.updatedAt) : stripInlineDataImage(round.image),
});

export const roundAssetUrl = (slug: string, id: string | null, index: number, variant: "preview" | "original", revision: string) =>
  `/api/rounds/${encodeURIComponent(slug)}/asset?${id ? `id=${encodeURIComponent(id)}&index=${index}` : "cover=1"}&variant=${variant}&v=${encodeURIComponent(revision)}`;

export const getRoundOriginalImage = (src: string) =>
  src.includes("/asset?") ? src.replace(/variant=preview\b/, "variant=original") : src;

// Traits can render from pixels without an image URL. Remove every entry when
// public eligibility cannot be refreshed, including those derived render paths.
export const clearRoundArtwork = (round: RoundWithSubmissions): RoundWithSubmissions => ({
  ...round,
  image: "",
  submissions: [],
});

export const stripRoundInlineMediaForSsr = (
  round: RoundWithSubmissions
): RoundWithSubmissions => ({
  ...serializePublicRound(round),
  voteActivity: (round.voteActivity || []).map((vote) => selectFields(vote, "id walletAddress submissionId submissionTitle voteCount createdAt updatedAt".split(" "))),
  submissions: round.submissions.map(serializePublicRoundSubmission),
} as RoundWithSubmissions);

export const createRoundMediaPayload = (
  round: RoundMediaSource,
  version: 1 | 2 = 2
): RoundMediaPayload => {
  const submissionImageSets = Object.fromEntries(
    round.submissions.map((submission) => [
      submission.id,
      (submission.images?.length ? submission.images : [submission.image]).map((src, index) =>
        isInlineDataImage(src) || src === "__inline__"
          ? roundAssetUrl(round.slug, submission.id, index, version === 2 && index === 0 ? "preview" : "original", submission.updatedAt || "")
          : src || ""
      ),
    ])
  );
  const payload: RoundMediaPayload = {
    ...(version === 2 ? { version: 2 as const, revision: [round.updatedAt, ...round.submissions.map((s) => `${s.id}:${s.updatedAt}`)].join("|") } : {}),
    roundImage: isInlineDataImage(round.image) || round.image === "__inline__"
      ? roundAssetUrl(round.slug, null, 0, version === 2 ? "preview" : "original", round.updatedAt || "") : round.image || "",
    submissionImageSets,
  };
  if (version === 1) payload.submissionImages = Object.fromEntries(Object.entries(submissionImageSets).map(([id, images]) => [id, images[0] || ""]));
  return payload;
};

export const hydrateRoundInlineMedia = (
  round: RoundWithSubmissions | null,
  media?: RoundMediaPayload
): RoundWithSubmissions | null => {
  if (!round || !media) return round;

  return {
    ...round,
    image: media.version === 2 ? media.roundImage : round.image || media.roundImage || "",
    submissions: round.submissions.filter((submission) => media.version !== 2 || Object.prototype.hasOwnProperty.call(media.submissionImageSets, submission.id)).map((submission) => {
      const mediaImages = media.submissionImageSets?.[submission.id] || [];
      const images = media.version === 2 ? mediaImages : (submission.images || [submission.image]).map(
        (image, index) => image || mediaImages[index] || ""
      );
      const legacyImage =
        (media.version === 2 ? "" : submission.image) ||
        media.submissionImages?.[submission.id] ||
        images[0] ||
        "";

      return {
        ...submission,
        image: legacyImage,
        images: images.length > 0 ? images : legacyImage ? [legacyImage] : [],
      };
    }),
  };
};
