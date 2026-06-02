import { requireAdminRequest } from "@/utils/admin-api";
import {
  getNounsMetagovEnabled,
  setNounsMetagovEnabled,
} from "data/nouns-metagov";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (!["GET", "PATCH"].includes(req.method || "")) {
    res.setHeader("Allow", "GET, PATCH");
    return res.status(405).json({ error: "Method not allowed." });
  }

  if (!(await requireAdminRequest(req, res, "nouns"))) return;

  try {
    if (req.method === "PATCH") {
      const nounsMetagovEnabled = await setNounsMetagovEnabled(
        Boolean(req.body?.nounsMetagovEnabled)
      );
      return res.status(200).json({ nounsMetagovEnabled });
    }

    return res.status(200).json({
      nounsMetagovEnabled: await getNounsMetagovEnabled(),
    });
  } catch (error) {
    console.error("Admin Nouns metagov settings request failed", error);
    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Unable to update Nouns metagov settings.",
    });
  }
}
