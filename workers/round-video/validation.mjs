export const MAX_BYTES = 100 * 1024 * 1024;
export const validateProbe = (probe, bytes, header) => {
  const streams = probe?.streams;
  const duration = Number(probe?.format?.duration);
  if (
    !String(probe?.format?.format_name || "")
      .split(",")
      .includes("mp4") ||
    !Number.isSafeInteger(bytes) ||
    bytes < 16 ||
    bytes > MAX_BYTES ||
    header.toString("ascii", 4, 8) !== "ftyp" ||
    !["isom", "iso2", "mp41", "mp42", "avc1", "M4V "].includes(
      header.toString("ascii", 8, 12)
    ) ||
    !Array.isArray(streams) ||
    streams.length < 1 ||
    streams.length > 2 ||
    !Number.isFinite(duration) ||
    duration <= 0 ||
    duration > 120
  )
    throw new Error("Rejected video");
  const videos = streams.filter((stream) => stream.codec_type === "video");
  if (
    videos.length !== 1 ||
    videos[0].codec_name !== "h264" ||
    streams.some(
      (stream) =>
        !["video", "audio"].includes(stream.codec_type) ||
        (stream.codec_type === "audio" && stream.codec_name !== "aac")
    )
  )
    throw new Error("Rejected codecs");
  const { width, height } = videos[0];
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > 4096 ||
    height > 4096 ||
    !["yuv420p", "yuvj420p"].includes(videos[0].pix_fmt)
  )
    throw new Error("Rejected dimensions/pixel format");
  return { bytes, duration, width, height };
};
