import type { NextApiRequest, NextApiResponse } from "next";
import { getGalleryPublicEnabled, listGalleryCoins } from "data/coins";
import { requireAdminRequest } from "@/utils/admin-api";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  if (!(await requireAdminRequest(req, res, "gallery"))) return;

  try {
    return res.status(200).json({
      coins: await listGalleryCoins(),
      galleryPublicEnabled: await getGalleryPublicEnabled(),
    });
  } catch (error) {
    console.error("Admin gallery request failed", error);
    return res.status(500).json({
      error:
        error instanceof Error ? error.message : "Unable to load gallery.",
    });
  }
}
