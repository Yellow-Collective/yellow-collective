import { createHash } from "crypto";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { processRoundImage, ROUND_IMAGE_MAX_BYTES, RoundImageMime } from "./image-processing";

export type RoundImageAsset = { key: string; previewKey: string; sha256: string; bytes: number; mime: RoundImageMime; width: number; height: number; frames: number; previewBytes: number };
export const ROUND_IMAGE_LINK_SECONDS = 60;
const segment = /^[A-Za-z0-9_-]{1,100}$/;
const keyPattern = /^round-images\/v1\/([A-Za-z0-9_-]{1,100})\/([A-Za-z0-9_-]{1,100})\/([0-9])-([a-f0-9]{64})(\.preview\.webp|\.(?:png|jpeg|webp|gif))$/;
export const isRoundImageKeyForSubmission = (key: string, roundId: string, submissionId: string) => {
  const match = keyPattern.exec(key);
  return Boolean(match && segment.test(roundId) && segment.test(submissionId) && match[1] === roundId && match[2] === submissionId);
};

export const imageStorageReadiness = () => {
  const enabled = process.env.ROUND_IMAGES_ENABLED === "true";
  const writesEnabled = process.env.ROUND_IMAGE_WRITES_ENABLED === "true";
  let configured = ["ROUND_IMAGE_S3_REGION", "ROUND_IMAGE_S3_ACCESS_KEY_ID", "ROUND_IMAGE_S3_SECRET_ACCESS_KEY"].every((key) => Boolean(process.env[key]));
  try {
    const endpoint = new URL(process.env.ROUND_IMAGE_S3_ENDPOINT || "");
    configured = configured && endpoint.protocol === "https:" && !endpoint.username && !endpoint.password && !endpoint.search && !endpoint.hash && /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(process.env.ROUND_IMAGE_S3_BUCKET || "");
  } catch { configured = false; }
  return { enabled, writesEnabled, ready: enabled && configured, reason: !enabled ? "disabled" : !configured ? "unconfigured" : "ready" };
};
const client = () => new S3Client({ endpoint: process.env.ROUND_IMAGE_S3_ENDPOINT, region: process.env.ROUND_IMAGE_S3_REGION, forcePathStyle: process.env.ROUND_IMAGE_S3_FORCE_PATH_STYLE === "true", maxAttempts: 2, credentials: { accessKeyId: process.env.ROUND_IMAGE_S3_ACCESS_KEY_ID!, secretAccessKey: process.env.ROUND_IMAGE_S3_SECRET_ACCESS_KEY! } });
const checkReady = (write = false) => {
  const readiness = imageStorageReadiness();
  if (!readiness.ready || (write && !readiness.writesEnabled)) throw new Error("Image storage is unavailable. Please retry later.");
};
const checkKey = (key: string) => { if (!keyPattern.test(key)) throw new Error("Invalid image object."); };

export const readRoundImage = async (key: string): Promise<Buffer> => {
  checkReady(); checkKey(key);
  try {
    const result = await client().send(new GetObjectCommand({ Bucket: process.env.ROUND_IMAGE_S3_BUCKET, Key: key }), { abortSignal: AbortSignal.timeout(15000) });
    if (!result.Body || (result.ContentLength || 0) > ROUND_IMAGE_MAX_BYTES) throw new Error("Invalid stored image.");
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of result.Body as AsyncIterable<Uint8Array>) {
      size += chunk.length;
      if (size > ROUND_IMAGE_MAX_BYTES) throw new Error("Invalid stored image.");
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks.map((chunk) => new Uint8Array(chunk)));
  } catch {
    throw new Error("Image storage verification failed. Please retry later.");
  }
};

/** Call only after resource eligibility and ownership checks. A key is not authorization. */
export const signRoundImage = async (key: string): Promise<string> => {
  checkReady(); checkKey(key);
  return getSignedUrl(client(), new GetObjectCommand({ Bucket: process.env.ROUND_IMAGE_S3_BUCKET, Key: key, ResponseCacheControl: "private, max-age=0, no-store", ResponseContentDisposition: "inline" }), { expiresIn: ROUND_IMAGE_LINK_SECONDS });
};

/** Stores validated private bytes and verifies persisted bytes before returning attachment metadata. */
export const storeRoundImage = async ({ roundId, submissionId, index, dataUrl }: { roundId: string; submissionId: string; index: number; dataUrl: string }): Promise<RoundImageAsset> => {
  checkReady(true);
  if (!segment.test(roundId) || !segment.test(submissionId) || !Number.isInteger(index) || index < 0 || index >= 10) throw new Error("Invalid image attachment scope.");
  const image = await processRoundImage(dataUrl);
  const prefix = `round-images/v1/${roundId}/${submissionId}/${index}-${image.sha256}`;
  const key = `${prefix}.${image.mime.split("/")[1]}`;
  const previewKey = `${prefix}.preview.webp`;
  for (const [objectKey, bytes, mime] of [[key, image.original, image.mime], [previewKey, image.preview, "image/webp"]] as const) {
    const hash = createHash("sha256").update(new Uint8Array(bytes)).digest("base64");
    await client().send(new PutObjectCommand({ Bucket: process.env.ROUND_IMAGE_S3_BUCKET, Key: objectKey, Body: bytes, ContentType: mime, ContentLength: bytes.length, ChecksumSHA256: hash, CacheControl: "private, max-age=0, no-store", IfNoneMatch: "*" }), { abortSignal: AbortSignal.timeout(15000) }).catch((error: { $metadata?: { httpStatusCode?: number } }) => {
      if (error.$metadata?.httpStatusCode !== 412) throw new Error("Image storage upload failed. Please retry later.");
    });
    const stored = await readRoundImage(objectKey);
    if (stored.length !== bytes.length || createHash("sha256").update(new Uint8Array(stored)).digest("base64") !== hash) throw new Error("Image storage verification failed.");
  }
  const { sha256, bytes, mime, width, height, frames, previewBytes } = image;
  return { key, previewKey, sha256, bytes, mime, width, height, frames, previewBytes };
};
