import type { NextApiRequest, NextApiResponse } from "next";
import { listEligibleTraitRounds } from "data/rounds";
import { serializePublicRound } from "@/utils/rounds/roundMediaPayload";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const wallet = typeof req.query.wallet === "string" ? req.query.wallet : "";
  const traitId = typeof req.query.traitId === "string" ? req.query.traitId : "";

  if (!wallet || !traitId) {
    return res
      .status(400)
      .json({ error: "Wallet and trait ID are required." });
  }

  try {
    const rounds = await listEligibleTraitRounds({
      walletAddress: wallet,
      traitId,
    });

    return res.status(200).json({ rounds: rounds.map(serializePublicRound) });
  } catch (error) {
    const message =
      "Unable to load eligible trait rounds.";
    console.error("Eligible trait rounds failed", error);
    return res.status(400).json({ error: message });
  }
}
