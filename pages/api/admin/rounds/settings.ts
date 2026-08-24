import type { NextApiRequest, NextApiResponse } from "next";
import { getRoundsPublicEnabled } from "data/rounds";
import { requireAdminRequest } from "@/utils/admin-api";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  if (!(await requireAdminRequest(req, res, "rounds"))) return;

  try {
    return res.status(200).json({
      roundsPublicEnabled: await getRoundsPublicEnabled(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to update settings.";
    console.error("Admin rounds settings request failed", error);
    return res.status(500).json({ error: message });
  }
}
