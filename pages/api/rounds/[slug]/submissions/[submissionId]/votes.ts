import type { NextApiRequest, NextApiResponse } from "next";
import { getPublicRoundBySlug, listRoundSubmissionVotes } from "data/rounds";

const getQueryValue = (value: string | string[] | undefined) =>
  typeof value === "string" ? value : value?.[0];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const slug = getQueryValue(req.query.slug);
  const submissionId = getQueryValue(req.query.submissionId);

  if (!slug) return res.status(400).json({ error: "Round slug is required." });
  if (!submissionId) {
    return res.status(400).json({ error: "Submission id is required." });
  }

  try {
    const round = await getPublicRoundBySlug(slug, { includeInlineMedia: false });
    if (!round) return res.status(404).json({ error: "Round not found." });

    const submission = round.submissions.find((item) => item.id === submissionId);
    if (!submission) {
      return res.status(404).json({ error: "Submission not found." });
    }

    const votes = await listRoundSubmissionVotes({
      roundId: round.id,
      submissionId,
    });

    return res.status(200).json({ votes });
  } catch (error) {
    console.error("Round submission votes load failed", error);
    return res.status(500).json({ error: "Unable to load votes." });
  }
}
