import { requireAdminRequest } from "@/utils/admin-api";
import { listNotificationEvents } from "data/notifications";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  if (!(await requireAdminRequest(req, res, "notifications"))) return;

  try {
    return res.status(200).json({
      events: await listNotificationEvents(Number(req.query.limit || 50)),
    });
  } catch (error) {
    console.error("Admin notification events request failed", error);
    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Unable to load notification events.",
    });
  }
}
