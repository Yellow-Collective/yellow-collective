import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const loadTsModule = (filePath) => {
  if (!existsSync(filePath)) return {};

  const source = readFileSync(filePath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  });
  const module = { exports: {} };

  vm.runInNewContext(transpiled.outputText, {
    require,
    module,
    exports: module.exports,
    console,
  });

  return module.exports;
};

const ens = loadTsModule(resolve(process.cwd(), "utils/ens.ts"));

const tests = [];
const test = (name, run) => tests.push({ name, run });

test("normalizes valid ENS names across TLDs", () => {
  assert.equal(ens.normalizeEnsNameInput(" YellowCollective.eth "), "yellowcollective.eth");
  assert.equal(ens.normalizeEnsNameInput("creator.box"), "creator.box");
  assert.equal(ens.normalizeEnsNameInput("artist.base.eth"), "artist.base.eth");
});

test("rejects invalid ENS-like profile identifiers", () => {
  assert.equal(ens.normalizeEnsNameInput("not-a-wallet"), undefined);
  assert.equal(ens.normalizeEnsNameInput("https://yellowcollective.eth"), undefined);
  assert.equal(ens.normalizeEnsNameInput("0x000000000000000000000000000000000000dEaD"), undefined);
});

test("profile route no longer gates ENS resolution to .eth names only", () => {
  const profileRoute = readFileSync(
    resolve(process.cwd(), "pages/profile/[addressOrEns].tsx"),
    "utf8"
  );

  assert.equal(profileRoute.includes('endsWith(".eth")'), false);
  assert.match(profileRoute, /normalizeEnsNameInput\(lookup\)/);
});

test("mainnet ENS fallback RPCs exclude providers that fail universal resolver gateways", () => {
  const walletConfig = readFileSync(resolve(process.cwd(), "configs/wallet.ts"), "utf8");

  assert.equal(walletConfig.includes("https://cloudflare-eth.com"), false);
  assert.match(walletConfig, /ENS_MAINNET_RPC_URLS/);
});

let failures = 0;

for (const { name, run } of tests) {
  try {
    run();
    console.log(`ok - ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`not ok - ${name}`);
    console.error(error);
  }
}

if (failures > 0) {
  process.exitCode = 1;
}
