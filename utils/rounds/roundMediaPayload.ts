import type { RoundWithSubmissions } from "data/rounds";

export type RoundMediaPayload = {
  roundImage: string;
  submissionImages: Record<string, string>;
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
  })),
});

export const createRoundMediaPayload = (
  round: RoundWithSubmissions
): RoundMediaPayload => ({
  roundImage: round.image || "",
  submissionImages: Object.fromEntries(
    round.submissions.map((submission) => [submission.id, submission.image || ""])
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
    submissions: round.submissions.map((submission) => ({
      ...submission,
      image:
        submission.image || media.submissionImages[submission.id] || "",
    })),
  };
};
