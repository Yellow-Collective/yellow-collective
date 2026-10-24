import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import vm from "node:vm";
import { EventEmitter } from "node:events";
const require = createRequire(import.meta.url), ts = require("typescript");
const read = p => readFileSync(p, "utf8");
const load = (file, mocks = {}, globals = {}) => {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(read(file), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, { module, exports: module.exports, require: id => {
    if (id in mocks) return mocks[id];
    if (id.startsWith("@/") || id.startsWith("data/") || id.startsWith("constants/"))
      throw new Error(`Unexpected dependency ${id}`);
    return require(id);
  }, console: { error() {}, warn() {}, log() {} }, Buffer, URL, process,
    setTimeout, clearTimeout, ...globals });
  return module.exports;
};
const response = () => ({
  code: 200, headers: {}, payload: undefined,
  setHeader(k, v) { this.headers[k.toLowerCase()] = v; return this; },
  status(n) { this.code = n; return this; },
  json(v) { this.payload = v; return this; }, send(v) { this.payload = v; return this; }, end() {},
});
const marker = "PRIVATE-SQL-CREDENTIAL-MARKER";
const media = load("utils/rounds/roundMediaPayload.ts");
const submission = {
  id: "entry", walletAddress: "public-wallet", title: "Visible artwork", image: "https://example.com/art.gif", images: ["https://example.com/art.gif"],
  rejectedAt: marker, hiddenAt: marker, deletedAt: marker, approvedAt: marker, internalFutureField: marker,
  video: { objectKey: marker, bytes: 123, duration: 12, width: 640, height: 480, future: marker },
  sourcePayload: { pixels: ["#ffcc00"], previewTraits: { heads: "Visible head" }, roundSubmissionIdentityLabel: "Visible artist", privateField: marker },
};
const round = { id: "round", slug: "public", title: "Visible round", content: "Visible description", status: "published", active: true,
  submissionCount: 999, deletedAt: marker, privateField: marker, submissions: [submission],
  awards: [{ id: "award", title: "Visible award", value: "1 ETH", privateField: marker }],
  voteActivity: [{ id: "vote", walletAddress: "visible-voter", voteCount: 3, privateField: marker }],
};
const publicRound = media.stripRoundInlineMediaForSsr(round);
assert.equal(JSON.stringify(publicRound).includes(marker), false);
assert.equal(publicRound.submissions[0].title, "Visible artwork");
assert.equal(publicRound.submissions[0].images[0], submission.image);
assert.equal(publicRound.submissions[0].video.duration, 12);
assert.equal(publicRound.submissions[0].sourcePayload.pixels[0], "#ffcc00");
assert.equal(publicRound.voteActivity[0].walletAddress, "visible-voter");
assert.equal(publicRound.awards[0].value, "1 ETH");
assert.equal(round.submissions[0].video.objectKey, marker, "Domain records stay intact");
assert.equal("submissionCount" in publicRound, false, "Hidden submission counts stay private");
console.log("ok - public round and SSR presentation retains artwork, votes, awards and video while dropping private metadata");

const fail = async () => { throw new Error(marker); };
const profile = load("pages/api/profile/[address].ts", {
  "data/profile": { getProfileMetadata: fail, getFirstOwnedCollectiveNounImage: async () => "" }, viem: { isAddress: () => true, getAddress: x => x },
  "@/utils/profile/identity": {}, "@/utils/signature-auth-server": {},
}).default;
const failedProfile = response();
await profile({ method: "GET", query: { address: "wallet" } }, failedProfile);
assert.equal(failedProfile.code, 500);
assert.equal(JSON.stringify(failedProfile.payload).includes(marker), false);
const publicRead = load("utils/public-api-read.ts").publicApiRead;
for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"]) {
  const res = response(); await publicRead(fail)({ method }, res); assert.equal(res.code, 405);
}
const readError = response(); await publicRead(fail)({ method: "GET" }, readError);
assert.equal(readError.code, 500); assert.equal(JSON.stringify(readError.payload).includes(marker), false);
assert.match(readError.headers["cache-control"], /private, no-store/);
console.log("ok - internal exceptions stay out of public responses and legacy reads reject alternate methods");

// Exercise every admin route with denial at its actual handler boundary. Any
// data-service call before authorization fails the test. Cryptographic helper
// behavior is covered by signature-auth/admin-session/admin-permissions tests.
const files = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(`${dir}/${e.name}`) : [`${dir}/${e.name}`]);
let protectedCount = 0;
const deny = async (_req, res) => { res.setHeader("Cache-Control", "private, no-store"); res.status(401).json({ error: "Authentication required." }); };
const unexpectedData = new Proxy({}, { get(_target, key) { if (key === "__esModule") return false; return () => { throw new Error(`Private data accessed before authentication: ${String(key)}`); }; } });
const loadAdmin = file => {
  const mocks = {};
  for (const match of read(file).matchAll(/from\s+["']([^"']+)["']/g)) {
    const id = match[1];
    if (id === "next") continue;
    mocks[id] = unexpectedData;
    if (id === "@/utils/admin-api") mocks[id] = { requireAdminRequest: deny };
    if (id === "@/utils/signature-auth-server") mocks[id] = { setNoStoreHeaders: res => res.setHeader("Cache-Control", "private, no-store"), verifySignedRequest: deny };
    if (id === "@/utils/admin-session") mocks[id] = { getAdminSessionAddress: () => undefined };
    if (id === "@/utils/notifications/auth") mocks[id] = { hasNotificationCronAuth: () => false };
    if (id.startsWith("pages/api/")) mocks[id] = { __esModule: true, default: loadAdmin(`${id}.ts`) };
    if (id === "@/utils/admin-auth") mocks[id] = { getAdminSessionSignedRequestAction: () => "admin:session" };
  }
  return load(file, mocks).default;
};
for (const file of files("pages/api/admin").filter(p => p.endsWith(".ts"))) {
  const handler = loadAdmin(file), source = read(file);
  const method = file.endsWith("/test.ts") ? "POST" : source.includes('"GET"') ? "GET" : source.includes('"PATCH"') ? "PATCH" : "POST";
  const res = response();
  await handler({ method, headers: {}, query: { id: "round", submissionId: "entry", voteId: "vote", address: "wallet" }, body: {} }, res);
  assert.equal(res.code, 401, `${file} must deny anonymous access before data loading`);
  protectedCount++;
}
console.log(`ok - all ${protectedCount} admin handlers reject anonymous access before loading data`);

let verifiedFid = 42;
const miniAuth = load("utils/miniapp-auth.ts", { "@farcaster/quick-auth": { createClient: () => ({ verifyJwt: async ({ token, domain }) => {
  assert.equal(domain, "yellowcollective.art");
  if (token !== "valid") throw new Error(marker);
  return { sub: verifiedFid };
} }) } }, { process: { env: {} } });
for (const authorization of [undefined, "Bearer bad", "Basic valid"]) {
  const res = response(); const fid = await miniAuth.requireMiniAppFid({ headers: { authorization } }, res);
  assert.equal(fid, undefined); assert.equal(res.code, 401); assert.equal(JSON.stringify(res.payload).includes(marker), false);
}
let saves = 0;
const miniHandler = load("pages/api/miniapp/users.ts", {
  "@/utils/miniapp-auth": miniAuth,
  "data/notifications": { upsertMiniAppUser: async ({ fid }) => { saves++; return { fid }; } },
}).default;
const req = { method: "POST", headers: { authorization: "Bearer valid", host: "attacker.example" }, body: { fid: 43 } };
const mismatch = response(); await miniHandler(req, mismatch); assert.equal(mismatch.code, 403); assert.equal(saves, 0);
const valid = response(); await miniHandler({ ...req, body: { fid: 42 } }, valid); assert.equal(valid.code, 200); assert.equal(saves, 1);
console.log("ok - Mini App updates require verified audience and matching FID; spoofed identity cannot write");

let providerCalls = 0;
for (const file of ["upload.ts", "upload-url.ts"]) {
  const handler = load(`pages/api/pinata/${file}`, {
    "@/utils/ipfs-upload-config": { pinataOptions: { media: { max_file_size: 100 } } },
    "@/utils/rate-limit": { applyRateLimit: () => true },
    "@/utils/signature-auth-server": { verifySignedRequest: deny, setNoStoreHeaders() {} },
  }, { fetch: async () => { providerCalls++; throw new Error(marker); } }).default;
  const res = response(); await handler({ method: "POST", headers: { "content-type": "multipart/form-data; boundary=test" }, query: { type: "media" }, body: { type: "media" } }, res);
  assert.equal(res.code, 401);
}
assert.equal(providerCalls, 0);
console.log("ok - anonymous IPFS uploads cannot obtain capabilities or call the provider");

// Raw service state must never be served anonymously, even when unconfigured.
let listener;
const stateSource = { proposals: { secret: marker }, notifications: { token: marker } };
const serviceEnv = { env: {} };
const server = load("services/metagov/src/server/http-server.ts", {
  http: { createServer: fn => { listener = fn; return { listen(_port, cb) { cb(); } }; } },
  "../config": { config: { port: 3000 } },
}, { process: serviceEnv });
server.startHttpServer({ path: marker, load: () => stateSource });
const callService = (url, authorization) => {
  const res = { setHeader() {}, writeHead(code) { this.code = code; }, end(body) { this.payload = JSON.parse(body); } };
  listener({ url, method: "GET", headers: { host: "localhost", authorization } }, res); return res;
};
assert.deepEqual(JSON.parse(JSON.stringify(callService("/health").payload)), { ok: true });
for (const path of ["/state", "/state-file", "/state/1"]) assert.equal(callService(path).code, 401);
serviceEnv.env.METAGOV_STATE_SECRET = "fixture-service-secret";
assert.equal(callService("/state", "Bearer incorrect").code, 401);
assert.equal(callService("/state", "Bearer fixture-service-secret").code, 200);
console.log("ok - service health is minimal; raw state requires the configured service secret");

const stateData = load("data/metagov.ts", { fs: { existsSync: () => false }, path: require("node:path") }, {
  process: { env: { METAGOV_STATE_URL: "https://state.example/state" } },
  fetch: async () => ({ ok: true, status: 200, json: async () => ({ updatedAt: "now", proposals: { 1: {
    nounsProposalId: "1", status: "failed", snapshotTitle: "Visible proposal", failureReason: marker, futureSecret: marker,
  } }, executedVotes: [] }) }),
});
const status = await stateData.getMetagovProposalStatus(1);
assert.equal(JSON.stringify(status).includes(marker), false); assert.equal(status.proposal.snapshotTitle, "Visible proposal");
console.log("ok - public metagov status preserves display fields without raw failures or future private fields");

for (const [file, dataMethod, query] of [
  ["pages/api/rounds/index.ts", "listPublicRounds", {}],
  ["pages/api/rounds/eligible-trait-rounds.ts", "listEligibleTraitRounds", { wallet: "wallet", traitId: "trait" }],
]) {
  const handler = load(file, {
    "data/rounds": { [dataMethod]: async () => [round] },
    "@/utils/rounds/roundMediaPayload": media,
  }).default;
  const res = response(); await handler({ method: "GET", query }, res);
  assert.equal(res.code, 200); assert.equal(JSON.stringify(res.payload).includes(marker), false);
  assert.equal("submissionCount" in res.payload.rounds[0], false);
}
console.log("ok - both public round-list entrypoints apply the presentation allowlist");

const networkPolicy = load("utils/rounds/submission-export-server.ts", {
  "@/utils/site": { SITE_URL: "https://yellowcollective.art" }, "@/utils/url-safety": {},
});
let remote = { status: 200, headers: {}, text: "Visible update" }, requests = 0;
const safeText = load("utils/public-text-fetch.ts", {
  "node:dns/promises": { lookup: async host => [{ address: host === "internal.test" ? "127.0.0.1" : "8.8.8.8", family: 4 }] },
  "./rounds/submission-export-server": networkPolicy,
  "node:https": { get(url, options, callback) {
    requests++;
    options.lookup(url.hostname, { all: false }, (error, address) => { assert.equal(error, null); assert.equal(address, "8.8.8.8"); });
    options.lookup(url.hostname, { all: true }, (error, addresses) => { assert.equal(error, null); assert.equal(addresses[0].address, "8.8.8.8"); });
    const req = new EventEmitter();
    req.destroy = error => { req.emit("error", error); req.emit("close"); };
    setTimeout(() => {
      const res = new EventEmitter(); res.statusCode = remote.status; res.headers = remote.headers;
      res.resume = () => req.emit("close");
      res.destroy = error => { res.emit("error", error); req.emit("close"); };
      callback(res);
      if (remote.status === 200) {
        res.emit("data", Buffer.from(remote.text)); res.emit("end"); req.emit("close");
      }
    }, 0);
    return req;
  } },
}).fetchPublicText;
await assert.rejects(safeText("https://internal.test/update")); assert.equal(requests, 0);
await assert.rejects(safeText("http://public.test/update")); assert.equal(requests, 0);
assert.equal(await safeText("https://public.test/update"), "Visible update");
remote = { status: 302, headers: { location: "https://internal.test/update" } };
await assert.rejects(safeText("https://public.test/update"));
remote = { status: 302, headers: { location: "https://[invalid" } };
await assert.rejects(safeText("https://public.test/update"), /Invalid public text redirect/);
remote = { status: 200, headers: {}, text: "a".repeat(256 * 1024 + 1) };
await assert.rejects(safeText("https://public.test/update"), /exceeds limit/);
console.log("ok - public text DNS is pinned; internal hosts, unsafe redirects and oversized responses are denied");

const inventory = read("output/security/api-privacy-2026-10-21/endpoint-inventory.md");
for (const file of files("pages/api")) assert.ok(inventory.includes(file), `Document access policy for ${file}`);
console.log("ok - every API endpoint file has an explicit inventory entry");
