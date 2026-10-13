export const ROUND_VIDEO_MAX_BYTES = 100 * 1024 * 1024;
export const ROUND_VIDEO_MAX_SECONDS = 120;
export const ROUND_VIDEO_UPLOAD_SECONDS = 300;
export const ROUND_VIDEO_RESERVATION_SECONDS = 1800;
export type RoundVideo = {
  objectKey: string;
  bytes: number;
  duration: number;
  width: number;
  height: number;
};

export const validateVideoMetadata = (value: unknown): RoundVideo => {
  const video = value as RoundVideo;
  if (
    !video ||
    typeof video.objectKey !== "string" ||
    !/^round-videos\/approved\/[a-f0-9-]+\.mp4$/.test(video.objectKey) ||
    !Number.isSafeInteger(video.bytes) ||
    video.bytes < 1 ||
    video.bytes > ROUND_VIDEO_MAX_BYTES ||
    !Number.isFinite(video.duration) ||
    video.duration <= 0 ||
    video.duration > ROUND_VIDEO_MAX_SECONDS ||
    !Number.isInteger(video.width) ||
    video.width < 1 ||
    video.width > 4096 ||
    !Number.isInteger(video.height) ||
    video.height < 1 ||
    video.height > 4096
  )
    throw new Error("Video validation failed.");
  return {
    objectKey: video.objectKey,
    bytes: video.bytes,
    duration: video.duration,
    width: video.width,
    height: video.height,
  };
};
