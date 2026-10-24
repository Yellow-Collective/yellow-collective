import type { NextApiRequest, NextApiResponse } from "next";
import { createRoundTraitSubmission, getRoundBySlug } from "data/rounds";
import { verifyRoundWalletSignedRequest } from "@/utils/rounds/server-auth";

type SubmitTraitBody = {
  traitId?: string;
  description?: string;
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
    const body = req.body as SubmitTraitBody;
    const walletAddress = await verifyRoundWalletSignedRequest({
      req,
      res,
      action: "submit-trait",
    });
    if (!walletAddress) return;
    const round = await getRoundBySlug(slug);

    if (!round) return res.status(404).json({ error: "Round not found." });
    if (!body.traitId || typeof body.traitId !== "string") {
      return res.status(400).json({ error: "Trait ID is required." });
    }

    const submission = await createRoundTraitSubmission({
      round,
      traitId: body.traitId,
      walletAddress,
      description: body.description,
    });

    return res.status(201).json({ submission });
  } catch (error) {
    const message =
      "Unable to submit trait to round.";
    console.error("Round trait submission failed", error);
    return res.status(400).json({ error: message });
  }
}
