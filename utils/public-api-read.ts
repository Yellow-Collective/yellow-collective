import type { NextApiHandler } from "next";

// Legacy public chain/ENS handlers have no private identity. Restrict methods
// and contain provider failures before Next can render an exception response.
export const publicApiRead = (handler: NextApiHandler): NextApiHandler => async (req, res) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }
  try {
    return await handler(req, res);
  } catch {
    if (res.headersSent) { res.end(); return; }
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    return res.status(500).json({ error: "Unable to load public data." });
  }
};
