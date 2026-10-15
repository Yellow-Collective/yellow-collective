import type { NextApiRequest, NextApiResponse } from "next";
import { listOwnedRoundSubmissionSummaries } from "data/rounds";
import { verifyRoundWalletSignedRequest } from "@/utils/rounds/server-auth";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }
  try {
    const walletAddress = await verifyRoundWalletSignedRequest({
      req,
      res,
      action: "submission-read",
    });
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    if (!walletAddress) return;
    const slug = typeof req.query.slug === "string" ? req.query.slug : "";
    if (!slug)
      return res.status(400).json({ error: "Round slug is required." });
    const submissions = await listOwnedRoundSubmissionSummaries(
      slug,
      walletAddress
    );
    if (!submissions)
      return res.status(404).json({ error: "Round not found." });
    return res.status(200).json({ submissions });
  } catch {
    return res.status(500).json({ error: "Unable to load your submissions." });
  }
}
