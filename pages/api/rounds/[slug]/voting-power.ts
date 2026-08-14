import type { NextApiRequest, NextApiResponse } from "next";
import {
  getOrCreateRoundVotingSnapshotBlock,
  getPublicRoundBySlug,
} from "data/rounds";
import { getRoundVotingPower } from "@/utils/rounds/getRoundVotingPower";
import { getRoundVoteUsage } from "@/utils/rounds/getRoundVoteUsage";
import { getEffectiveRoundVotingSnapshotAt } from "@/utils/rounds/voting-snapshot";
import { getAddress, isAddress } from "viem";

const getSlug = (req: NextApiRequest) => {
  const slug = req.query.slug;
  return typeof slug === "string" ? slug : slug?.[0];
};

const getWallet = (req: NextApiRequest) => {
  const wallet = req.query.wallet;
  return typeof wallet === "string" ? wallet : wallet?.[0];
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const slug = getSlug(req);
  const wallet = getWallet(req);

  if (!slug) return res.status(400).json({ error: "Round slug is required." });
  if (!wallet || !isAddress(wallet)) {
    return res.status(400).json({ error: "A valid wallet is required." });
  }

  try {
    const round = await getPublicRoundBySlug(slug);
    if (!round) return res.status(404).json({ error: "Round not found." });

    const walletAddress = getAddress(wallet);
    const votingSnapshotBlock =
      await getOrCreateRoundVotingSnapshotBlock(round);
    const votingSnapshotAt = getEffectiveRoundVotingSnapshotAt(round);

    if (votingSnapshotBlock === null) {
      const usedVotes = await getRoundVoteUsage({
        roundId: round.id,
        walletAddress,
      });

      return res.status(200).json({
        walletAddress,
        votingPower: 0,
        usedVotes,
        remainingVotes: 0,
        votingSnapshotBlock: null,
        votingSnapshotAt,
        votingSnapshotStatus: "pending",
      });
    }

    const roundForVoting = {
      ...round,
      votingSnapshotBlock: votingSnapshotBlock ?? round.votingSnapshotBlock,
    };
    const [votingPower, usedVotes] = await Promise.all([
      getRoundVotingPower(roundForVoting, walletAddress),
      getRoundVoteUsage({ roundId: round.id, walletAddress }),
    ]);

    return res.status(200).json({
      walletAddress,
      votingPower,
      usedVotes,
      remainingVotes: Math.max(votingPower - usedVotes, 0),
      votingSnapshotBlock: roundForVoting.votingSnapshotBlock,
      votingSnapshotAt,
      votingSnapshotStatus: "resolved",
    });
  } catch (error) {
    console.error("Round voting power failed", error);
    return res.status(500).json({ error: "Unable to load voting power." });
  }
}
