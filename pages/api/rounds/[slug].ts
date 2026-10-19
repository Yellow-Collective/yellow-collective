import type { NextApiRequest, NextApiResponse } from "next";
import { getPublicRoundBySlug } from "data/rounds";
import { stripRoundInlineMediaForSsr } from "@/utils/rounds/roundMediaPayload";

const getSlug = (req: NextApiRequest) => {
  const slug = req.query.slug;
  return typeof slug === "string" ? slug : slug?.[0];
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const slug = getSlug(req);
  if (!slug) return res.status(400).json({ error: "Round slug is required." });

  try {
    const round = await getPublicRoundBySlug(slug, { includeInlineMedia: false });
    if (!round) return res.status(404).json({ error: "Round not found." });

    return res.status(200).json({ round: stripRoundInlineMediaForSsr(round) });
  } catch (error) {
    console.error("Round load failed", error);
    return res.status(500).json({ error: "Unable to load round." });
  }
}
