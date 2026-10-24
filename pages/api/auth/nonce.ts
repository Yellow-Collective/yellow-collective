import type { NextApiRequest, NextApiResponse } from "next";
import { isAddress } from "viem";
import { applyRateLimit } from "@/utils/rate-limit";
import {
  buildSignedRequestMessage,
  normalizeSignedRequestMethod,
  normalizeSignedRequestPath,
} from "@/utils/signature-auth";
import {
  issueSignedRequestChallenge,
  setNoStoreHeaders,
} from "@/utils/signature-auth-server";

type NonceRequestBody = {
  walletAddress?: string;
  chainId?: number;
  action?: string;
  method?: string;
  path?: string;
  payloadHash?: `0x${string}`;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  setNoStoreHeaders(res);

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    if (!applyRateLimit(req, res, { keyPrefix: "auth-nonce", limit: 30, windowMs: 60_000 })) return;
    const body = req.body as NonceRequestBody;
    const method = normalizeSignedRequestMethod(body.method);

    if (
      typeof body.walletAddress !== "string" ||
      !isAddress(body.walletAddress) ||
      typeof body.chainId !== "number" ||
      !Number.isInteger(body.chainId) ||
      typeof body.action !== "string" ||
      !body.action.trim() || body.action.length > 160 ||
      !method ||
      typeof body.path !== "string" || body.path.length > 1024 || !body.path.startsWith("/api/") ||
      typeof body.payloadHash !== "string" ||
      !/^0x[0-9a-fA-F]{64}$/.test(body.payloadHash)
    ) {
      return res.status(400).json({ error: "Invalid signing challenge request." });
    }

    const challenge = await issueSignedRequestChallenge(req, {
      walletAddress: body.walletAddress,
      chainId: body.chainId,
      action: body.action.trim(),
      method,
      path: normalizeSignedRequestPath(body.path),
      payloadHash: body.payloadHash,
    });

    return res.status(201).json({
      challenge,
      message: buildSignedRequestMessage(challenge),
    });
  } catch (error) {
    console.error("Signing challenge creation failed", error);
    return res.status(500).json({ error: "Unable to create signing challenge." });
  }
}
