import type {
  AdminRoundVote,
  AdminRoundVoteFilters,
  AdminRoundVoteSort,
  Round,
} from "data/rounds";

export const ADMIN_ROUND_VOTES_CSV_HEADERS = [
  "Vote ID",
  "Round ID",
  "Round Slug",
  "Round Title",
  "Submission ID",
  "Submission Title",
  "Submission Status",
  "Submission Deleted",
  "Voter Wallet",
  "Vote Count",
  "Created At",
  "Updated At",
] as const;

const getQueryValue = (value: string | string[] | undefined) =>
  typeof value === "string" ? value : value?.[0];

const ADMIN_ROUND_VOTE_SORTS = new Set<AdminRoundVoteSort>([
  "newest",
  "oldest",
  "highest",
  "lowest",
]);

export const parseAdminRoundVoteFilters = (query: {
  search?: string | string[];
  submissionId?: string | string[];
  walletAddress?: string | string[];
  sort?: string | string[];
  direction?: string | string[];
}): AdminRoundVoteFilters => {
  const requestedSort = getQueryValue(query.sort);
  const sort = ADMIN_ROUND_VOTE_SORTS.has(requestedSort as AdminRoundVoteSort)
    ? (requestedSort as AdminRoundVoteSort)
    : "newest";

  return {
    search: (getQueryValue(query.search) || "").trim().slice(0, 200),
    submissionId: (getQueryValue(query.submissionId) || "").trim().slice(0, 200),
    walletAddress: (getQueryValue(query.walletAddress) || "").trim().slice(0, 200),
    sort,
    direction: sort === "oldest" || sort === "lowest" ? "asc" : "desc",
  };
};

export const validateAdminRoundVoteCount = (value: unknown) =>
  Number.isInteger(value) && Number(value) > 0
    ? undefined
    : "Vote count must be a positive integer.";

const csvValue = (value: unknown) => {
  let text = value === null || value === undefined ? "" : String(value);

  if (/^[\t\r\n ]*[=+\-@]/.test(text)) {
    text = `'${text}`;
  }

  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const createAdminRoundVotesCsv = ({
  round,
  votes,
}: {
  round: Pick<Round, "id" | "slug" | "title">;
  votes: AdminRoundVote[];
}) => {
  const rows = votes.map((vote) => [
    vote.id,
    round.id,
    round.slug,
    round.title,
    vote.submissionId,
    vote.submissionTitle,
    vote.submissionStatus || "",
    vote.submissionDeleted,
    vote.walletAddress,
    vote.voteCount,
    vote.createdAt,
    vote.updatedAt,
  ]);

  return (
    "\uFEFF" +
    [ADMIN_ROUND_VOTES_CSV_HEADERS, ...rows]
      .map((row) => row.map(csvValue).join(","))
      .join("\r\n")
  );
};

export const getAdminRoundVotesCsvFilename = (
  round: Pick<Round, "slug" | "id">
) => {
  const safeSlug = (round.slug || round.id)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");

  return `${safeSlug || "round"}-votes.csv`;
};
