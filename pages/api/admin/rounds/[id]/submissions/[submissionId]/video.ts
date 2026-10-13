import type { NextApiRequest, NextApiResponse } from "next";
import { getRoundSubmission } from "data/rounds";
import { requireAdminRequest } from "@/utils/admin-api";
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
    if (!(await requireAdminRequest(req, res, "rounds"))) return;
    if (!videosEnabled())
      return res.status(503).json({ error: "Video playback unavailable." });
    const submission = await getRoundSubmission(
      String(req.query.id || ""),
      String(req.query.submissionId || "")
    );
    if (!submission?.video || submission.deletedAt)
      return res.status(404).json({ error: "Video not found." });
    return res.json({
      url: await videoPlaybackUrl(submission.video.objectKey),
    });
  } catch {
    return res.status(503).json({ error: "Unable to load video." });
  }
}
