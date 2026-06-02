import type { NextApiRequest, NextApiResponse } from "next";
import { listAdminCommunityProjects } from "data/community-project-submissions";
import { requireAdminRequest } from "@/utils/admin-api";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  if (!(await requireAdminRequest(req, res, "community"))) return;

  try {
    const projects = await listAdminCommunityProjects();
    return res.status(200).json({ projects });
  } catch (error) {
    console.error("Admin community projects load failed", error);
    return res.status(500).json({ error: "Unable to load projects." });
  }
}
