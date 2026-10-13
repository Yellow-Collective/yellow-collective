import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import http from "node:http";
import { once } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { validateProbe } from "../workers/round-video/validation.mjs";

// Opt-in runtime check: requires ffmpeg and ffprobe on PATH, never a live bucket.
const run = promisify(execFile);
const folder = await mkdtemp(join(tmpdir(), "round-video-runtime-"));
let worker;
let bucket;
const fixture = async (name, codec, duration = "1") => {
  const path = join(folder, `${name}.mp4`);
  await run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "lavfi", "-i", "color=c=yellow:s=160x120:r=1",
    "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono",
    "-t", duration, "-c:v", codec, "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-movflags", "+faststart", path,
  ], { timeout: 60000, maxBuffer: 256 * 1024 });
  const bytes = await readFile(path);
  const { stdout } = await run("ffprobe", [
    "-v", "error", "-protocol_whitelist", "file",
    "-probesize", "8388608", "-analyzeduration", "5000000",
    "-show_format", "-show_streams", "-of", "json", path,
  ], { timeout: 20000, maxBuffer: 256 * 1024 });
  return { probe: JSON.parse(stdout), bytes };
};

try {
  const valid = await fixture("valid-h264-aac", "libx264");
  const metadata = validateProbe(valid.probe, valid.bytes.length, valid.bytes.subarray(0, 16));
  assert.equal(metadata.width, 160);
  assert.equal(metadata.height, 120);
  assert.ok(metadata.duration > 0 && metadata.duration < 2);
  console.log("PASS: real MP4 H.264/AAC accepted by ffprobe validation");

  const wrongCodec = await fixture("invalid-mpeg4-codec", "mpeg4");
  assert.throws(() => validateProbe(wrongCodec.probe, wrongCodec.bytes.length, wrongCodec.bytes.subarray(0, 16)), /Rejected codecs/);
  console.log("PASS: real MP4 with unsupported MPEG-4 codec rejected");

  const tooLong = await fixture("invalid-duration", "libx264", "121");
  assert.throws(() => validateProbe(tooLong.probe, tooLong.bytes.length, tooLong.bytes.subarray(0, 16)), /Rejected video/);
  console.log("PASS: real MP4 over 120 seconds rejected");

  assert.throws(() => validateProbe(valid.probe, valid.bytes.length, Buffer.alloc(16)), /Rejected video/);
  console.log("PASS: misleading MP4 file header rejected");

  // Run the actual worker and AWS SDK against an isolated HTTP storage fixture.
  // This verifies process/transport behavior, not Railway's implementation.
  const objects = new Map();
  bucket = http.createServer(async (request, response) => {
    const key = decodeURIComponent(new URL(request.url, "http://local").pathname).replace(/^\/fixture\//, "");
    if (request.method === "GET" && objects.has(key)) {
      const body = objects.get(key);
      response.writeHead(200, { "Content-Length": body.length, "Content-Type": "video/mp4" });
      response.end(body);
      return;
    }
    if (request.method === "PUT") {
      if (request.headers["if-none-match"] !== "*" || objects.has(key)) {
        response.writeHead(412);
        response.end();
        return;
      }
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      let body = Buffer.concat(chunks);
      if (String(request.headers["content-encoding"]).includes("aws-chunked")) {
        const payload = [];
        let offset = 0;
        while (offset < body.length) {
          const end = body.indexOf("\r\n", offset);
          const size = Number.parseInt(body.subarray(offset, end).toString("ascii"), 16);
          assert.ok(Number.isSafeInteger(size) && size >= 0);
          if (!size) break;
          payload.push(body.subarray(end + 2, end + 2 + size));
          offset = end + 2 + size + 2;
        }
        body = Buffer.concat(payload);
      }
      objects.set(key, body);
      response.writeHead(200, { ETag: '"local-fixture"' });
      response.end();
      return;
    }
    response.writeHead(404);
    response.end();
  });
  bucket.listen(0, "127.0.0.1");
  await once(bucket, "listening");
  const portProbe = http.createServer();
  portProbe.listen(0, "127.0.0.1");
  await once(portProbe, "listening");
  const workerPort = portProbe.address().port;
  await new Promise(resolve => portProbe.close(resolve));
  const token = "local-fixture-token-with-at-least-32-characters";
  worker = spawn(process.execPath, ["workers/round-video/server.mjs"], {
    env: {
      ...process.env,
      PORT: String(workerPort),
      ROUND_VIDEO_S3_ENDPOINT: `http://127.0.0.1:${bucket.address().port}`,
      ROUND_VIDEO_S3_REGION: "us-east-1",
      ROUND_VIDEO_S3_BUCKET: "fixture",
      ROUND_VIDEO_S3_ACCESS_KEY_ID: "synthetic-access-key",
      ROUND_VIDEO_S3_SECRET_ACCESS_KEY: "synthetic-secret-key",
      ROUND_VIDEO_S3_FORCE_PATH_STYLE: "true",
      ROUND_VIDEO_WORKER_TOKEN: token,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let diagnostic = "";
  worker.stderr.on("data", chunk => { diagnostic += chunk.toString(); });
  const endpoint = `http://127.0.0.1:${workerPort}/validate`;
  let started = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (worker.exitCode !== null) throw new Error(`Worker exited during fixture startup: ${diagnostic}`);
    try {
      const response = await fetch(endpoint, { method: "POST", signal: AbortSignal.timeout(500) });
      assert.equal(response.status, 401);
      started = true;
      break;
    } catch { await new Promise(resolve => setTimeout(resolve, 50)); }
  }
  assert.ok(started, "Worker should start against local storage fixture");
  const validate = async (id, bytes) => {
    const stagingKey = `round-videos/staging/${id}.mp4`;
    const objectKey = `round-videos/approved/${id}.mp4`;
    objects.set(stagingKey, bytes);
    const response = await fetch(endpoint, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ id, stagingKey, objectKey }), signal: AbortSignal.timeout(30000),
    });
    return { response, objectKey, stagingKey };
  };
  const accepted = await validate("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", valid.bytes);
  assert.equal(accepted.response.status, 200);
  assert.equal((await accepted.response.json()).objectKey, accepted.objectKey);
  assert.deepEqual(objects.get(accepted.objectKey), valid.bytes);
  objects.set(accepted.stagingKey, Buffer.from("mutated staging"));
  assert.deepEqual(objects.get(accepted.objectKey), valid.bytes);
  console.log("PASS: real worker publishes exactly inspected bytes and staging mutation cannot replace them");
  const rejected = await validate("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", wrongCodec.bytes);
  assert.equal(rejected.response.status, 422);
  assert.equal(objects.has(rejected.objectKey), false);
  console.log("PASS: real worker rejects unsupported codec without publishing it");
  const replay = await validate("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", valid.bytes);
  assert.equal(replay.response.status, 503);
  assert.deepEqual(objects.get(accepted.objectKey), valid.bytes);
  console.log("PASS: conditional promotion replay fails without changing approved bytes");
} finally {
  if (worker && worker.exitCode === null) {
    worker.kill();
    await once(worker, "exit");
  }
  if (bucket) {
    bucket.closeAllConnections();
    await new Promise(resolve => bucket.close(resolve));
  }
  await rm(folder, { recursive: true, force: true });
}
