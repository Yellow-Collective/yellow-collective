import type { NextApiRequest, NextApiResponse } from "next";
import {
  getAdminAccessResponse,
  isGlobalAdminWalletAddress,
  setAdminAccessState,
} from "data/admin-access";
import { requireAdminRequest } from "@/utils/admin-api";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (!["GET", "PATCH"].includes(req.method || "")) {
    res.setHeader("Allow", "GET, PATCH");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const adminAddress = await requireAdminRequest(req, res);
  if (!adminAddress) return;

  if (!isGlobalAdminWalletAddress(adminAddress)) {
    return res.status(403).json({ error: "Global admin wallet required." });
  }

  try {
    if (req.method === "PATCH") {
      await setAdminAccessState(req.body?.admins || []);
    }

    return res.status(200).json(await getAdminAccessResponse());
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to update admin access.";
    console.error("Admin access update failed", error);
    return res.status(500).json({ error: message });
  }
}
