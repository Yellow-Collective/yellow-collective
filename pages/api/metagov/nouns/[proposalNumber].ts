import { getMetagovProposalStatus } from "data/metagov";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const proposalNumber = Number(req.query.proposalNumber);

  if (!Number.isInteger(proposalNumber) || proposalNumber <= 0) {
    return res.status(400).json({ error: "Invalid Nouns proposal number." });
  }

  try {
    const status = await getMetagovProposalStatus(proposalNumber);
    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=300");
    return res.status(200).json(status);
  } catch (error) {
    console.error("Unable to load metagov proposal status", error);
    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Unable to load metagov proposal status.",
    });
  }
}
