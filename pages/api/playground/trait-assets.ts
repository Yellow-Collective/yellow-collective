import type { Archiver } from "archiver";
import type { NextApiRequest, NextApiResponse } from "next";
import { getYellowCollectiveArtwork } from "data/nouns-builder/artwork";
import { getOriginalTraitAssetEntries } from "@/utils/playground/trait-assets";

export const config = {
  api: {
    responseLimit: false,
  },
};

const MAX_ASSET_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_BYTES = 16 * 1024 * 1024;

const getSafeError = (error: unknown) =>
  (error instanceof Error ? error.message : "Unable to download trait assets.")
    .replace(/[\r\n]+/g, " ")
    .slice(0, 160);

const fetchAsset = async (url: string) => {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok)
    throw new Error(`Asset request returned ${response.status}.`);

  const length = Number(response.headers.get("content-length") || "0");
  if (length > MAX_ASSET_BYTES)
    throw new Error("Asset is too large to export.");

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > MAX_ASSET_BYTES) {
    throw new Error("Asset is too large to export.");
  }

  return buffer;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    const entries = getOriginalTraitAssetEntries(
      await getYellowCollectiveArtwork()
    );
    if (!entries.length) {
      return res.status(500).json({ error: "Trait assets are unavailable." });
    }
    if (req.method === "HEAD") return res.status(204).end();

    const archiver = (
      (await import("archiver")) as unknown as {
        default: (
          format: "zip",
          options: { zlib: { level: number } }
        ) => Archiver;
      }
    ).default;
    const archive = archiver("zip", { zlib: { level: 6 } });

    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="noundry-trait-assets.zip"'
    );
    res.setHeader("Cache-Control", "public, max-age=3600");
    archive.pipe(res);

    const archiveFinished = new Promise<void>((resolve, reject) => {
      res.once("finish", resolve);
      res.once("close", () => {
        if (!res.writableFinished)
          reject(new Error("ZIP download was cancelled."));
      });
      archive.once("error", reject);
    });
    void archiveFinished.catch(() => undefined);

    let totalBytes = 0;
    const failedAssets: string[] = [];
    for (const entry of entries) {
      try {
        const asset = await fetchAsset(entry.sourceUrl);
        if (totalBytes + asset.length > MAX_TOTAL_BYTES) {
          throw new Error("Trait asset collection exceeds the export limit.");
        }
        archive.append(asset, { name: entry.name });
        totalBytes += asset.length;
      } catch (error) {
        failedAssets.push(`${entry.name}: ${getSafeError(error)}`);
      }
    }

    if (failedAssets.length) {
      archive.append(failedAssets.join("\n"), { name: "download-errors.txt" });
    }
    await archive.finalize();
    await archiveFinished;
  } catch (error) {
    console.error("Trait asset ZIP export failed", getSafeError(error));
    if (!res.headersSent) {
      return res
        .status(500)
        .json({ error: "Unable to download trait assets." });
    }
    res.destroy(error instanceof Error ? error : undefined);
  }
}
