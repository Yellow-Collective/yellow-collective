import type { NextApiRequest, NextApiResponse } from "next";
import {
  approveCommunityProject,
  removeCommunityProject,
  updateCommunityProject,
} from "data/community-project-submissions";
import type { CommunityProject } from "data/community";
import { requireAdminRequest } from "@/utils/admin-api";

type CommunityProjectAdminBody = {
  adminAddress?: string;
  action?: "approve" | "remove";
  project?: Partial<CommunityProject>;
};

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "8mb",
    },
  },
};

const getId = (req: NextApiRequest) => {
  const id = req.query.id;
  return typeof id === "string" ? id : id?.[0];
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (!["PATCH", "DELETE"].includes(req.method || "")) {
    res.setHeader("Allow", "PATCH, DELETE");
    return res.status(405).json({ error: "Method not allowed." });
  }

  if (!(await requireAdminRequest(req, res, "community"))) return;

  const id = getId(req);
  if (!id) return res.status(400).json({ error: "Project id is required." });

  try {
    const body = req.body as CommunityProjectAdminBody;
    let project =
      req.method === "DELETE" || body.action === "remove"
        ? await removeCommunityProject(id)
        : await updateCommunityProject(id, body.project || {});

    if (project && body.action === "approve") {
      project = await approveCommunityProject(id);
    }

    if (!project) return res.status(404).json({ error: "Project not found." });

    return res.status(200).json({ project });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to update project.";
    console.error("Admin community project update failed", error);
    return res.status(500).json({ error: message });
  }
}
