import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { EventEmitter } from "node:events";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const modules = [
  ["data/rounds.ts", "getPool", "ensureTables"],
  ["data/site-settings.ts", "getPool", "ensureTable"],
  ["data/coins.ts", "getPool", "ensureTable"],
  ["data/profile.ts", "getPool", "ensureTable"],
  ["data/notifications.ts", "getPool", "ensureTables"],
  ["data/noundry/submissions.ts", "getPool", "ensureTable"],
  ["data/community-project-submissions.ts", "getPool", "ensureTable"],
  ["utils/signature-auth-server.ts", "getPool", "ensureNonceTable"],
  ["data/nouns-dao/indexer.ts", "getNounsDaoIndexerPool", null],
];
for (const [path, getter, initializer] of modules) {
  let attachments = 0, queries = 0, creations = 0;
  const overload = Object.assign(new Error("synthetic connection exhaustion"), { code: "53300" });
  class FakePool {
    constructor(options) { this.options = options; creations++; }
    async query() { if (++queries === 1) throw overload; return { rows: [] }; }
  }
  const source = readFileSync(path, "utf8") +
    `\nexport { ${getter} as testPool${initializer ? `, ${initializer} as testInitialize` : ""} };`;
  const module = { exports: {} };
  const fallback = new Proxy({}, { get: () => () => undefined });
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, {
    module, exports: module.exports,
    require(name) {
      if (name === "pg") return { Pool: FakePool };
      if (name === "@vercel/functions") return { attachDatabasePool(pool) {
        assert.ok(pool instanceof FakePool); attachments++;
      } };
      if (name === "crypto" || name === "viem") return require(name);
      return fallback;
    },
    process: { env: { DATABASE_URL: "postgresql://fixture.invalid/db", VERCEL: "1" } },
    console,
  });
  const data = module.exports;
  assert.equal(data.testPool(), data.testPool());
  assert.equal(creations, 1);
  assert.equal(attachments, 1, `${path} registers each pool once`);
  assert.equal(data.testPool().options.idleTimeoutMillis, 5000);
  assert.equal(data.testPool().options.max, 2);
  if (initializer) {
    const failures = await Promise.allSettled([data.testInitialize(), data.testInitialize()]);
    assert.equal(queries, 1, "concurrent callers share initialization");
    for (const result of failures) assert.equal(result.reason, overload);
    await assert.doesNotReject(() => data.testInitialize());
    const successfulQueries = queries;
    await data.testInitialize();
    assert.equal(queries, successfulQueries, "successful initialization stays cached");
    assert.equal(attachments, 1);
  }
  console.log(`ok - ${path}: lifecycle attachment, bounded pool and initialization recovery`);
}

// Exercise the installed official helper against a synthetic pg-shaped pool.
const contextKey = Symbol.for("@vercel/request-context");
const oldContext = globalThis[contextKey];
const oldUrl = process.env.VERCEL_URL;
const oldRegion = process.env.VERCEL_REGION;
try {
  const waits = [];
  globalThis[contextKey] = { get: () => ({ waitUntil: (promise) => waits.push(promise) }) };
  process.env.VERCEL_URL = "fixture.invalid";
  process.env.VERCEL_REGION = "synthetic";
  const pool = new EventEmitter();
  pool.options = { idleTimeoutMillis: 1 };
  require("@vercel/functions").attachDatabasePool(pool);
  pool.emit("release");
  assert.equal(waits.length, 1, "idle cleanup keeps request context alive");
  await waits[0];
  console.log("ok - official helper extends request lifetime for the pool idle timeout");
} finally {
  if (oldContext === undefined) delete globalThis[contextKey]; else globalThis[contextKey] = oldContext;
  if (oldUrl === undefined) delete process.env.VERCEL_URL; else process.env.VERCEL_URL = oldUrl;
  if (oldRegion === undefined) delete process.env.VERCEL_REGION; else process.env.VERCEL_REGION = oldRegion;
}
