import { getDaoMembers } from "data/members";
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
    const members = await getDaoMembers();
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ members, updatedAt: new Date().toISOString() });
  } catch (error) {
    console.error("Members API load failed", error);
    return res.status(500).json({ error: "Unable to load members." });
  }
}
