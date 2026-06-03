import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("wallet config does not register the Farcaster Mini App connector globally", () => {
  const walletConfig = read("configs/wallet.ts");
  const appConfig = read("pages/_app.tsx");

  assert.equal(walletConfig.includes("FarcasterMiniAppConnector"), false);
  assert.equal(walletConfig.includes("farcaster-mini-app-connector"), false);
  assert.equal(appConfig.includes("MiniAppWalletAutoConnect"), false);
});

test("CSP allows the imported Google font stylesheet and font files", () => {
  const nextConfig = read("next.config.js");

  assert.match(nextConfig, /style-src[\s\S]*https:\/\/fonts\.googleapis\.com/);
  assert.match(nextConfig, /font-src[\s\S]*https:\/\/fonts\.gstatic\.com/);
});
