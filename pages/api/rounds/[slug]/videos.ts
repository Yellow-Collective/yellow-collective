import type { NextApiRequest, NextApiResponse } from "next";
import { getRoundBySlug } from "data/rounds";
import {
  reserveRoundVideo,
  finalizeRoundVideo,
  cancelRoundVideo,
} from "data/round-videos";
import { verifyRoundWalletSignedRequest } from "@/utils/rounds/server-auth";
import { videosEnabled } from "@/utils/rounds/video-storage";
export const config = { api: { bodyParser: { sizeLimit: "2kb" } } };
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "GET") return res.json({ enabled: videosEnabled() });
  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed." });
  }
  const operation = req.body?.operation;
  if (
    !["reserve", "finalize", "cancel"].includes(operation) ||
    Object.keys(req.body || {}).some(
      (key) => !["operation", "id"].includes(key)
    )
  )
    return res.status(400).json({ error: "Invalid video request." });
  if (operation !== "reserve" && !/^[a-f0-9-]{36}$/.test(req.body.id || ""))
    return res.status(400).json({ error: "Invalid upload ID." });
  try {
    const wallet = await verifyRoundWalletSignedRequest({
      req,
      res,
      action:
        operation === "reserve"
          ? "video-reserve"
          : operation === "finalize"
            ? "video-finalize"
            : "video-cancel",
    });
    if (!wallet) return;
    const round = await getRoundBySlug(String(req.query.slug || ""));
    if (!round) return res.status(404).json({ error: "Round not found." });
    if (operation === "reserve")
      return res.status(201).json(await reserveRoundVideo(round, wallet));
    if (operation === "finalize")
      return res.json(await finalizeRoundVideo(round, wallet, req.body.id));
    await cancelRoundVideo(round, wallet, req.body.id);
    return res.json({ cancelled: true });
  } catch (error) {
    // Never expose provider/SQL errors or signed URLs.
    const message = "Unable to process video. Try again later.";
    return res.status(400).json({ error: message });
  }
}
