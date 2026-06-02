import type { NextApiRequest, NextApiResponse } from "next";
import { listAdminRoundRequests } from "data/rounds";
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
    const requests = await listAdminRoundRequests();
    return res.status(200).json({ requests });
  } catch (error) {
    console.error("Admin round requests load failed", error);
    return res.status(500).json({ error: "Unable to load round requests." });
  }
}
