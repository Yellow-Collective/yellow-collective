import { requireAdminRequest } from "@/utils/admin-api";
import { fetchNeynarNotificationTokens } from "@/utils/notifications/neynar";
import {
  listMiniAppNotificationAudience,
  syncMiniAppNotificationAudience,
} from "data/notifications";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  if (!(await requireAdminRequest(req, res, "notifications"))) return;

  try {
    if (req.method === "POST") {
      const tokens = await fetchNeynarNotificationTokens();
      const audience = await syncMiniAppNotificationAudience(tokens);
      return res.status(200).json({
        audience,
        syncedCount: tokens.length,
      });
    }

    return res.status(200).json({
      audience: await listMiniAppNotificationAudience(
        Number(req.query.limit || 100)
      ),
    });
  } catch (error) {
    console.error("Admin notification audience request failed", error);
    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Unable to load notification audience.",
    });
  }
}
