import { hasNotificationCronAuth } from "@/utils/notifications/auth";
import { pollWebNotifications } from "@/utils/notifications/poll";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed." });
  }
  if (!hasNotificationCronAuth(req)) {
    return res.status(401).json({ error: "Notification cron secret required." });
  }

  try {
    const result = await pollWebNotifications({
      dryRun: req.query.dryRun === "true",
      force: req.query.force === "true",
    });
    return res.status(200).json(result);
  } catch (error) {
    console.error("Notification poll failed", error);
    return res.status(500).json({
      error:
        error instanceof Error ? error.message : "Unable to poll notifications.",
    });
  }
}
