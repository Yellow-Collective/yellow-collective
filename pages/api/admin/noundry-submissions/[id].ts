import type { NextApiRequest, NextApiResponse } from "next";
import {
  approveNoundrySubmission,
  removeNoundrySubmission,
  updateNoundrySubmission,
  type UpdateNoundrySubmissionInput,
} from "data/noundry/submissions";
import { requireAdminRequest } from "@/utils/admin-api";

type NoundrySubmissionAdminBody = {
  adminAddress?: string;
  action?: "approve" | "remove";
  submission?: UpdateNoundrySubmissionInput;
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

  if (!(await requireAdminRequest(req, res, "noundry"))) return;

  const id = getId(req);
  if (!id) {
    return res.status(400).json({ error: "Submission id is required." });
  }

  try {
    const body = req.body as NoundrySubmissionAdminBody;
    const submission =
      req.method === "DELETE" || body.action === "remove"
        ? await removeNoundrySubmission(id)
        : body.action === "approve"
          ? await approveNoundrySubmission(id)
          : await updateNoundrySubmission(id, body.submission || {});

    if (!submission) {
      return res.status(404).json({ error: "Submission not found." });
    }

    return res.status(200).json({ submission });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to update submission.";
    console.error("Admin Noundry submission update failed", error);
    return res.status(500).json({ error: message });
  }
}
