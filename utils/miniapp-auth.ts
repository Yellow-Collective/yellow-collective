import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@farcaster/quick-auth";

const client = createClient();

export const requireMiniAppFid = async (req: NextApiRequest, res: NextApiResponse) => {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  const authorization = req.headers.authorization;
  if (typeof authorization !== "string" || !authorization.startsWith("Bearer ")) {
    res.status(401).json({ error: "Mini App authentication required." });
    return undefined;
  }
  try {
    // Never use an attacker-supplied Host header as the token audience.
    const site = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "https://yellowcollective.art";
    const domain = new URL(site.includes("://") ? site : `https://${site}`).host;
    const payload = await client.verifyJwt({ token: authorization.slice(7), domain });
    const fid = Number(payload.sub);
    if (!Number.isSafeInteger(fid) || fid <= 0) throw new Error("Invalid identity");
    return fid;
  } catch {
    res.status(401).json({ error: "Mini App authentication invalid or expired." });
    return undefined;
  }
};
