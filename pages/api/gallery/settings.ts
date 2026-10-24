import type { NextApiRequest, NextApiResponse } from "next";
import { getGalleryPublicEnabled } from "data/coins";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    return res.status(200).json({
      galleryPublicEnabled: await getGalleryPublicEnabled(),
    });
  } catch (error) {
    console.error("Gallery settings request failed", error);
    return res.status(500).json({
      error:
        "Unable to load gallery settings.",
    });
  }
}
