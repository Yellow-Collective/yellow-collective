import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const fixture = { address: "0x123", displayName: "Member", tokenCount: 2,
  votingPower: null, noundrySubmissionCount: 0, proposalVoteCount: null };

function loadPage({ load, phase, swr } = {}) {
  const source = readFileSync("pages/members.tsx", "utf8");
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  }}).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module, exports: module.exports, setTimeout, clearTimeout,
    process: { env: { NEXT_PHASE: phase } }, console: { warn() {} },
    require(id) {
      if (id === "data/members") return { getDaoMembers: load };
      if (id === "swr") return { __esModule: true, default: swr };
      if (id === "@/utils/profile/identity") return { getProfilePath: () => "/profile" };
      if (["@/components/Layout", "next/head", "next/link"].includes(id)) {
        return { __esModule: true, default: ({ children }) => React.createElement("div", null, children) };
      }
      return require(id);
    },
  });
  return module.exports;
}

const failure = new Error("Holder source offline");
await assert.rejects(loadPage({ load: async () => { throw failure; } }).getStaticProps(),
  (error) => error === failure, "ISR must reject so Next preserves the last successful page");
const success = await loadPage({ load: async () => [fixture] }).getStaticProps();
assert.equal(success.props.members[0], fixture);
assert.ok(Date.parse(success.props.updatedAt));
let requested = false;
const build = await loadPage({ phase: "phase-production-build", load: async () => { requested = true; } }).getStaticProps();
assert.equal(requested, false);
assert.equal(build.props.members.length, 0);

let refreshOptions;
const page = loadPage({ swr: (_key, _fetcher, options) => {
  refreshOptions = options;
  return { data: options.fallbackData, error: failure, isValidating: false, mutate() {} };
}});
const html = renderToStaticMarkup(React.createElement(page.default, {
  members: [fixture], updatedAt: "2026-10-17T14:00:00Z",
}));
assert.match(html, /Member/);
assert.match(html, /Showing the last loaded members/);
assert.match(html, /Currently unavailable/);
assert.equal(refreshOptions.refreshInterval, 60_000);
assert.equal(refreshOptions.revalidateOnMount, true);
assert.equal(refreshOptions.revalidateOnFocus, true);
const apiCode = ts.transpileModule(readFileSync("pages/api/members.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
let apiFailure = false;
const apiModule = { exports: {} };
vm.runInNewContext(apiCode, {
  module: apiModule, exports: apiModule.exports, console: { error() {} },
  require: () => ({ getDaoMembers: async () => {
    if (apiFailure) throw failure;
    return [fixture];
  }}),
});
const response = { headers: {}, setHeader(k, v) { this.headers[k] = v; },
  status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
await apiModule.exports.default({ method: "GET" }, response);
assert.equal(response.statusCode, 200);
assert.equal(response.body.members[0].proposalVoteCount, null);
assert.ok(Date.parse(response.body.updatedAt));
assert.equal(response.headers["Cache-Control"], "no-store");
apiFailure = true;
await apiModule.exports.default({ method: "GET" }, response);
assert.equal(response.statusCode, 500, "Client must receive an error instead of an empty successful replacement");
assert.equal(response.body.members, undefined);
await apiModule.exports.default({ method: "POST" }, response);
assert.equal(response.statusCode, 405);
console.log("ok - ISR failure preservation, deferred build, refresh UI, unavailable stats");
