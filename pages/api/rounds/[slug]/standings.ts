import type { NextApiRequest, NextApiResponse } from "next";
import { getPublicRoundStandingsBySlug } from "data/rounds";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }
  const slug = typeof req.query.slug === "string" ? req.query.slug : req.query.slug?.[0];
  if (!slug) return res.status(400).json({ error: "Round slug is required." });
  try {
    const standings = await getPublicRoundStandingsBySlug(slug);
    if (!standings) return res.status(404).json({ error: "Round not found." });
    return res.status(200).json(standings);
  } catch {
    console.error("Round standings load failed");
    return res.status(500).json({ error: "Unable to refresh round standings." });
  }
}
