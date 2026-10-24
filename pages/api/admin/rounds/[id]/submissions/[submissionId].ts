import type { NextApiRequest, NextApiResponse } from "next";
import {
  removeRoundSubmission,
  RoundSubmissionValidationError,
  setRoundSubmissionStatus,
  updateRoundSubmission,
  type RoundSubmissionInput,
  type RoundSubmissionStatus,
} from "data/rounds";
import { requireAdminRequest } from "@/utils/admin-api";

export const config = { api: { bodyParser: { sizeLimit: "4mb" } } };

type AdminSubmissionBody = {
  action?: "approve" | "reject" | "hide" | "remove";
  submission?: RoundSubmissionInput;
};

const getQueryValue = (value: string | string[] | undefined) =>
  typeof value === "string" ? value : value?.[0];

const actionToStatus: Record<
  Exclude<AdminSubmissionBody["action"], undefined | "remove">,
  RoundSubmissionStatus
> = {
  approve: "approved",
  reject: "rejected",
  hide: "hidden",
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (!["PATCH", "DELETE", "POST"].includes(req.method || "")) {
    res.setHeader("Allow", "PATCH, POST, DELETE");
    return res.status(405).json({ error: "Method not allowed." });
  }

  if (!(await requireAdminRequest(req, res, "rounds"))) return;

  const id = getQueryValue(req.query.id);
  const submissionId = getQueryValue(req.query.submissionId);
  if (!id || !submissionId) {
    return res.status(400).json({ error: "Submission id is required." });
  }

  try {
    const body = req.body as AdminSubmissionBody;
    const action = body.action;

    if (
      action &&
      action !== "approve" &&
      action !== "reject" &&
      action !== "hide" &&
      action !== "remove"
    ) {
      return res.status(400).json({ error: "Invalid submission action." });
    }

    if (body.submission && action && req.method !== "DELETE" && action !== "remove") {
      await updateRoundSubmission(id, submissionId, body.submission);
    }

    const submission =
      req.method === "DELETE" || action === "remove"
        ? await removeRoundSubmission(id, submissionId)
        : action
          ? await setRoundSubmissionStatus({
              roundId: id,
              submissionId,
              status: actionToStatus[action],
            })
          : await updateRoundSubmission(id, submissionId, body.submission || {});

    if (!submission) {
      return res.status(404).json({ error: "Submission not found." });
    }

    return res.status(200).json({ submission });
  } catch (error) {
    const message =
      "Unable to update submission.";
    if (error instanceof RoundSubmissionValidationError) {
      return res.status(400).json({ error: message });
    }
    console.error("Admin round submission update failed", error);
    return res.status(500).json({ error: "Unable to update submission." });
  }
}
