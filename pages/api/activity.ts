import { getActivityFeed } from "data/activity";
import { parseActivityQuery } from "@/utils/activity";
import type { NextApiRequest, NextApiResponse } from "next";

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const parsed = parseActivityQuery(req.query);
  if (!parsed.value) {
    return res.status(400).json({ error: parsed.error || "Invalid activity query." });
  }

  try {
    const payload = await getActivityFeed(parsed.value);
    res.setHeader("Cache-Control", "s-maxage=15, stale-while-revalidate=60");
    return res.status(200).json(payload);
  } catch (error) {
    console.error("Unable to build activity feed", error);
    return res.status(500).json({ error: "Activity is unavailable." });
  }
};

export default handler;
