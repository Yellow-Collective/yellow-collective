import type { NextApiRequest, NextApiResponse } from "next";
import { createRoundRequest, type RoundRequestInput } from "data/rounds";
import { applyRateLimit } from "@/utils/rate-limit";
import { verifyRoundWalletSignedRequest } from "@/utils/rounds/server-auth";

type RequestRoundBody = {
  request?: RoundRequestInput;
};

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "2mb",
    },
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  if (
    !applyRateLimit(req, res, {
      keyPrefix: "round-request",
      limit: 6,
      windowMs: 10 * 60 * 1000,
    })
  ) {
    return;
  }

  try {
    const body = req.body as RequestRoundBody;
    const walletAddress = await verifyRoundWalletSignedRequest({
      req,
      res,
      action: "request",
    });
    if (!walletAddress) return;

    const request = await createRoundRequest({
      ...(body.request || {}),
      walletAddress,
    });

    return res.status(201).json({ request });
  } catch (error) {
    const message =
      "Unable to request round.";
    console.error("Round request failed", error);
    return res.status(400).json({ error: message });
  }
}
