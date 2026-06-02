import type { NextApiRequest, NextApiResponse } from "next";
import { listAdminNoundrySubmissions } from "data/noundry/submissions";
import { requireAdminRequest } from "@/utils/admin-api";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  if (!(await requireAdminRequest(req, res, "noundry"))) return;

  try {
    const submissions = await listAdminNoundrySubmissions();
    return res.status(200).json({ submissions });
  } catch (error) {
    console.error("Admin Noundry submissions load failed", error);
    return res.status(500).json({ error: "Unable to load submissions." });
  }
}
