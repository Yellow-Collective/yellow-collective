import type { NextApiRequest, NextApiResponse } from "next";
import {
  castRoundVotes,
  getOrCreateRoundVotingSnapshotBlock,
  getRoundBySlug,
} from "data/rounds";
import { verifyRoundWalletSignedRequest } from "@/utils/rounds/server-auth";
import { getRoundVotingPower } from "@/utils/rounds/getRoundVotingPower";
import type { RoundVoteAllocationInput } from "@/utils/rounds/validateRoundVote";

type VoteRoundBody = {
  votes?: RoundVoteAllocationInput[];
};

const getSlug = (req: NextApiRequest) => {
  const slug = req.query.slug;
  return typeof slug === "string" ? slug : slug?.[0];
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const slug = getSlug(req);
  if (!slug) return res.status(400).json({ error: "Round slug is required." });

  try {
    const body = req.body as VoteRoundBody;
    const walletAddress = await verifyRoundWalletSignedRequest({
      req,
      res,
      action: "vote",
    });
    if (!walletAddress) return;
    const round = await getRoundBySlug(slug);

    if (!round || round.status !== "published" || !round.active) {
      return res.status(404).json({ error: "Round not found." });
    }

    const votingSnapshotBlock =
      await getOrCreateRoundVotingSnapshotBlock(round);
    if (votingSnapshotBlock === null) {
      return res.status(409).json({
        error:
          "Voting power is not available yet because the configured Base snapshot block has not been indexed. Please try again shortly.",
      });
    }
    const roundForVoting = {
      ...round,
      votingSnapshotBlock: votingSnapshotBlock ?? round.votingSnapshotBlock,
    };
    const votingPower = await getRoundVotingPower(
      roundForVoting,
      walletAddress
    );
    const submissions = await castRoundVotes({
      round: roundForVoting,
      walletAddress,
      votingPower,
      votes: body.votes || [],
    });

    return res.status(200).json({
      submissions,
      votingPower,
      votingSnapshotBlock: roundForVoting.votingSnapshotBlock,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to cast votes.";
    console.error("Round vote failed", error);
    return res.status(400).json({ error: message });
  }
}
