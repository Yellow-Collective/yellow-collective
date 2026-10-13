import type { NextApiRequest, NextApiResponse } from "next";
import { getRoundBySlug, getRoundSubmission } from "data/rounds";
import { videoPlaybackUrl, videosEnabled } from "@/utils/rounds/video-storage";
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end();
  }
  try {
    if (!videosEnabled())
      return res.status(503).json({ error: "Video playback unavailable." });
    const round = await getRoundBySlug(String(req.query.slug || ""));
    if (!round || round.status !== "published" || !round.active)
      return res.status(404).json({ error: "Video not found." });
    const submission = await getRoundSubmission(
      round.id,
      String(req.query.id || "")
    );
    if (
      !submission?.video ||
      submission.status !== "approved" ||
      submission.deletedAt
    )
      return res.status(404).json({ error: "Video not found." });
    return res.json({
      url: await videoPlaybackUrl(submission.video.objectKey),
      expiresIn: 900,
    });
  } catch {
    return res.status(503).json({ error: "Video playback unavailable." });
  }
}
