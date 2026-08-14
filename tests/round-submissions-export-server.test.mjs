import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const serverHelperPath = resolve(
  process.cwd(),
  "utils/rounds/submission-export-server.ts"
);

assert.equal(
  existsSync(serverHelperPath),
  true,
  "server artwork export helper must exist"
);

const source = readFileSync(serverHelperPath, "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    esModuleInterop: true,
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
});
const module = { exports: {} };
const testRequire = (specifier) => {
  if (specifier === "@/utils/url-safety") {
    return {
      normalizeSafeImageUrl: (value) => String(value || ""),
    };
  }
  if (specifier === "@/utils/site") {
    return { SITE_URL: "https://yellowcollective.art" };
  }
  return require(specifier);
};

vm.runInNewContext(transpiled.outputText, {
  require: testRequire,
  module,
  exports: module.exports,
  Buffer,
  URL,
  Promise,
  process,
  setTimeout,
  clearTimeout,
});

const { fetchRoundSubmissionArtwork, isUnsafeNetworkAddress } = module.exports;
assert.equal(typeof fetchRoundSubmissionArtwork, "function");
assert.equal(typeof isUnsafeNetworkAddress, "function");

for (const address of [
  "0.0.0.0",
  "10.0.0.1",
  "127.0.0.1",
  "169.254.169.254",
  "172.16.0.1",
  "192.0.2.1",
  "192.168.1.1",
  "198.51.100.1",
  "203.0.113.1",
  "::",
  "::1",
  "fe80::1",
  "fd00::1",
  "::ffff:127.0.0.1",
  "0:0:0:0:0:ffff:7f00:1",
]) {
  assert.equal(isUnsafeNetworkAddress(address), true, `${address} must be blocked`);
}
assert.equal(isUnsafeNetworkAddress("8.8.8.8"), false);
assert.equal(isUnsafeNetworkAddress("2606:4700:4700::1111"), false);

const pngBuffer = Buffer.from(
  "89504e470d0a1a0a0000000d49484452",
  "hex"
);
let requestedUrl = "";
const downloaded = await fetchRoundSubmissionArtwork({
  image: "https://cdn.example/art.png",
  maxBytes: 1024,
  requestImage: async (url) => {
    requestedUrl = url.toString();
    return { buffer: pngBuffer, contentType: "image/png" };
  },
});
assert.equal(requestedUrl, "https://cdn.example/art.png");
assert.equal(downloaded.contentType, "image/png");
assert.equal(Buffer.compare(downloaded.buffer, pngBuffer), 0);

await assert.rejects(
  () =>
    fetchRoundSubmissionArtwork({
      image: "https://cdn.example/not-an-image.png",
      maxBytes: 1024,
      requestImage: async () => ({
        buffer: Buffer.from("<html>not an image</html>"),
        contentType: "image/png",
      }),
    }),
  /valid supported image/
);

await assert.rejects(
  () =>
    fetchRoundSubmissionArtwork({
      image: "https://cdn.example/missing.png",
      maxBytes: 1024,
      requestImage: async () => {
        throw new Error("Artwork request returned 404.");
      },
    }),
  /Artwork request returned 404/
);

console.log("ok - round submissions ZIP artwork export");
