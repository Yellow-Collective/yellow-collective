import { upsertMiniAppUser } from "data/notifications";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    const fid = Number(req.body?.fid);
    if (!Number.isInteger(fid) || fid <= 0) {
      return res.status(400).json({ error: "A valid Farcaster FID is required." });
    }

    const notificationsEnabled =
      typeof req.body?.notificationsEnabled === "boolean"
        ? req.body.notificationsEnabled
        : undefined;

    const result = await upsertMiniAppUser({
      fid,
      username: req.body?.username,
      displayName: req.body?.displayName,
      pfpUrl: req.body?.pfpUrl,
      walletAddress: req.body?.walletAddress,
      notificationsEnabled,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("Mini App user upsert failed", error);
    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Unable to update Mini App user.",
    });
  }
}
