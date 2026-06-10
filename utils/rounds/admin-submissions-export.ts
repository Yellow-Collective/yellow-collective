import type { ProfileMetadata } from "data/profile";
import type { Round, RoundSubmission } from "data/rounds";

export const ROUND_SUBMISSIONS_CSV_HEADERS = [
  "Username",
  "Wallet Address",
  "Project Title",
  "Date Submitted",
  "Place After Voting",
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
  round: Pick<Round, "votingEndsAt">;
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
  const rows = submissions.map((submission) => [
    usernamesByWallet.get(submission.walletAddress.toLowerCase()) || "",
    submission.walletAddress,
    submission.title,
    formatSubmittedAt(submission.createdAt),
    placements.get(submission.id) || "",
  ]);

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
