import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  ROUND_VIDEO_MAX_BYTES,
  ROUND_VIDEO_UPLOAD_SECONDS,
} from "./video-policy";

export const videosEnabled = () => {
  if (
    process.env.ROUND_VIDEOS_ENABLED !== "true" ||
    ![
      "ROUND_VIDEO_S3_REGION",
      "ROUND_VIDEO_S3_ACCESS_KEY_ID",
      "ROUND_VIDEO_S3_SECRET_ACCESS_KEY",
    ].every((key) => Boolean(process.env[key]))
  )
    return false;
  try {
    const storage = new URL(process.env.ROUND_VIDEO_S3_ENDPOINT!);
    const worker = new URL(process.env.ROUND_VIDEO_WORKER_URL!);
    return (
      storage.protocol === "https:" &&
      !storage.username &&
      !storage.password &&
      (worker.protocol === "https:" ||
        (worker.protocol === "http:" &&
          worker.hostname.endsWith(".railway.internal"))) &&
      !worker.username &&
      !worker.password &&
      worker.pathname === "/validate" &&
      !worker.search &&
      /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(
        process.env.ROUND_VIDEO_S3_BUCKET || ""
      ) &&
      (process.env.ROUND_VIDEO_WORKER_TOKEN?.length || 0) >= 32
    );
  } catch {
    return false;
  }
};
export const videoBucket = () => process.env.ROUND_VIDEO_S3_BUCKET!;
export const videoStorage = () =>
  new S3Client({
    endpoint: process.env.ROUND_VIDEO_S3_ENDPOINT,
    region: process.env.ROUND_VIDEO_S3_REGION,
    forcePathStyle: process.env.ROUND_VIDEO_S3_FORCE_PATH_STYLE === "true",
    maxAttempts: 2,
    credentials: {
      accessKeyId: process.env.ROUND_VIDEO_S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.ROUND_VIDEO_S3_SECRET_ACCESS_KEY!,
    },
  });
export const videoUploadPost = (key: string) =>
  createPresignedPost(videoStorage(), {
    Bucket: videoBucket(),
    Key: key,
    Expires: ROUND_VIDEO_UPLOAD_SECONDS,
    Fields: { "Content-Type": "video/mp4" },
    Conditions: [
      ["content-length-range", 1, ROUND_VIDEO_MAX_BYTES],
      ["eq", "$Content-Type", "video/mp4"],
    ],
  });
export const videoPlaybackUrl = (key: string) => {
  if (!/^round-videos\/approved\/[a-f0-9-]{36}\.mp4$/.test(key)) {
    throw new Error("Invalid video object.");
  }
  return getSignedUrl(
    videoStorage(),
    new GetObjectCommand({
      Bucket: videoBucket(),
      Key: key,
      ResponseContentType: "video/mp4",
      ResponseContentDisposition: "inline",
    }),
    { expiresIn: 900 }
  );
};
