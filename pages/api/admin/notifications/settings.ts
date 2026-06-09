import { requireAdminRequest } from "@/utils/admin-api";
import {
  getNotificationSettings,
  setNotificationSettings,
} from "data/notifications";
import {
  normalizeNotificationSettings,
  validateNotificationSettings,
} from "@/utils/notifications/settings";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (!["GET", "PATCH"].includes(req.method || "")) {
    res.setHeader("Allow", "GET, PATCH");
    return res.status(405).json({ error: "Method not allowed." });
  }

  if (!(await requireAdminRequest(req, res, "notifications"))) return;

  try {
    if (req.method === "PATCH") {
      const nextSettings = normalizeNotificationSettings(req.body?.settings);
      const errors = validateNotificationSettings(nextSettings);
      if (errors.length) {
        return res.status(400).json({ error: errors.join(" ") });
      }

      const settings = await setNotificationSettings(nextSettings);
      return res.status(200).json({ settings });
    }

    return res.status(200).json({
      settings: await getNotificationSettings(),
    });
  } catch (error) {
    console.error("Admin notifications settings request failed", error);
    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Unable to update notification settings.",
    });
  }
}
