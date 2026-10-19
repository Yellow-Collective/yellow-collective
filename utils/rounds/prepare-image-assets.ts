import type { RoundImageAsset } from "./image-storage";

/** Compatibility bytes remain until separately authorized legacy retirement.
 * An unavailable disabled backend never blocks existing image submissions.
 * Once writes are explicitly enabled, failures are recoverable and fail closed.
 */
export const prepareRoundImageAssets = async (roundId: string, submissionId: string, images: string[]) => {
  if (process.env.ROUND_IMAGE_WRITES_ENABLED !== "true") {
    const { validateRoundImageUploads } = await import("./image-processing");
    await validateRoundImageUploads(images);
    return [];
  }
  const { imageStorageReadiness, storeRoundImage } = await import("./image-storage");
  if (!imageStorageReadiness().ready) throw new Error("Image storage is temporarily unavailable. Please retry later.");
  const assets: (RoundImageAsset | null)[] = [];
  for (const [index, dataUrl] of images.entries()) {
    assets.push(dataUrl.startsWith("data:image/") ? await storeRoundImage({ roundId, submissionId, index, dataUrl }) : null);
  }
  return assets;
};
