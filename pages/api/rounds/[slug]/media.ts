import type { NextApiRequest, NextApiResponse } from "next";
import { getPublicRoundBySlug } from "data/rounds";
import { createRoundMediaPayload } from "@/utils/rounds/roundMediaPayload";

const getSlug = (req: NextApiRequest) => {
  const slug = req.query.slug;
  return typeof slug === "string" ? slug : slug?.[0];
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const slug = getSlug(req);
  if (!slug) return res.status(400).json({ error: "Round slug is required." });

  try {
    const round = await getPublicRoundBySlug(slug);
    if (!round) return res.status(404).json({ error: "Round not found." });

    return res.status(200).json(createRoundMediaPayload(round));
  } catch (error) {
    console.error("Round media load failed", error);
    return res.status(500).json({ error: "Unable to load round media." });
  }
}
