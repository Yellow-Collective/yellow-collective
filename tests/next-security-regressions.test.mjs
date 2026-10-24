import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

// Opt-in production fixture: no app data, environment files or remote services.
// Run: node tests/next-security-regressions.test.mjs
const require = createRequire(import.meta.url);
const run = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nextBin = require.resolve("next/dist/bin/next");
const sharp = require("sharp");
await mkdir(join(root, ".codex-tmp"), { recursive: true });
const fixture = await mkdtemp(join(root, ".codex-tmp", "next-security-fixture-"));
const env = Object.fromEntries(
  ["PATH", "Path", "SystemRoot", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "COMSPEC", "PATHEXT"]
    .filter((key) => process.env[key] !== undefined)
    .map((key) => [key, process.env[key]])
);
Object.assign(env, { NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1" });
let server;
let output = "";

try {
  const nextPackage = require("next/package.json");
  assert.ok(require("semver").gte(nextPackage.version, "15.5.28"));
  const nextRequire = createRequire(require.resolve("next/package.json"));
  const nextSharpPath = nextRequire.resolve("sharp");
  const sharpPackage = JSON.parse(await readFile(join(dirname(nextSharpPath), "../package.json"), "utf8"));
  assert.ok(require("semver").gte(sharpPackage.version, "0.35.5"), "Next must resolve patched sharp despite Yarn overrides");

  await mkdir(join(fixture, "pages"));
  await mkdir(join(fixture, "public"));
  await writeFile(join(fixture, "package.json"), JSON.stringify({ private: true }));
  await writeFile(join(fixture, "next.config.js"), `
const config = require(${JSON.stringify(join(root, "next.config.js"))});
module.exports = { ...config, experimental: { ...config.experimental, cpus: 1 }, eslint: { ignoreDuringBuilds: true } };
`);
  await writeFile(join(fixture, "pages", "index.jsx"), `
export default function Home() { return <main>static-home-marker</main>; }
export async function getStaticProps() { return { props: {}, revalidate: 60 }; }
`);
  await writeFile(join(fixture, "pages", "[...slug].jsx"), `
export default function Page({ marker }) { return <main>{marker}</main>; }
export async function getStaticPaths() { return { paths: ['/alpha', '/beta'], fallback: 'blocking' }; }
export async function getStaticProps({ params }) {
  return { props: { marker: 'route-marker-' + params.slug.join('/') }, revalidate: 1 };
}
`);
  await sharp({ create: { width: 128, height: 128, channels: 3, background: "yellow" } })
    .png().toFile(join(fixture, "public", "fixture.png"));
  await writeFile(join(fixture, "public", "fixture.svg"), '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="yellow"/></svg>');

  const build = await run(process.execPath, [nextBin, "build", fixture], {
    cwd: fixture, env, timeout: 180000, maxBuffer: 4 * 1024 * 1024,
  });
  output += build.stdout + build.stderr;
  server = spawn(process.execPath, [nextBin, "start", fixture, "--hostname", "127.0.0.1", "--port", "0"], {
    cwd: fixture, env, stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", (chunk) => { output += chunk; });
  server.stderr.on("data", (chunk) => { output += chunk; });
  const startupDeadline = Date.now() + 30000;
  let origin;
  while (Date.now() < startupDeadline) {
    assert.equal(server.exitCode, null, output);
    origin = output.match(/http:\/\/127\.0\.0\.1:(\d+)/)?.[0];
    if (origin) {
      try {
        const response = await fetch(origin, { signal: AbortSignal.timeout(1000) });
        if (response.ok) break;
      } catch { /* Wait for the local server to finish starting. */ }
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(origin, "Production fixture must start on loopback");
  const request = (path, options = {}) => fetch(origin + path, { ...options, signal: AbortSignal.timeout(15000) });
  const imagePath = "/_next/image?url=%2Ffixture.png&w=64&q=75";
  const first = await request(imagePath);
  assert.equal(first.status, 200);
  assert.match(first.headers.get("content-type"), /^image\//);
  assert.equal((await sharp(Buffer.from(await first.arrayBuffer())).metadata()).width, 64);
  const cached = await request(imagePath);
  assert.equal(cached.status, 200);
  assert.equal(cached.headers.get("x-nextjs-cache"), "HIT");
  await cached.arrayBuffer();
  assert.equal((await request("/_next/image?url=%2Ffixture.svg&w=64&q=75")).status, 400);
  assert.equal((await request("/_next/image?url=https%3A%2F%2Funapproved.invalid%2Fimage.png&w=64&q=75")).status, 400);
  console.log("ok - patched Next/sharp optimize and cache PNGs, reject SVGs and unapproved hosts");

  // Exercise cold, warm and stale ISR entries with distinct routes, including a
  // root catch-all sharing URL space with a static route (the cache advisory).
  for (const phase of ["cold", "warm", "stale"]) {
    if (phase === "stale") await new Promise((resolve) => setTimeout(resolve, 1200));
    for (const slug of ["alpha", "beta", "alpha"]) {
      const response = await request(`/${slug}`);
      assert.equal(response.status, 200);
      assert.match(response.headers.get("cache-control"), /s-maxage=1/);
      const body = await response.text();
      assert.ok(body.includes(`route-marker-${slug}`), `${phase}: expected ${slug} content`);
      assert.ok(!body.includes(`route-marker-${slug === "alpha" ? "beta" : "alpha"}`));
    }
    const response = await request("/");
    assert.equal(response.status, 200);
    const home = await response.text();
    assert.ok(home.includes("static-home-marker"));
    assert.ok(!home.includes("route-marker-"));
  }
  console.log("ok - production SSG/ISR preserves route isolation through cache hits and revalidation");
} catch (error) {
  console.error(output);
  throw error;
} finally {
  if (server && server.exitCode === null) {
    server.kill();
    await once(server, "exit");
  }
  await rm(fixture, { recursive: true, force: true });
}
