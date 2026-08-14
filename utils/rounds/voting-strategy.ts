export const DEFAULT_BASE_VOTES_PER_WALLET = 100;
export const DEFAULT_VOTES_PER_WALLET = 1;

export const getDefaultRoundVotesPerWallet = (votingStrategy: string) =>
  votingStrategy === "base_plus_voting_power"
    ? DEFAULT_BASE_VOTES_PER_WALLET
    : DEFAULT_VOTES_PER_WALLET;

export const getRoundVotingStrategyLabel = (
  round: {
    votingStrategy: string;
    votesPerWallet: number;
  } | null
) => {
  if (!round) return "the configured voting rules";

  const { votingStrategy, votesPerWallet } = round;

  if (votingStrategy === "one_per_wallet") {
    return "1 vote per wallet";
  }

  if (votingStrategy === "fixed_per_wallet") {
    return `${votesPerWallet} votes per wallet`;
  }

  if (votingStrategy === "base_plus_voting_power") {
    return `${votesPerWallet} votes + voting power`;
  }

  return "1 vote per delegated Collective Noun vote";
};
