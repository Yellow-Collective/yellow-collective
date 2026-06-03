export type RoundVoteAllocationInput = {
  submissionId: string;
  voteCount: number;
};

export const validateRoundVoteAllocation = ({
  votingPower,
  usedVotes,
  votes,
}: {
  votingPower: number;
  usedVotes?: number;
  votes: RoundVoteAllocationInput[];
}) => {
  if (!Number.isInteger(votingPower) || votingPower < 0) {
    return "Voting power is invalid.";
  }

  if (!Array.isArray(votes) || votes.length === 0) {
    return "Select at least one submission to vote for.";
  }

  const seen = new Set<string>();
  const totalVotes = votes.reduce((total, vote) => {
    if (!vote.submissionId || typeof vote.submissionId !== "string") {
      throw new Error("Submission id is required.");
    }

    if (seen.has(vote.submissionId)) {
      throw new Error("Duplicate vote allocation.");
    }

    seen.add(vote.submissionId);

    if (!Number.isInteger(vote.voteCount) || vote.voteCount <= 0) {
      throw new Error("Vote count must be a positive whole number.");
    }

    return total + vote.voteCount;
  }, 0);

  if (votingPower <= 0) {
    return "This wallet has no Collective Noun voting power.";
  }

  if (totalVotes > votingPower) {
    return `You can allocate up to ${votingPower} vote${
      votingPower === 1 ? "" : "s"
    }.`;
  }

  if (usedVotes !== undefined) {
    if (!Number.isInteger(usedVotes) || usedVotes < 0) {
      return "Existing vote usage is invalid.";
    }

    if (usedVotes > votingPower) {
      return "Existing vote usage exceeds voting power.";
    }

    const remainingVotes = votingPower - usedVotes;
    if (totalVotes > remainingVotes) {
      return `You have ${remainingVotes} vote${
        remainingVotes === 1 ? "" : "s"
      } remaining.`;
    }
  }

  return undefined;
};
