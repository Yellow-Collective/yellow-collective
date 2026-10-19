import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
export const loadRoundMediaModule = (path, overrides = {}) => {
  const source = readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { require: (name) => Object.hasOwn(overrides, name) ? overrides[name] : require(name), module, exports: module.exports, Buffer, URL, process: { env: {} }, setTimeout, clearTimeout });
  return module.exports;
};
