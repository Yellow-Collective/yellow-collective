import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const moduleCache = new Map();

const resolveTsPath = (specifier, parentFile) => {
  if (specifier.startsWith("@/")) {
    return resolve(process.cwd(), `${specifier.slice(2)}.ts`);
  }
  if (specifier.startsWith("constants/")) {
    return resolve(process.cwd(), `${specifier}.ts`);
  }
  if (specifier.startsWith(".")) {
    return resolve(dirname(parentFile), `${specifier}.ts`);
  }
  return null;
};

const loadTsModule = (filePath) => {
  if (moduleCache.has(filePath)) return moduleCache.get(filePath).exports;

  const source = readFileSync(filePath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  });
  const module = { exports: {} };
  moduleCache.set(filePath, module);

  const localRequire = (specifier) => {
    const tsPath = resolveTsPath(specifier, filePath);
    return tsPath ? loadTsModule(tsPath) : require(specifier);
  };

  vm.runInNewContext(transpiled.outputText, {
    require: localRequire,
    module,
    exports: module.exports,
    console,
    process,
    Buffer,
    Date,
  });

  return module.exports;
};

process.env.ADMIN_SESSION_SECRET = "test-admin-session-secret";

const adminSession = loadTsModule(
  resolve(process.cwd(), "utils/admin-session.ts")
);
const adminAddress = "0xdcf37d8Aa17142f053AAA7dc56025aB00D897a19";

const token = adminSession.createAdminSessionToken(adminAddress);
assert.equal(adminSession.verifyAdminSessionToken(token), adminAddress);
console.log("ok - admin session token verifies");

assert.equal(
  adminSession.verifyAdminSessionToken(
    `${token.slice(0, -1)}${token.endsWith("0") ? "1" : "0"}`
  ),
  undefined
);
console.log("ok - tampered admin session token fails");

const expiredToken = adminSession.createAdminSessionToken(adminAddress, {
  issuedAt: new Date(Date.now() - 10 * 60 * 1000),
  expirationTime: new Date(Date.now() - 5 * 60 * 1000),
});
assert.equal(adminSession.verifyAdminSessionToken(expiredToken), undefined);
console.log("ok - expired admin session token fails");
