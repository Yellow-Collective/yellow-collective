import type { NextApiRequest, NextApiResponse } from "next";
import { createRound, listAdminRounds } from "data/rounds";
import { requireAdminRequest } from "@/utils/admin-api";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (!["GET", "POST"].includes(req.method || "")) {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  if (!(await requireAdminRequest(req, res, "rounds"))) return;

  try {
    if (req.method === "POST") {
      const round = await createRound(req.body?.round || {});
      return res.status(201).json({ round });
    }

    const rounds = await listAdminRounds();
    return res.status(200).json({ rounds });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load rounds.";
    console.error("Admin rounds request failed", error);
    return res.status(500).json({ error: message });
  }
}
