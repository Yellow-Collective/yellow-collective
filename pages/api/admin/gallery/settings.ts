import type { NextApiRequest, NextApiResponse } from "next";
import {
  getGalleryPublicEnabled,
  setGalleryPublicEnabled,
} from "data/coins";
import { requireAdminRequest } from "@/utils/admin-api";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (!["GET", "PATCH"].includes(req.method || "")) {
    res.setHeader("Allow", "GET, PATCH");
    return res.status(405).json({ error: "Method not allowed." });
  }

  if (!(await requireAdminRequest(req, res, "gallery"))) return;

  try {
    if (req.method === "PATCH") {
      const galleryPublicEnabled = await setGalleryPublicEnabled(
        Boolean(req.body?.galleryPublicEnabled)
      );
      return res.status(200).json({ galleryPublicEnabled });
    }

    return res.status(200).json({
      galleryPublicEnabled: await getGalleryPublicEnabled(),
    });
  } catch (error) {
    console.error("Admin gallery settings request failed", error);
    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Unable to update gallery settings.",
    });
  }
}
