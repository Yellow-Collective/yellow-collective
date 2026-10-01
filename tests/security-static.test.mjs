import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const { getPathMatch } = require("next/dist/shared/lib/router/utils/path-match");

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

const preservedAncestors = [
  "'self'",
  "https://farcaster.xyz",
  "https://*.farcaster.xyz",
  "https://warpcast.com",
  "https://*.warpcast.com",
];
const portfolioAncestors = ["https://satori.wtf", "https://www.satori.wtf"];
const developmentAncestors = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3002",
  "http://127.0.0.1:3002",
];

async function loadHeaderRules(nodeEnv) {
  const previousNodeEnv = process.env.NODE_ENV;
  const configPath = require.resolve("../next.config.js");
  try {
    process.env.NODE_ENV = nodeEnv;
    delete require.cache[configPath];
    return await require(configPath).headers();
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    delete require.cache[configPath];
  }
}

function effectiveHeaders(rules, pathname) {
  const headers = new Map();
  for (const rule of rules) {
    if (!getPathMatch(rule.source)(pathname)) continue;
    for (const header of rule.headers) {
      // Next's last matching header with the same key replaces earlier values.
      headers.set(header.key.toLowerCase(), header.value);
    }
  }
  return headers;
}

function framingAncestors(headers) {
  const csp = headers.get("content-security-policy");
  assert.ok(csp, "Every route must retain a CSP.");
  const directives = csp.split("; ");
  const framing = directives.filter((value) => value.startsWith("frame-ancestors "));
  assert.equal(framing.length, 1, "Only one effective frame-ancestors directive.");
  assert.equal(headers.has("x-frame-options"), false);
  return framing[0].split(" ").slice(1);
}

const publicPaths = [
  "/", "/about", "/art", "/community", "/community/project", "/community/submit",
  "/contracts", "/dashboard", "/gallery", "/members", "/noundry", "/noundry/submit",
  "/noundry/traits/1", "/noundry/artists/artist", "/playground", "/probe",
  "/projects", "/projects/project", "/projects/submit", "/profile/0x123",
  "/proposals", "/proposals/1", "/proposals/nouns", "/proposals/nouns/1",
  "/rounds", "/rounds/example", "/rounds/example/submit", "/rounds/request",
  "/treasury", "/vote", "/vote/1", "/coins", "/coins/create", "/coins/0x123",
  "/create-proposal", "/token/1", "/public-slug",
];
const protectedPaths = [
  "/admin", "/admin/", "/admin/dashboard", "/admin/future/nested", "/ADMIN/dashboard",
  "/api", "/api/admin/session", "/api/admin/access", "/api/admin/rounds/1",
  "/api/auth/nonce", "/_next/data/build/admin/dashboard.json",
];

for (const nodeEnv of ["production", "development", "test"]) {
  const rules = await loadHeaderRules(nodeEnv);
  const expectedPublicAncestors = [
    ...preservedAncestors,
    ...portfolioAncestors,
    ...(nodeEnv === "development" ? developmentAncestors : []),
  ];
  for (const pathname of publicPaths) {
    const headers = effectiveHeaders(rules, pathname);
    assert.deepEqual(framingAncestors(headers), expectedPublicAncestors, `${nodeEnv} ${pathname}`);
    assert.equal(headers.get("x-content-type-options"), "nosniff");
    assert.equal(headers.get("referrer-policy"), "strict-origin-when-cross-origin");
    assert.equal(headers.get("cross-origin-opener-policy"), "same-origin-allow-popups");
    assert.equal(headers.get("permissions-policy"), "camera=(), microphone=(), geolocation=(), usb=(), payment=(), bluetooth=(), accelerometer=(), gyroscope=()");
    const withoutFraming = (csp) => csp.split("; ").filter((directive) => !directive.startsWith("frame-ancestors "));
    assert.deepEqual(
      withoutFraming(headers.get("content-security-policy")),
      withoutFraming(effectiveHeaders(rules, "/admin/dashboard").get("content-security-policy")),
      "The public override must preserve every other CSP directive."
    );
  }
  for (const pathname of protectedPaths) {
    assert.deepEqual(framingAncestors(effectiveHeaders(rules, pathname)), preservedAncestors, `${nodeEnv} ${pathname}`);
  }
  console.log(`ok - ${nodeEnv} effective framing permits only approved public ancestors and preserves administrative protection`);
}

const vercelConfig = JSON.parse(read("vercel.json"));
assert.equal(vercelConfig.headers, undefined, "Vercel must not add a conflicting CSP.");
console.log("ok - Vercel config adds no competing framing headers");

const header = read("components/Header.tsx");
assert.match(header, /const HeaderNavigationLink[\s\S]*href === "\/admin" \|\| href\.startsWith\("\/admin\/"\)[\s\S]*<a href=\{href\}/);
assert.match(header, /<Link href=\{href\}/, "Public navigation retains Next client routing.");
assert.equal((header.match(/<Link\b/g) || []).length, 1, "Navigation must go through the administrative document-navigation guard.");
console.log("ok - desktop and mobile administrative links trigger document navigation for CSP enforcement");

for (const pathname of ["pages/community.tsx", "pages/community/[slug].tsx", "pages/noundry.tsx"]) {
  assert.match(read(pathname), /<a\s+href=\{`\/admin\/dashboard\?/, `${pathname}: administrative edit entry must load its restricted document.`);
}
console.log("ok - public community and Noundry administrative edit links trigger document navigation");

const ts = require("typescript");
const adminControlsSource = read("hooks/useAdminControlsAllowed.ts");
const adminControlsJs = ts.transpileModule(adminControlsSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const publicEmbedJs = ts.transpileModule(read("hooks/usePublicEmbed.ts"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

function loadAdminControls(windowValue, detectMiniApp) {
  const module = { exports: {} };
  const publicEmbedModule = { exports: {} };
  const state = { value: undefined, effect: undefined };
  const context = {
    window: windowValue,
    require: (id) => {
      if (id === "@/hooks/usePublicEmbed") return publicEmbedModule.exports;
      if (id === "@/utils/farcasterMiniApp") return { isInMiniApp: detectMiniApp };
      if (id === "react") return {
        useState: (initial) => {
          state.value = initial;
          return [initial, (value) => { state.value = value; }];
        },
        useEffect: (effect) => { state.effect = effect; },
      };
      throw new Error(`Unexpected hook dependency: ${id}`);
    },
  };
  vm.runInNewContext(publicEmbedJs, {
    ...context, module: publicEmbedModule, exports: publicEmbedModule.exports,
  });
  vm.runInNewContext(adminControlsJs, {
    ...context, module, exports: module.exports,
  });
  return { ...module.exports, ...publicEmbedModule.exports, state };
}

const standaloneWindow = { location: { origin: "https://yellowcollective.art" } };
standaloneWindow.self = standaloneWindow;
standaloneWindow.top = standaloneWindow;
standaloneWindow.parent = standaloneWindow;
const sameOriginWindow = {
  self: {}, top: {}, location: standaloneWindow.location,
  parent: { location: standaloneWindow.location },
};
const crossOriginParent = {};
Object.defineProperty(crossOriginParent, "location", {
  get: () => { throw new Error("Cross-origin parent access denied"); },
});
const ordinaryFrameWindow = { ...sameOriginWindow, parent: crossOriginParent };
const sdkMustNotRun = () => { throw new Error("SDK must not run for standalone/self frames"); };
assert.equal(await loadAdminControls(undefined, sdkMustNotRun).detectAdminControlsAllowed(), false);
assert.equal(await loadAdminControls(standaloneWindow, sdkMustNotRun).detectAdminControlsAllowed(), true);
assert.equal(await loadAdminControls(sameOriginWindow, sdkMustNotRun).detectAdminControlsAllowed(), true);
assert.equal(await loadAdminControls(ordinaryFrameWindow, async () => false).detectAdminControlsAllowed(), false);
assert.equal(await loadAdminControls(ordinaryFrameWindow, async () => true).detectAdminControlsAllowed(), true);
assert.equal(await loadAdminControls(ordinaryFrameWindow, async () => { throw new Error("SDK unavailable"); }).detectAdminControlsAllowed(), false);

let resolveDetection;
const pendingDetection = new Promise((resolve) => { resolveDetection = resolve; });
const pendingHook = loadAdminControls(ordinaryFrameWindow, () => pendingDetection);
assert.equal(pendingHook.useAdminControlsAllowed(), false, "Administrative controls default deny while detection is pending.");
const cleanup = pendingHook.state.effect();
cleanup();
resolveDetection(true);
await Promise.resolve();
await Promise.resolve();
assert.equal(pendingHook.state.value, false, "Unmounted detection must not enable controls.");
assert.match(read("pages/coins/[address].tsx"), /const isAdmin = adminControlsAllowed && isAdminAddress\(address\)/);
console.log("ok - inline administration denies ordinary frames and preserves standalone, self frames, and SDK-confirmed Mini Apps");
assert.equal(await loadAdminControls(undefined, sdkMustNotRun).detectPublicEmbed(), false);
assert.equal(await loadAdminControls(standaloneWindow, sdkMustNotRun).detectPublicEmbed(), false);
assert.equal(await loadAdminControls(sameOriginWindow, sdkMustNotRun).detectPublicEmbed(), false);
assert.equal(await loadAdminControls(ordinaryFrameWindow, async () => false).detectPublicEmbed(), true);
assert.equal(await loadAdminControls(ordinaryFrameWindow, async () => true).detectPublicEmbed(), false);
assert.equal(await loadAdminControls(ordinaryFrameWindow, async () => { throw new Error("SDK unavailable"); }).detectPublicEmbed(), true);
assert.match(header, /const isPublicEmbed = usePublicEmbed\(\)/);
assert.match(header, /isPublicEmbed && \([\s\S]*<a\s+href=\{router\.asPath\}\s+target="_blank"\s+rel="noopener noreferrer"/);
assert.match(header, /link&apos;s context menu/);
console.log("ok - ordinary public frames receive a current-page browser fallback without treating them as Mini Apps");

const contractsModule = { exports: {} };
const contractStates = [];
let contractStateIndex = 0;
let clipboardFailure = true;
let copiedValue;
let copyErrorLogs = 0;
const contractsJs = ts.transpileModule(read("pages/contracts.tsx"), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  },
}).outputText;
vm.runInNewContext(contractsJs, {
  module: contractsModule,
  exports: contractsModule.exports,
  console: { ...console, error: () => { copyErrorLogs++; } },
  window: { setTimeout: () => {} },
  navigator: { clipboard: { writeText: async (address) => {
    if (clipboardFailure) throw Object.assign(new Error("Clipboard blocked"), { name: "NotAllowedError" });
    copiedValue = address;
  } } },
  require: (id) => {
    if (id === "react") return { useState: (initial) => {
      const index = contractStateIndex++;
      if (!(index in contractStates)) contractStates[index] = initial;
      return [contractStates[index], (value) => { contractStates[index] = value; }];
    } };
    if (id === "react/jsx-runtime") return require(id);
    if (id === "next/router") return { useRouter: () => ({ asPath: "/contracts?view=all#nft" }) };
    if (id === "data/contracts") return {
      YELLOW_COLLECTIVE_CONTRACT_LIST: [{ name: "Collective Nouns NFT", address: "0x123" }],
      getExplorerAddressUrl: () => "https://example.com/contract",
    };
    return { __esModule: true, default: "stub", ArrowTopRightOnSquareIcon: "stub", ClipboardDocumentIcon: "stub" };
  },
});
function renderContracts() {
  contractStateIndex = 0;
  return contractsModule.exports.default();
}
function findElement(node, predicate) {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findElement(child, predicate);
      if (found) return found;
    }
  } else if (node?.props) {
    if (predicate(node)) return node;
    return findElement(node.props.children, predicate);
  }
}
const copyButton = (tree) => findElement(tree, (node) => node.type === "button" && node.props["aria-label"] === "Copy Collective Nouns NFT address");
await copyButton(renderContracts()).props.onClick();
const deniedCopyTree = renderContracts();
assert.equal(copyErrorLogs, 0, "Expected clipboard denial must not trigger the development error overlay.");
assert.ok(findElement(deniedCopyTree, (node) => node.props.role === "status"), "Clipboard denial must be announced.");
const browserFallback = findElement(deniedCopyTree, (node) => node.type === "a" && node.props.children === "Open Yellow Collective");
assert.ok(browserFallback, "Clipboard denial offers a user-triggered browser fallback.");
assert.equal(browserFallback.props.href, "/contracts?view=all#nft");
assert.equal(browserFallback.props.target, "_blank");
assert.equal(browserFallback.props.rel, "noopener noreferrer");
clipboardFailure = false;
await copyButton(deniedCopyTree).props.onClick();
const successfulCopyTree = renderContracts();
assert.equal(copiedValue, "0x123");
assert.ok(findElement(successfulCopyTree, (node) => node.type === "span" && node.props.children === "Copied"));
assert.equal(findElement(successfulCopyTree, (node) => node.props.role === "status"), undefined, "Successful copying clears the denied state.");
console.log("ok - clipboard denial offers a current-page fallback and successful standalone copying remains intact");
