import { TOKEN_NETWORK } from "constants/addresses";
import {
  getNoundrySubmissionById,
  removeNoundrySubmissionByAuthor,
  updateNoundrySubmissionMetadata,
  validateNoundryAuthorMetadata,
} from "data/noundry/submissions";
import type { NextApiRequest, NextApiResponse } from "next";
import { getNoundryAuthorSignedRequestAction } from "@/utils/noundry/auth";
import { verifySignedRequest } from "@/utils/signature-auth-server";

type AuthorSubmissionBody = {
  submission?: {
    title?: string;
    traitType?: string;
  };
};

const getId = (req: NextApiRequest) => {
  const id = req.query.id;
  return typeof id === "string" ? id : id?.[0];
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (
    !(["PATCH", "DELETE"] as const).includes(req.method as "PATCH" | "DELETE")
  ) {
    res.setHeader("Allow", "PATCH, DELETE");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const id = getId(req);
  if (!id) {
    return res.status(400).json({ error: "Submission id is required." });
  }

  try {
    const submission = await getNoundrySubmissionById(id, {
      approvedOnly: true,
    });
    if (!submission) {
      return res.status(404).json({ error: "Submission not found." });
    }

    const method = req.method as "PATCH" | "DELETE";
    const body = (req.body || {}) as AuthorSubmissionBody;
    const metadata = {
      title: body.submission?.title,
      traitType: body.submission?.traitType,
    };

    if (method === "PATCH") {
      const validationError = validateNoundryAuthorMetadata(metadata);
      if (validationError) {
        return res.status(400).json({ error: validationError });
      }
    }

    const walletAddress = await verifySignedRequest(req, res, {
      action: getNoundryAuthorSignedRequestAction(
        method === "DELETE" ? "delete" : "update"
      ),
      expectedChainId: Number(TOKEN_NETWORK),
      expectedWalletAddress: submission.artist,
      payload: body,
    });
    if (!walletAddress) return;

    const updatedSubmission =
      method === "DELETE"
        ? await removeNoundrySubmissionByAuthor(id, walletAddress)
        : await updateNoundrySubmissionMetadata(
            id,
            {
              title: metadata.title as string,
              traitType: metadata.traitType as string,
            },
            walletAddress
          );

    if (!updatedSubmission) {
      return res.status(404).json({ error: "Submission not found." });
    }

    return res.status(200).json({ submission: updatedSubmission });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to update submission.";
    console.error("Noundry author submission update failed", error);
    return res.status(400).json({ error: message });
  }
}
