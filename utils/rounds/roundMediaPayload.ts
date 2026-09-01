import type { RoundWithSubmissions } from "data/rounds";

export type RoundMediaPayload = {
  roundImage: string;
  submissionImages: Record<string, string>;
  submissionImageSets: Record<string, string[]>;
};

export const isInlineDataImage = (src?: string | null) =>
  typeof src === "string" && src.startsWith("data:image/");

export const stripInlineDataImage = (src?: string | null) =>
  isInlineDataImage(src) ? "" : src || "";

export const stripRoundInlineMediaForSsr = (
  round: RoundWithSubmissions
): RoundWithSubmissions => ({
  ...round,
  image: stripInlineDataImage(round.image),
  submissions: round.submissions.map((submission) => ({
    ...submission,
    image: stripInlineDataImage(submission.image),
    images: (submission.images || [submission.image]).map(stripInlineDataImage),
  })),
});

export const createRoundMediaPayload = (
  round: RoundWithSubmissions
): RoundMediaPayload => ({
  roundImage: round.image || "",
  submissionImages: Object.fromEntries(
    round.submissions.map((submission) => [
      submission.id,
      submission.image || "",
    ])
  ),
  submissionImageSets: Object.fromEntries(
    round.submissions.map((submission) => [
      submission.id,
      submission.images || [submission.image],
    ])
  ),
});

export const hydrateRoundInlineMedia = (
  round: RoundWithSubmissions | null,
  media?: RoundMediaPayload
): RoundWithSubmissions | null => {
  if (!round || !media) return round;

  return {
    ...round,
    image: round.image || media.roundImage || "",
    submissions: round.submissions.map((submission) => {
      const mediaImages = media.submissionImageSets?.[submission.id] || [];
      const images = (submission.images || [submission.image]).map(
        (image, index) => image || mediaImages[index] || ""
      );
      const legacyImage =
        submission.image ||
        media.submissionImages[submission.id] ||
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
