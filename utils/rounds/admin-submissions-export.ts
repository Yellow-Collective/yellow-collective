import type { ProfileMetadata } from "data/profile";
import type { Round, RoundSubmission } from "data/rounds";

export const ROUND_SUBMISSIONS_CSV_HEADERS = [
  "Username",
  "Wallet Address",
  "Project Title",
  "Date Submitted",
  "Place After Voting",
  "Prize Title",
  "Prize Value",
  "Prize Description",
];

const csvValue = (value: string | number | null | undefined) => {
  const text = value === null || value === undefined ? "" : String(value);

  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const formatSubmittedAt = (value: string) => {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : value;
};

export const hasRoundVotingEnded = (round: Pick<Round, "votingEndsAt">) => {
  const votingEndsAt = new Date(round.votingEndsAt).getTime();
  return Number.isFinite(votingEndsAt) && votingEndsAt <= Date.now();
};

export const getRoundSubmissionPlacements = (
  round: Pick<Round, "votingEndsAt">,
  submissions: RoundSubmission[]
) => {
  if (!hasRoundVotingEnded(round)) return new Map<string, number>();

  const rankedSubmissions = submissions
    .filter((submission) => submission.status === "approved")
    .sort((first, second) => {
      if (second.voteCount !== first.voteCount) {
        return second.voteCount - first.voteCount;
      }

      return (
        new Date(second.createdAt).getTime() -
        new Date(first.createdAt).getTime()
      );
    });

  return new Map(
    rankedSubmissions.map((submission, index) => [submission.id, index + 1])
  );
};

export const createRoundSubmissionsCsv = ({
  round,
  submissions,
  profiles,
}: {
  round: Pick<Round, "votingEndsAt" | "awards">;
  submissions: RoundSubmission[];
  profiles: ProfileMetadata[];
}) => {
  const usernamesByWallet = new Map(
    profiles.map((profile) => [
      profile.walletAddress.toLowerCase(),
      profile.username,
    ])
  );
  const placements = getRoundSubmissionPlacements(round, submissions);
  const awardsByPosition = new Map(
    (round.awards || []).map((award) => [award.position, award])
  );
  const rows = submissions.map((submission) => {
    const placement = placements.get(submission.id);
    const award = placement ? awardsByPosition.get(placement) : null;

    return [
      usernamesByWallet.get(submission.walletAddress.toLowerCase()) || "",
      submission.walletAddress,
      submission.title,
      formatSubmittedAt(submission.createdAt),
      placement || "",
      award?.title || "",
      award?.value || "",
      award?.description || "",
    ];
  });

  return [ROUND_SUBMISSIONS_CSV_HEADERS, ...rows]
    .map((row) => row.map(csvValue).join(","))
    .join("\n");
};

export const getRoundSubmissionsCsvFilename = (
  round: Pick<Round, "slug" | "id">
) => {
  const safeSlug = (round.slug || round.id)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${safeSlug || "round"}-submissions.csv`;
};

export const ROUND_SUBMISSIONS_ZIP_CSV_HEADERS = [
  "submission_id",
  "round_id",
  "round_slug",
  "round_title",
  "title",
  "author_wallet_address",
  "description",
  "project_url",
  "original_image_url",
  "artwork_filename",
  "artwork_export_status",
  "artwork_export_error",
  "submission_type",
  "trait_id",
  "trait_type",
  "source",
  "source_payload_json",
  "status",
  "vote_count",
  "winner_position",
  "created_at",
  "updated_at",
  "approved_at",
  "rejected_at",
  "hidden_at",
] as const;

export type RoundArtworkExportResult = {
  status: "exported" | "failed";
  filename: string;
  error: string;
};

const ZIP_CONTENT_TYPE_EXTENSIONS: Record<string, string> = {
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const sanitizeArchiveFilenamePart = (
  value: string,
  fallback: string,
  maxLength: number
) => {
  const sanitized = String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, "-")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");

  return sanitized || fallback;
};

export const isRoundExportable = (
  round: Pick<Round, "status" | "votingEndsAt">,
  now = new Date()
) => {
  if (round.status === "draft") return false;

  const votingEndsAt = new Date(round.votingEndsAt).getTime();
  return Number.isFinite(votingEndsAt) && votingEndsAt <= now.getTime();
};

export const getRoundSubmissionArtworkFilename = ({
  index,
  submission,
  contentType,
}: {
  index: number;
  submission: Pick<RoundSubmission, "id" | "title">;
  contentType: string;
}) => {
  const extension =
    ZIP_CONTENT_TYPE_EXTENSIONS[contentType.toLowerCase().split(";", 1)[0]];
  if (!extension) throw new Error("Unsupported artwork image type.");

  const position = String(index + 1).padStart(3, "0");
  const title = sanitizeArchiveFilenamePart(submission.title, "untitled", 64);
  const submissionId = sanitizeArchiveFilenamePart(
    submission.id,
    `submission-${position}`,
    48
  );

  return `${position}-${title}-${submissionId}.${extension}`;
};

export const getRoundSubmissionsZipFilename = (
  round: Pick<Round, "slug" | "id">
) => {
  const safeSlug = sanitizeArchiveFilenamePart(
    round.slug || round.id,
    "round",
    80
  );
  return `${safeSlug}-submissions.zip`;
};

const safeJsonStringify = (value: unknown) => {
  if (value === null || value === undefined) return "";

  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
};

const zipCsvValue = (value: unknown) => {
  let text = value === null || value === undefined ? "" : String(value);

  if (/^[\t\r\n ]*[=+\-@]/.test(text)) {
    text = `'${text}`;
  }

  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const createRoundSubmissionsZipCsv = ({
  round,
  submissions,
  artworkResults,
}: {
  round: Pick<Round, "id" | "slug" | "title">;
  submissions: RoundSubmission[];
  artworkResults: Record<string, RoundArtworkExportResult>;
}) => {
  const rows = submissions.map((submission) => {
    const artwork = artworkResults[submission.id] || {
      status: "failed" as const,
      filename: "",
      error: "Artwork was not exported.",
    };

    return [
      submission.id,
      round.id,
      round.slug,
      round.title,
      submission.title,
      submission.walletAddress,
      submission.description,
      submission.url,
      submission.image,
      artwork.filename ? `artwork/${artwork.filename}` : "",
      artwork.status,
      artwork.error,
      submission.submissionType,
      submission.traitId,
      submission.traitType,
      submission.source,
      safeJsonStringify(submission.sourcePayload),
      submission.status,
      submission.voteCount,
      submission.winnerPosition,
      submission.createdAt,
      submission.updatedAt,
      submission.approvedAt,
      submission.rejectedAt,
      submission.hiddenAt,
    ];
  });

  return (
    "\uFEFF" +
    [ROUND_SUBMISSIONS_ZIP_CSV_HEADERS, ...rows]
      .map((row) => row.map(zipCsvValue).join(","))
      .join("\r\n")
  );
};
