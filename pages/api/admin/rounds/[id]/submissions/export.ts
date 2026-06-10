import type { NextApiRequest, NextApiResponse } from "next";
import { listProfileMetadata } from "data/profile";
import { getRoundById, listRoundSubmissions } from "data/rounds";
import { requireAdminRequest } from "@/utils/admin-api";
import {
  createRoundSubmissionsCsv,
  getRoundSubmissionsCsvFilename,
} from "@/utils/rounds/admin-submissions-export";

const getId = (req: NextApiRequest) => {
  const id = req.query.id;
  return typeof id === "string" ? id : id?.[0];
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  if (!(await requireAdminRequest(req, res, "rounds"))) return;

  const id = getId(req);
  if (!id) return res.status(400).json({ error: "Round id is required." });

  try {
    const round = await getRoundById(id);
    if (!round) return res.status(404).json({ error: "Round not found." });

    const submissions = await listRoundSubmissions(id);
    const profiles = await listProfileMetadata(
      submissions.map((submission) => submission.walletAddress)
    );
    const csv = createRoundSubmissionsCsv({
      round,
      submissions,
      profiles,
    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${getRoundSubmissionsCsvFilename(round)}"`
    );
    return res.status(200).send(csv);
  } catch (error) {
    console.error("Admin round submissions export failed", error);
    return res.status(500).json({ error: "Unable to export submissions." });
  }
}
