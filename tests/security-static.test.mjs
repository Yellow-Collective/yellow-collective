import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path) => readFileSync(resolve(process.cwd(), path), "utf8");

const farcaster = read("utils/farcasterMiniApp.ts");
assert.equal(farcaster.includes("new Function"), false);
assert.equal(farcaster.includes("https://esm.sh"), false);
assert.equal(farcaster.includes("return import(url)"), false);
console.log("ok - Farcaster SDK uses no remote runtime import");

const siteConfig = read("utils/site.ts");
assert.match(siteConfig, /export const MINI_APP_EMBED[\s\S]*type: "launch_miniapp"/);
assert.match(siteConfig, /export const LEGACY_FRAME_EMBED[\s\S]*type: "launch_frame"/);
console.log("ok - Farcaster embed uses Mini App launch with legacy frame fallback");

const adminDashboard = read("pages/admin/dashboard.tsx");
assert.equal(adminDashboard.includes("URLSearchParams"), false);
assert.equal(adminDashboard.includes("adminSignature"), false);
assert.equal(adminDashboard.includes("adminMessage"), false);
console.log("ok - admin dashboard does not put signatures in URLs");

const adminApi = read("utils/admin-api.ts");
assert.equal(adminApi.includes("req.query.adminSignature"), false);
assert.equal(adminApi.includes("req.query.adminMessage"), false);
console.log("ok - admin API does not accept signed auth from query params");

const nextConfig = read("next.config.js");
assert.equal(nextConfig.includes('hostname: "**"'), false);
assert.equal(nextConfig.includes("Content-Security-Policy"), true);
assert.equal(nextConfig.includes("X-Content-Type-Options"), true);
assert.equal(nextConfig.includes("https://nouns.build"), true);
assert.equal(nextConfig.includes("https://chain-proxy.wallet.coinbase.com"), true);
assert.equal(nextConfig.includes('hostname: "nouns.build"'), true);
console.log("ok - global security headers and restricted image hosts are configured");
