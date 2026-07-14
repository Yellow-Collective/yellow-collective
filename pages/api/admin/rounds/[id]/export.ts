import type { Archiver } from "archiver";
import type { NextApiRequest, NextApiResponse } from "next";
import { getRoundById, listRoundSubmissions } from "data/rounds";
import { requireAdminRequest } from "@/utils/admin-api";
import {
  createRoundSubmissionsZipCsv,
  getRoundSubmissionArtworkFilename,
  getRoundSubmissionsZipFilename,
  isRoundExportable,
  type RoundArtworkExportResult,
} from "@/utils/rounds/admin-submissions-export";
import {
  fetchRoundSubmissionArtwork,
  ROUND_ARTWORK_MAX_BYTES,
  ROUND_ARTWORK_TOTAL_MAX_BYTES,
} from "@/utils/rounds/submission-export-server";

export const config = {
  api: {
    responseLimit: false,
  },
};

const getId = (req: NextApiRequest) => {
  const id = req.query.id;
  return typeof id === "string" ? id : id?.[0];
};

const getSafeExportError = (error: unknown) => {
  const message = error instanceof Error ? error.message : "Artwork export failed.";
  return message.replace(/[\r\n]+/g, " ").slice(0, 160);
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  if (!(await requireAdminRequest(req, res, "rounds"))) return;

  const id = getId(req);
  if (!id) return res.status(400).json({ error: "Round id is required." });

  try {
    const round = await getRoundById(id);
    if (!round) return res.status(404).json({ error: "Round not found." });
    if (!isRoundExportable(round)) {
      return res.status(409).json({
        error: "Round submissions can only be exported after voting concludes.",
      });
    }

    const submissions = await listRoundSubmissions(id);
    const filename = getRoundSubmissionsZipFilename(round);
    const archiver = (
      (await import("archiver")) as unknown as {
        default: (
          format: "zip",
          options: { zlib: { level: number } }
        ) => Archiver;
      }
    ).default;
    const archive = archiver("zip", { zlib: { level: 6 } });
    const artworkResults: Record<string, RoundArtworkExportResult> = {};
    let exportedArtworkBytes = 0;

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "private, no-store");
    archive.pipe(res);
    res.flushHeaders();

    const archiveFinished = new Promise<void>((resolve, reject) => {
      res.once("finish", resolve);
      res.once("close", () => {
        if (!res.writableFinished) {
          reject(new Error("ZIP export connection closed before completion."));
        }
      });
      archive.once("error", reject);
    });
    void archiveFinished.catch(() => undefined);

    const appendArtwork = (buffer: Buffer, name: string) =>
      new Promise<void>((resolve, reject) => {
        const handleEntry = (entry: { name: string }) => {
          if (entry.name !== name) return;
          cleanup();
          resolve();
        };
        const handleError = (error: Error) => {
          cleanup();
          reject(error);
        };
        const cleanup = () => {
          archive.off("entry", handleEntry);
          archive.off("error", handleError);
        };

        archive.on("entry", handleEntry);
        archive.on("error", handleError);
        archive.append(buffer, { name });
      });

    for (let index = 0; index < submissions.length; index += 1) {
      const submission = submissions[index];

      try {
        const remainingBytes =
          ROUND_ARTWORK_TOTAL_MAX_BYTES - exportedArtworkBytes;
        const artwork = await fetchRoundSubmissionArtwork({
          image: submission.image,
          maxBytes: Math.min(ROUND_ARTWORK_MAX_BYTES, remainingBytes),
        });
        const artworkFilename = getRoundSubmissionArtworkFilename({
          index,
          submission,
          contentType: artwork.contentType,
        });
        await appendArtwork(artwork.buffer, `artwork/${artworkFilename}`);
        exportedArtworkBytes += artwork.buffer.length;
        artworkResults[submission.id] = {
          status: "exported",
          filename: artworkFilename,
          error: "",
        };
      } catch (error) {
        const message = getSafeExportError(error);
        artworkResults[submission.id] = {
          status: "failed",
          filename: "",
          error: message,
        };
        console.warn("Admin round artwork export skipped", {
          roundId: round.id,
          submissionId: submission.id,
          error: message,
        });
      }
    }

    archive.append(
      createRoundSubmissionsZipCsv({
        round,
        submissions,
        artworkResults,
      }),
      { name: "submissions.csv" }
    );
    await archive.finalize();
    await archiveFinished;
  } catch (error) {
    console.error("Admin round submissions ZIP export failed", {
      roundId: id,
      error: getSafeExportError(error),
    });

    if (!res.headersSent) {
      return res.status(500).json({ error: "Unable to export submissions." });
    }

    res.destroy(error instanceof Error ? error : undefined);
  }
}
