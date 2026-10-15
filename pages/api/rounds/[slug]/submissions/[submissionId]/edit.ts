import type { NextApiRequest, NextApiResponse } from "next";
import { editOwnedRoundSubmission, getOwnedRoundSubmission } from "data/rounds";
import { RoundSubmissionEditError } from "@/utils/rounds/submission-edit";
import { verifyRoundWalletSignedRequest } from "@/utils/rounds/server-auth";

export const config = { api: { bodyParser: { sizeLimit: "4mb" } } };
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  if (req.method !== "GET" && req.method !== "PATCH") {
    res.setHeader("Allow", "GET, PATCH");
    return res.status(405).json({ error: "Method not allowed." });
  }
  try {
    const walletAddress = await verifyRoundWalletSignedRequest({
      req,
      res,
      action: req.method === "GET" ? "submission-read" : "edit",
    });
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    if (!walletAddress) return;
    const slug = typeof req.query.slug === "string" ? req.query.slug : "";
    const id =
      typeof req.query.submissionId === "string" ? req.query.submissionId : "";
    if (!slug || !id)
      return res
        .status(400)
        .json({ error: "Round and submission are required." });
    if (
      req.method === "PATCH" &&
      (!req.body ||
        typeof req.body !== "object" ||
        Array.isArray(req.body) ||
        Object.keys(req.body).some((field) => field !== "submission"))
    ) {
      return res.status(400).json({ error: "Provide only submission edits." });
    }
    const submission =
      req.method === "GET"
        ? await getOwnedRoundSubmission(slug, id, walletAddress)
        : await editOwnedRoundSubmission(
            slug,
            id,
            walletAddress,
            req.body.submission
          );
    if (!submission)
      return res.status(404).json({ error: "Submission not found." });
    return res
      .status(200)
      .json({ submission: { ...submission, sourcePayload: null } });
  } catch (error) {
    if (error instanceof RoundSubmissionEditError)
      return res.status(error.status).json({ error: error.message });
    return res.status(500).json({
      error:
        "Unable to save or load this submission. Reload it to check whether your edit was saved.",
    });
  }
}
