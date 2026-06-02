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

const permissions = loadTsModule(
  resolve(process.cwd(), "utils/admin-permissions.ts")
);

const globalAdmin = "0xdcf37d8Aa17142f053AAA7dc56025aB00D897a19";
const scopedAdmin = "0x70abdCd7A5A8Ff9cDef1ccA9eA15a5d315780986";

assert.equal(
  permissions.normalizeAdminWalletAddress(globalAdmin.toUpperCase()),
  globalAdmin
);
assert.equal(permissions.normalizeAdminWalletAddress("not-a-wallet"), null);
console.log("ok - admin wallet normalization validates addresses");

assert.equal(permissions.isGlobalAdminAddress(globalAdmin.toLowerCase()), true);
assert.equal(permissions.isGlobalAdminAddress(scopedAdmin), false);
console.log("ok - global admin detection is normalized");

assert.equal(
  permissions.hasAdminPermission({ walletAddress: globalAdmin, admins: [] }, "rounds"),
  true
);
assert.equal(
  permissions.getAdminPermissions({ walletAddress: globalAdmin, admins: [] }).length,
  permissions.ADMIN_PERMISSION_DEFINITIONS.length
);
console.log("ok - global admin always has full access");

const accessState = {
  admins: [
    {
      walletAddress: scopedAdmin.toLowerCase(),
      permissions: ["rounds", "gallery"],
    },
  ],
};

assert.equal(
  permissions.hasAdminPermission(
    { walletAddress: scopedAdmin, admins: accessState.admins },
    "rounds"
  ),
  true
);
assert.equal(
  permissions.hasAdminPermission(
    { walletAddress: scopedAdmin, admins: accessState.admins },
    "noundry"
  ),
  false
);
assert.equal(
  JSON.stringify(
    permissions.getAdminPermissions({
      walletAddress: scopedAdmin,
      admins: accessState.admins,
    })
  ),
  JSON.stringify(["gallery", "rounds"])
);
console.log("ok - scoped admin permissions allow and deny by section");

assert.equal(
  JSON.stringify(
    permissions.sanitizeAdminAccessRecords([
      {
        walletAddress: globalAdmin,
        permissions: ["rounds"],
      },
      {
        walletAddress: scopedAdmin.toLowerCase(),
        permissions: ["rounds", "unknown", "rounds"],
      },
      {
        walletAddress: "bad-wallet",
        permissions: ["gallery"],
      },
    ])
  ),
  JSON.stringify([
    {
      walletAddress: scopedAdmin,
      permissions: ["rounds"],
    },
  ])
);
console.log("ok - admin access records sanitize add/remove/toggle payloads");
