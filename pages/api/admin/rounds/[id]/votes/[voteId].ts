import type { NextApiRequest, NextApiResponse } from "next";
import {
  AdminRoundVoteConflictError,
  removeAdminRoundVote,
  updateAdminRoundVote,
} from "data/rounds";
import { requireAdminRequest } from "@/utils/admin-api";
import { validateAdminRoundVoteCount } from "@/utils/rounds/admin-votes";

type AdminRoundVoteBody = {
  submissionId?: unknown;
  voteCount?: unknown;
  reason?: unknown;
};

const getQueryValue = (value: string | string[] | undefined) =>
  typeof value === "string" ? value : value?.[0];

const getReason = (value: unknown) => {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") {
    throw new Error("Correction reason must be text.");
  }

  const reason = value.trim();
  if (reason.length > 1000) {
    throw new Error("Correction reason must be 1000 characters or fewer.");
  }
  return reason;
};

const getSubmissionId = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Selected submission is required.");
  }

  return value.trim().slice(0, 200);
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "PATCH" && req.method !== "DELETE") {
    res.setHeader("Allow", "PATCH, DELETE");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const adminAddress = await requireAdminRequest(req, res, "rounds");
  if (!adminAddress) return;

  const roundId = getQueryValue(req.query.id);
  const voteId = getQueryValue(req.query.voteId);
  if (!roundId || !voteId) {
    return res.status(400).json({ error: "Round id and vote id are required." });
  }

  try {
    const body = (req.body || {}) as AdminRoundVoteBody;
    const reason = getReason(body.reason);

    if (req.method === "PATCH") {
      const submissionId = getSubmissionId(body.submissionId);
      const validationError = validateAdminRoundVoteCount(body.voteCount);
      if (validationError) {
        return res.status(400).json({ error: validationError });
      }

      const vote = await updateAdminRoundVote({
        roundId,
        voteId,
        submissionId,
        voteCount: body.voteCount as number,
        adminWalletAddress: adminAddress,
        reason,
      });
      if (!vote) return res.status(404).json({ error: "Vote not found." });
      return res.status(200).json({ vote });
    }

    const vote = await removeAdminRoundVote({
      roundId,
      voteId,
      adminWalletAddress: adminAddress,
      reason,
    });
    if (!vote) return res.status(404).json({ error: "Vote not found." });
    return res.status(200).json({ vote });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to update round vote.";
    const isConflict = error instanceof AdminRoundVoteConflictError;
    const isValidationError =
      message.includes("must be") ||
      message.includes("positive integer") ||
      message.startsWith("Selected submission");
    console.error("Admin round vote mutation failed", error);
    return res
      .status(isConflict ? 409 : isValidationError ? 400 : 500)
      .json({ error: message });
  }
}
