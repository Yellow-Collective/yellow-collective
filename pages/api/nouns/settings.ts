import { getNounsMetagovEnabled } from "data/nouns-metagov";
import type { NextApiRequest, NextApiResponse } from "next";

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
      nounsMetagovEnabled: await getNounsMetagovEnabled(),
    });
  } catch (error) {
    console.error("Nouns metagov settings request failed", error);
    return res.status(500).json({
      error:
        "Unable to load Nouns metagov settings.",
    });
  }
}
