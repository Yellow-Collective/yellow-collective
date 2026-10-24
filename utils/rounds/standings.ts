import type { RoundSubmission, RoundWithSubmissions } from "data/rounds";

export type RoundStandings = {
  roundId: string;
  totalVotes: number;
  submissions: Pick<RoundSubmission, "id" | "voteCount" | "status">[];
};

// Finalized winnerPosition is historical metadata. Display ranks always follow
// the retained votes, including corrections made after voting has ended.
export const applyRoundStandings = (
  round: RoundWithSubmissions | null,
  standings?: RoundStandings
): RoundWithSubmissions | null => {
  if (!round) return null;
  const current = standings?.roundId === round.id ? standings : undefined;
  const counts = current && new Map(current.submissions.map((entry) => [entry.id, entry]));
  const submissions = round.submissions
    .filter((submission) => !counts || counts.has(submission.id))
    .map((submission) => {
      const entry = counts?.get(submission.id);
      return entry ? { ...submission, voteCount: entry.voteCount, status: entry.status } : submission;
    })
    .sort((a, b) => {
      // Historic winners retain existing visibility but cannot occupy a current
      // winning place after rejection/hiding.
      const eligibility = Number(b.status === "approved") - Number(a.status === "approved");
      const votes = b.voteCount - a.voteCount;
      const created = Date.parse(b.createdAt) - Date.parse(a.createdAt);
      return eligibility || votes || (Number.isFinite(created) ? created : 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    });
  return { ...round, totalVotes: current?.totalVotes ?? round.totalVotes, submissions };
};
