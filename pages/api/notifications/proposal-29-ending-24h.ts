import { hasNotificationCronAuth } from "@/utils/notifications/auth";
import { getScheduledNotificationDelay } from "@/utils/notifications/schedule";
import { sendConfiguredNotification } from "@/utils/notifications/service";
import { getNotificationSettings } from "data/notifications";
import type { NextApiRequest, NextApiResponse } from "next";

const PROPOSAL_ID =
  "0x8bda646580590e0fda776723e6002e5ca962dda73c8d4cf96ee5cf26c8f1b1f3";
const SCHEDULED_AT = new Date("2026-07-21T14:09:15.000Z");

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

  const delayMs = getScheduledNotificationDelay(SCHEDULED_AT);
  if (delayMs === null) {
    return res.status(200).json({ status: "skipped" });
  }

  try {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    const result = await sendConfiguredNotification({
      eventType: "yellow_proposal_ending_24h",
      sourceId: `${PROPOSAL_ID}:ending-24h`,
      targetPath: "/proposals/29",
      variables: {
        proposalTitle: "A Yellow Summer",
        proposalId: PROPOSAL_ID,
      },
      settings: await getNotificationSettings(),
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("Proposal 29 ending reminder failed", error);
    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Unable to send proposal 29 ending reminder.",
    });
  }
}
