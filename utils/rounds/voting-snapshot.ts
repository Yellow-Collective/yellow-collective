export type RoundVotingSnapshotMode = "voting_start" | "custom";

export type RoundVotingSnapshotConfig = {
  votingStartsAt: string;
  votingSnapshotMode: RoundVotingSnapshotMode;
  votingSnapshotAt: string | null;
};

export const isRoundVotingSnapshotMode = (
  value: unknown
): value is RoundVotingSnapshotMode =>
  value === "voting_start" || value === "custom";

export const getEffectiveRoundVotingSnapshotAt = (
  config: RoundVotingSnapshotConfig
) =>
  config.votingSnapshotMode === "custom"
    ? config.votingSnapshotAt || ""
    : config.votingStartsAt;

export const validateRoundVotingSnapshot = (
  config: RoundVotingSnapshotConfig
) => {
  if (!isRoundVotingSnapshotMode(config.votingSnapshotMode)) {
    return "Voting snapshot type is invalid.";
  }

  const votingStartsAt = new Date(config.votingStartsAt).getTime();
  if (!Number.isFinite(votingStartsAt)) {
    return "Voting start date must be valid.";
  }

  if (config.votingSnapshotMode === "custom" && !config.votingSnapshotAt) {
    return "A custom voting snapshot date is required.";
  }

  const effectiveSnapshotAt = new Date(
    getEffectiveRoundVotingSnapshotAt(config)
  ).getTime();
  if (!Number.isFinite(effectiveSnapshotAt)) {
    return "Voting snapshot date must be valid.";
  }

  if (effectiveSnapshotAt > votingStartsAt) {
    return "The voting snapshot date must be at or before voting begins.";
  }

  return undefined;
};

export const hasRoundVotingSnapshotChanged = (
  current: RoundVotingSnapshotConfig,
  next: RoundVotingSnapshotConfig
) => {
  const currentTimestamp = new Date(
    getEffectiveRoundVotingSnapshotAt(current)
  ).getTime();
  const nextTimestamp = new Date(
    getEffectiveRoundVotingSnapshotAt(next)
  ).getTime();

  return currentTimestamp !== nextTimestamp;
};

export const isRoundVotingSnapshotReady = (
  effectiveSnapshotAt: string,
  latestBlockTimestamp: number
) => {
  const targetTimestamp = Math.floor(
    new Date(effectiveSnapshotAt).getTime() / 1000
  );

  return (
    Number.isFinite(targetTimestamp) &&
    Number.isFinite(latestBlockTimestamp) &&
    targetTimestamp <= latestBlockTimestamp
  );
};
