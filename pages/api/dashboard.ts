import { getDashboardPayload } from "data/dashboard";
import type { NextApiRequest, NextApiResponse } from "next";

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    const payload = await getDashboardPayload();
    res.setHeader(
      "Cache-Control",
      "s-maxage=30, stale-while-revalidate=120"
    );
    return res.status(200).json(payload);
  } catch (error) {
    console.error("Unable to build dashboard response", error);
    return res.status(500).json({ error: "Dashboard is unavailable." });
  }
};

export default handler;
