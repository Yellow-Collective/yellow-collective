import type { Round } from "data/rounds";
import { getCollectiveNounVotingPower } from "./getCollectiveNounVotingPower";

export const getRoundVotingPower = async (
  round: Pick<
    Round,
    "votingStrategy" | "votesPerWallet" | "votingSnapshotBlock"
  >,
  walletAddress: string
) => {
  const collectiveNounVotingPower = await getCollectiveNounVotingPower(
    walletAddress,
    round.votingSnapshotBlock ?? undefined
  );

  if (collectiveNounVotingPower <= 0) return 0;

  if (round.votingStrategy === "one_per_wallet") return 1;
  if (round.votingStrategy === "fixed_per_wallet") return round.votesPerWallet;

  if (round.votingStrategy === "base_plus_voting_power") {
    const votingPower = round.votesPerWallet + collectiveNounVotingPower;
    if (!Number.isSafeInteger(votingPower) || votingPower < 0) {
      throw new Error("Round voting power must be a non-negative safe integer.");
    }

    return votingPower;
  }

  return collectiveNounVotingPower;
};
