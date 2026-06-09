import { requireAdminRequest } from "@/utils/admin-api";
import { hasNotificationCronAuth } from "@/utils/notifications/auth";
import {
  createNotificationUuid,
  fetchNeynarNotificationTokens,
  publishNeynarNotification,
} from "@/utils/notifications/neynar";
import {
  markNotificationEventSent,
  upsertNotificationEventAttempt,
} from "data/notifications";
import type { NextApiRequest, NextApiResponse } from "next";

const normalizeTargetFids = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => Number(item))
    .filter((fid) => Number.isInteger(fid) && fid > 0);
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  if (!hasNotificationCronAuth(req)) {
    if (!(await requireAdminRequest(req, res, "notifications"))) return;
  }

  try {
    const targetFids = normalizeTargetFids(req.body?.targetFids);
    if (targetFids.length === 0) {
      return res.status(400).json({ error: "At least one target FID is required." });
    }

    const title = String(req.body?.title || "Yellow test");
    const body = String(
      req.body?.body || "Test notification from Yellow Collective."
    );
    const targetUrl = String(req.body?.targetUrl || "/");
    const uuid = createNotificationUuid("test", targetFids.join(","), Date.now());
    const sourceId = `${targetFids.join(",")}:${Date.now()}`;
    const dryRun =
      req.body?.dryRun === true ||
      req.query.dryRun === "true" ||
      process.env.NOTIFICATIONS_DRY_RUN === "true";

    if (!dryRun) {
      const tokens = await fetchNeynarNotificationTokens({ fids: targetFids });
      const tokenFids = new Set(tokens.map((token) => token.fid));
      const missingFids = targetFids.filter((fid) => !tokenFids.has(fid));

      if (missingFids.length > 0) {
        return res.status(422).json({
          code: "NoNotificationTokens",
          missingFids,
          error: `No Neynar notification tokens found for FID(s): ${missingFids.join(
            ", "
          )}. Remove and re-add the Mini App, enable notifications, then sync the Neynar audience again.`,
        });
      }
    }

    await upsertNotificationEventAttempt({
      id: uuid,
      eventType: "admin_test",
      sourceId,
      title,
      body,
      targetUrl,
      targetFids,
      dryRun,
    });

    const response = await publishNeynarNotification({
      title,
      body,
      targetUrl,
      uuid,
      targetFids,
      dryRun,
    });

    await markNotificationEventSent({
      eventType: "admin_test",
      sourceId,
      response: response as unknown as Record<string, unknown>,
    });

    return res.status(200).json(response);
  } catch (error) {
    console.error("Notification test send failed", error);
    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Unable to send test notification.",
    });
  }
}
