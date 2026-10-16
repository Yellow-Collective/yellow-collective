import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import test from "node:test";
const require = createRequire(import.meta.url);
const ts = require("typescript");
const walletAddress = "0x1111111111111111111111111111111111111111";
function harness({ fetchHang = false, sign = async () => "signature" } = {}) {
  const timers = new Map();
  let nextTimer = 0;
  let signCalls = 0;
  const module = { exports: {} };
  const shared = {
    normalizeSignedRequestMethod: (v) => v,
    normalizeSignedRequestWallet: (v) => v,
    normalizeSignedRequestPath: (v) => v,
    createRequestPayloadHash: () => "hash",
    buildSignedRequestMessage: () => "message",
    createSignedRequestAuthorizationHeader: (v) => v,
  };
  vm.runInNewContext(
    ts.transpileModule(readFileSync("utils/signature-auth-client.ts", "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
      },
    }).outputText,
    {
      module,
      exports: module.exports,
      require: () => shared,
      AbortController,
      setTimeout: (fn, ms) => {
        const id = ++nextTimer;
        timers.set(id, { fn, ms });
        return id;
      },
      clearTimeout: (id) => timers.delete(id),
      fetch: async (_path, options) =>
        fetchHang
          ? new Promise(() => {})
          : {
              ok: true,
              json: async () => ({
                challenge: { ...JSON.parse(options.body), nonce: "nonce" },
                message: "message",
              }),
            },
    }
  );
  const run = () =>
    module.exports.createSignedRequestAuthHeader({
      walletAddress,
      chainId: 8453,
      bounded: true,
      action: "round:submission-read",
      method: "GET",
      path: "/api/rounds/test/my-submissions",
      signMessageAsync: async (args) => {
        signCalls++;
        return sign(args);
      },
    });
  const flush = async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve();
  };
  return { run, timers, flush, signCalls: () => signCalls };
}
test("stalled nonce request exits with recovery guidance before signing", async () => {
  const h = harness({ fetchHang: true });
  const request = h.run();
  await h.flush();
  assert.ok(h.timers.size, "nonce fetch must have a bounded deadline");
  const rejected = assert.rejects(request, /timed out.*try again/i);
  [...h.timers.values()][0].fn();
  await rejected;
  assert.equal(h.signCalls(), 0);
});
test("stalled wallet signing exits and ignores late success without retrying", async () => {
  let finish;
  const h = harness({
    sign: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  const request = h.run();
  await h.flush();
  assert.ok(h.timers.size, "wallet signing must have a bounded deadline");
  const rejected = assert.rejects(request, /wallet.*timed out/i);
  [...h.timers.values()][0].fn();
  await rejected;
  finish("late signature");
  await h.flush();
  assert.equal(h.signCalls(), 1);
});
test("missing connector explains how to reconnect", async () => {
  const h = harness({
    sign: async () => {
      const error = new Error("Connector not found");
      error.name = "ConnectorNotFoundError";
      throw error;
    },
  });
  await assert.rejects(h.run(), /reconnect.*wallet/i);
});
test("successful signing clears deadlines and returns authorization", async () => {
  const h = harness();
  assert.equal((await h.run()).signature, "signature");
  assert.equal(h.timers.size, 0);
});
