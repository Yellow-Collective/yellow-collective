import { createHash } from "crypto";
import sharp from "sharp";

export const ROUND_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
export const ROUND_IMAGE_MAX_PIXELS = 40_000_000;
export const ROUND_IMAGE_MAX_DECODED_PIXELS = 80_000_000;
export const ROUND_IMAGE_MAX_FRAMES = 120;
export const ROUND_IMAGE_PREVIEW_SIZE = 640;

export type RoundImageMime = "image/png" | "image/jpeg" | "image/webp" | "image/gif";
let processing = 0;

const detectedMime = (bytes: Buffer): RoundImageMime | undefined => {
  if (bytes.subarray(0, 8).toString("hex") === "89504e470d0a1a0a") return "image/png";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  if (["GIF87a", "GIF89a"].includes(bytes.subarray(0, 6).toString("ascii"))) return "image/gif";
  if (bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return undefined;
};

export const decodeRoundImageDataUrl = (dataUrl: string) => {
  if (typeof dataUrl !== "string" || dataUrl.length > Math.ceil(ROUND_IMAGE_MAX_BYTES / 3) * 4 + 64) throw new Error("Image size is too large.");
  const match = /^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match || match[2].length % 4 !== 0) throw new Error("Unsupported image data format.");
  const original = Buffer.from(match[2], "base64");
  if (!original.length || original.length > ROUND_IMAGE_MAX_BYTES) throw new Error("Image size is too large.");
  const mime = detectedMime(original);
  const declaredMime = match[1] === "image/jpg" ? "image/jpeg" : match[1];
  if (!mime || mime !== declaredMime) throw new Error("Image content does not match its type.");
  if (mime === "image/gif" && original.length > 1024 * 1024) throw new Error("Choose a GIF no larger than 1MB.");
  return { original, mime };
};

/** Decodes locally with bounded native parser work; originals are never re-encoded. */
export const processRoundImage = async (dataUrl: string) => {
  const { original, mime } = decodeRoundImageDataUrl(dataUrl);
  if (processing >= 2) throw new Error("Image processing is busy. Please retry shortly.");
  processing += 1;
  try {
    const options = { animated: true, limitInputPixels: ROUND_IMAGE_MAX_DECODED_PIXELS, failOn: "warning" as const };
    const metadata = await sharp(original, options).timeout({ seconds: 5 }).metadata();
    const frames = metadata.pages || 1;
    const rawWidth = metadata.width || 0;
    const rawHeight = metadata.pageHeight || metadata.height || 0;
    const rotateDimensions = (metadata.orientation || 0) >= 5 && (metadata.orientation || 0) <= 8;
    const width = rotateDimensions ? rawHeight : rawWidth;
    const height = rotateDimensions ? rawWidth : rawHeight;
    if (!width || !height || frames > ROUND_IMAGE_MAX_FRAMES || width * height > ROUND_IMAGE_MAX_PIXELS || width * height * frames > ROUND_IMAGE_MAX_DECODED_PIXELS) throw new Error("Image dimensions or frame count exceed the limit.");
    const expected = { "image/png": "png", "image/jpeg": "jpeg", "image/webp": "webp", "image/gif": "gif" }[mime];
    if (metadata.format !== expected) throw new Error("Image content does not match its type.");
    // Force complete decoding so truncated or malformed animation frames cannot be attached.
    await sharp(original, options).timeout({ seconds: 5 }).stats();
    const preview = await sharp(original, { limitInputPixels: ROUND_IMAGE_MAX_DECODED_PIXELS, failOn: "warning", page: 0, pages: 1 })
      .rotate().resize(ROUND_IMAGE_PREVIEW_SIZE, ROUND_IMAGE_PREVIEW_SIZE, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 }).timeout({ seconds: 5 }).toBuffer();
    if (preview.length > 1024 * 1024) throw new Error("Image preview exceeds the size limit.");
    return { original, preview, mime, width, height, frames, bytes: original.length, previewBytes: preview.length, sha256: createHash("sha256").update(new Uint8Array(original)).digest("hex") };
  } catch (error) {
    if (error instanceof Error && /limit|type|content/.test(error.message)) throw error;
    throw new Error("Unable to process image content. Choose a valid supported image.");
  } finally {
    processing -= 1;
  }
};

/** Validate incoming project rasters even when object-storage writes are disabled. */
export const validateRoundImageUploads = async (images: readonly string[]) => {
  if (!Array.isArray(images) || images.length > 10) throw new Error("Choose at most 10 images.");
  // Sequential processing bounds native decode work and retains gallery ordering.
  for (const image of images) {
    if (typeof image !== "string") throw new Error("Unsupported image data format.");
    // Remote legacy references remain under the route's URL policy; never fetch them here.
    if (image.startsWith("data:")) await processRoundImage(image);
  }
};
