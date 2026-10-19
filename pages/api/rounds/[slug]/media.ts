import type { NextApiRequest, NextApiResponse } from "next";
import { getPublicRoundMediaBySlug } from "data/rounds";
import { createRoundMediaPayload } from "@/utils/rounds/roundMediaPayload";

export const config = {
  api: {
    responseLimit: false,
  },
};

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
    const round = await getPublicRoundMediaBySlug(slug);
    if (!round) return res.status(404).json({ error: "Round not found." });

    // Only an anonymous, fully public body is cached. This handler never reads
    // cookies, wallet identity or administrator state.
    res.setHeader("Cache-Control", "public, max-age=15, s-maxage=15, must-revalidate");
    return res.status(200).json(createRoundMediaPayload(round, req.query.v === "2" ? 2 : 1));
  } catch (error) {
    console.error("Round media load failed");
    return res.status(500).json({ error: "Unable to load round media." });
  }
}
