import http from "node:http";
import { timingSafeEqual } from "node:crypto";
import { mkdtemp, rm, open } from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { MAX_BYTES, validateProbe } from "./validation.mjs";
const run = promisify(execFile);
const required = [
  "ROUND_VIDEO_S3_ENDPOINT",
  "ROUND_VIDEO_S3_REGION",
  "ROUND_VIDEO_S3_BUCKET",
  "ROUND_VIDEO_S3_ACCESS_KEY_ID",
  "ROUND_VIDEO_S3_SECRET_ACCESS_KEY",
  "ROUND_VIDEO_WORKER_TOKEN",
];
if (
  required.some((key) => !process.env[key]) ||
  process.env.ROUND_VIDEO_WORKER_TOKEN.length < 32
)
  throw new Error("Worker configuration incomplete");
const s3 = new S3Client({
  endpoint: process.env.ROUND_VIDEO_S3_ENDPOINT,
  region: process.env.ROUND_VIDEO_S3_REGION,
  forcePathStyle: process.env.ROUND_VIDEO_S3_FORCE_PATH_STYLE === "true",
  maxAttempts: 1,
  credentials: {
    accessKeyId: process.env.ROUND_VIDEO_S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.ROUND_VIDEO_S3_SECRET_ACCESS_KEY,
  },
});
let busy = false;
const server = http.createServer(async (req, res) => {
  const reply = (code, data) => {
    res.writeHead(code, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  };
  const auth = Buffer.from(req.headers.authorization || "");
  const expected = Buffer.from(
    `Bearer ${process.env.ROUND_VIDEO_WORKER_TOKEN}`
  );
  if (
    req.method !== "POST" ||
    req.url !== "/validate" ||
    auth.length !== expected.length ||
    !timingSafeEqual(auth, expected)
  )
    return reply(401, { error: "Unauthorized" });
  if (busy) return reply(409, { error: "Worker busy" });
  busy = true;
  let folder;
  const abort = new AbortController();
  const timer = setTimeout(() => {
    abort.abort();
    req.destroy();
  }, 80000);
  try {
    let body = "";
    for await (const chunk of req) {
      body += chunk.toString();
      if (Buffer.byteLength(body) > 2048) throw new Error("Request too large");
    }
    const job = JSON.parse(body);
    if (
      !/^[a-f0-9-]{36}$/.test(job.id) ||
      job.stagingKey !== `round-videos/staging/${job.id}.mp4` ||
      job.objectKey !== `round-videos/approved/${job.id}.mp4`
    )
      throw new Error("Invalid job");
    folder = await mkdtemp(join(tmpdir(), "round-video-"));
    const file = join(folder, "upload.mp4");
    const object = await s3.send(
      new GetObjectCommand({
        Bucket: process.env.ROUND_VIDEO_S3_BUCKET,
        Key: job.stagingKey,
      }),
      { abortSignal: abort.signal }
    );
    if (
      !object.Body ||
      !Number.isSafeInteger(object.ContentLength) ||
      object.ContentLength < 16 ||
      object.ContentLength > MAX_BYTES
    ) {
      object.Body?.destroy();
      throw new Error("Rejected size");
    }
    let bytes = 0;
    const bounded = new Transform({
      transform(chunk, encoding, callback) {
        bytes += chunk.length;
        callback(bytes > MAX_BYTES ? new Error("Rejected size") : null, chunk);
      },
    });
    await pipeline(object.Body, bounded, createWriteStream(file), {
      signal: abort.signal,
    });
    const handle = await open(file, "r");
    const header = Buffer.alloc(16);
    try {
      await handle.read(header, 0, 16, 0);
    } finally {
      await handle.close();
    }
    const { stdout } = await run(
      "ffprobe",
      [
        "-v",
        "error",
        "-protocol_whitelist",
        "file",
        "-probesize",
        "8388608",
        "-analyzeduration",
        "5000000",
        "-show_format",
        "-show_streams",
        "-of",
        "json",
        file,
      ],
      { timeout: 20000, maxBuffer: 256 * 1024 }
    );
    let metadata;
    try {
      metadata = validateProbe(JSON.parse(stdout), bytes, header);
    } catch {
      const rejection = new Error("Rejected video");
      rejection.deterministic = true;
      throw rejection;
    }
    // Publish exactly the inspected bytes, never copy a mutable staging object.
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.ROUND_VIDEO_S3_BUCKET,
        Key: job.objectKey,
        Body: createReadStream(file),
        ContentLength: bytes,
        ContentType: "video/mp4",
        IfNoneMatch: "*",
      }),
      { abortSignal: abort.signal }
    );
    reply(200, { objectKey: job.objectKey, ...metadata });
  } catch (error) {
    reply(
      error.deterministic ||
        /^(Rejected size|Invalid job|Request too large)$/.test(error.message)
        ? 422
        : 503,
      { error: "Video validation failed" }
    );
  } finally {
    clearTimeout(timer);
    try {
      if (folder) await rm(folder, { recursive: true, force: true });
    } catch {
      console.error("Video worker temporary file cleanup failed.");
    } finally {
      busy = false;
    }
  }
});
server.headersTimeout = 10000;
server.requestTimeout = 15000;
server.timeout = 85000;
server.listen(Number(process.env.PORT || 8080));
