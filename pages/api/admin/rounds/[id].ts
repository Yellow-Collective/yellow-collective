import type { NextApiRequest, NextApiResponse } from "next";
import { removeRound, updateRound, type RoundInput } from "data/rounds";
import { requireAdminRequest } from "@/utils/admin-api";

type AdminRoundBody = {
  action?: "publish" | "archive" | "remove";
  round?: RoundInput;
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
  if (!id) return res.status(400).json({ error: "Round id is required." });

  try {
    const body = req.body as AdminRoundBody;
    const round =
      req.method === "DELETE" || body.action === "remove"
        ? await removeRound(id)
        : await updateRound(id, {
            ...(body.round || {}),
            ...(body.action === "publish" ? { status: "published", active: true } : {}),
            ...(body.action === "archive" ? { status: "archived", active: false } : {}),
          });

    if (!round) return res.status(404).json({ error: "Round not found." });

    return res.status(200).json({ round });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to update round.";
    console.error("Admin round update failed", error);
    return res.status(500).json({ error: message });
  }
}
