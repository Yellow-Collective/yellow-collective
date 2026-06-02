import type { NextApiRequest, NextApiResponse } from "next";
import {
  approveRoundRequest,
  removeRoundRequest,
  setRoundRequestStatus,
} from "data/rounds";
import { requireAdminRequest } from "@/utils/admin-api";

type AdminRoundRequestBody = {
  action?: "approved" | "rejected" | "remove";
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

  if (!(await requireAdminRequest(req, res, "rounds"))) return;

  const id = getId(req);
  if (!id) return res.status(400).json({ error: "Request id is required." });

  try {
    const body = req.body as AdminRoundRequestBody;
    const action = body.action;

    if (
      action &&
      action !== "approved" &&
      action !== "rejected" &&
      action !== "remove"
    ) {
      return res.status(400).json({ error: "Invalid request action." });
    }

    const result =
      req.method === "DELETE" || action === "remove"
        ? await removeRoundRequest(id)
        : action === "approved"
          ? await approveRoundRequest(id)
        : action === "rejected"
          ? await setRoundRequestStatus({
              id,
              status: "rejected",
            })
          : null;

    if (!result) return res.status(404).json({ error: "Request not found." });

    return res.status(200).json(
      "request" in result && "round" in result
        ? result
        : { request: result }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to update request.";
    console.error("Admin round request update failed", error);
    return res.status(500).json({ error: message });
  }
}
