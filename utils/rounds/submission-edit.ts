import type { Round, RoundSubmission } from "data/rounds";

export type RoundSubmissionEdit = Partial<
  Pick<RoundSubmission, "title" | "description" | "images" | "url">
>;
export class RoundSubmissionEditError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message);
  }
}

export const parseRoundSubmissionEdit = (
  input: unknown
): RoundSubmissionEdit => {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new RoundSubmissionEditError("Submission edits must be an object.");
  const fields = Object.keys(input);
  if (
    !fields.length ||
    fields.some(
      (field) => !["title", "description", "images", "url"].includes(field)
    )
  ) {
    throw new RoundSubmissionEditError(
      "Only title, description, images and URL can be edited."
    );
  }
  const edit = input as Record<string, unknown>;
  for (const field of ["title", "description", "url"]) {
    if (field in edit && typeof edit[field] !== "string")
      throw new RoundSubmissionEditError(`${field} must be text.`);
  }
  if (
    "images" in edit &&
    (!Array.isArray(edit.images) ||
      !edit.images.length ||
      edit.images.length > 10 ||
      edit.images.some((value) => typeof value !== "string" || !value.trim()))
  ) {
    throw new RoundSubmissionEditError(
      "Choose between one and ten image URLs."
    );
  }
  return edit as RoundSubmissionEdit;
};

export const canEditRoundSubmission = (
  round: Pick<Round, "status" | "active" | "votingStartsAt"> & {
    deletedAt?: string | null;
  },
  submission: Pick<RoundSubmission, "walletAddress" | "status"> & {
    userEditedAt?: string | null;
    deletedAt?: string | null;
  },
  walletAddress?: string,
  now = new Date()
) =>
  Boolean(
    walletAddress &&
    submission.walletAddress.toLowerCase() === walletAddress.toLowerCase() &&
    round.status === "published" &&
    round.active &&
    !round.deletedAt &&
    !submission.deletedAt &&
    ["approved", "pending"].includes(submission.status) &&
    !submission.userEditedAt &&
    now.getTime() < new Date(round.votingStartsAt).getTime()
  );
