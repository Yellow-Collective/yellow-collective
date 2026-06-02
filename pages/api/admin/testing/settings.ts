import type { NextApiRequest, NextApiResponse } from "next";
import {
  getDummyContentEnabled,
  setDummyContentEnabled,
} from "data/dummy-content";
import { requireAdminRequest } from "@/utils/admin-api";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (!["GET", "PATCH"].includes(req.method || "")) {
    res.setHeader("Allow", "GET, PATCH");
    return res.status(405).json({ error: "Method not allowed." });
  }

  if (!(await requireAdminRequest(req, res, "testing"))) return;

  try {
    if (req.method === "PATCH") {
      const dummyContentEnabled = await setDummyContentEnabled(
        Boolean(req.body?.dummyContentEnabled)
      );
      return res.status(200).json({ dummyContentEnabled });
    }

    return res.status(200).json({
      dummyContentEnabled: await getDummyContentEnabled(),
    });
  } catch (error) {
    console.error("Admin testing settings request failed", error);
    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Unable to update testing settings.",
    });
  }
}
