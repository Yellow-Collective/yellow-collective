import { hasNotificationCronAuth } from "@/utils/notifications/auth";
import { getNotificationSettings } from "data/notifications";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }
  if (!hasNotificationCronAuth(req)) {
    return res.status(401).json({ error: "Notification cron secret required." });
  }

  try {
    return res.status(200).json({ settings: await getNotificationSettings() });
  } catch (error) {
    console.error("Notification settings load failed", error);
    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Unable to load notification settings.",
    });
  }
}
