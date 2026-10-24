import { upsertMiniAppUser } from "data/notifications";
import type { NextApiRequest, NextApiResponse } from "next";
import { requireMiniAppFid } from "@/utils/miniapp-auth";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    const fid = await requireMiniAppFid(req, res);
    if (!fid) return;
    if (req.body?.fid !== fid) {
      return res.status(403).json({ error: "Mini App identity mismatch." });
    }
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
      notificationUrl: req.body?.notificationUrl,
      notificationTokenCreatedAt: req.body?.notificationTokenCreatedAt,
      notificationTokenUpdatedAt: req.body?.notificationTokenUpdatedAt,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("Mini App user upsert failed", error);
    return res.status(500).json({
      error:
        "Unable to update Mini App user.",
    });
  }
}
