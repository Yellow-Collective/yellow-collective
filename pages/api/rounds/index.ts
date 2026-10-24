import type { NextApiRequest, NextApiResponse } from "next";
import { listPublicRounds } from "data/rounds";
import { serializePublicRound } from "@/utils/rounds/roundMediaPayload";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    const rounds = await listPublicRounds();
    return res.status(200).json({ rounds: rounds.map(serializePublicRound) });
  } catch (error) {
    console.error("Rounds load failed", error);
    return res.status(500).json({ error: "Unable to load rounds." });
  }
}
