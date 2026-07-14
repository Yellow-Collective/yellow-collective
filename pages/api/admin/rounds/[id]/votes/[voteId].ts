import type { NextApiRequest, NextApiResponse } from "next";
import {
  removeAdminRoundVote,
  updateAdminRoundVote,
} from "data/rounds";
import { requireAdminRequest } from "@/utils/admin-api";
import { validateAdminRoundVoteCount } from "@/utils/rounds/admin-votes";

type AdminRoundVoteBody = {
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
      const validationError = validateAdminRoundVoteCount(body.voteCount);
      if (validationError) {
        return res.status(400).json({ error: validationError });
      }

      const vote = await updateAdminRoundVote({
        roundId,
        voteId,
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
    const isValidationError =
      message.includes("must be") || message.includes("positive integer");
    console.error("Admin round vote mutation failed", error);
    return res.status(isValidationError ? 400 : 500).json({ error: message });
  }
}
