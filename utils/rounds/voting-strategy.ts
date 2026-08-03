export const DEFAULT_BASE_VOTES_PER_WALLET = 100;
export const DEFAULT_VOTES_PER_WALLET = 1;

export const getDefaultRoundVotesPerWallet = (votingStrategy: string) =>
  votingStrategy === "base_plus_voting_power"
    ? DEFAULT_BASE_VOTES_PER_WALLET
    : DEFAULT_VOTES_PER_WALLET;
