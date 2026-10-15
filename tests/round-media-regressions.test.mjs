import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const load = (path, overrides = {}, globals = {}) => {
  const module = { exports: {} };
  const output = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  vm.runInNewContext(output, {
    module, exports: module.exports,
    require: (key) => key in overrides ? overrides[key] : require(key),
    setTimeout, clearTimeout, AbortController, atob, ...globals,
  });
  return module.exports;
};

// Exercise the real component's effects and render branches with synthetic I/O.
const harness = (fetch) => {
  const slots = [];
  const effects = [];
  const timers = new Map();
  let cursor = 0, sequence = 0;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], (value) => {
        slots[index] = typeof value === "function" ? value(slots[index]) : value;
      }];
    },
    useRef(initial) {
      const index = cursor++;
      return slots[index] ||= { current: initial };
    },
    useEffect(run, deps) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || deps.some((value, i) => value !== previous.deps[i])) {
        effects.push(() => {
          previous?.cleanup?.();
          slots[index] = { deps, cleanup: run() };
        });
      }
    },
  };
  const jsx = (type, props) => ({ type, props });
  const { RoundVideoUpload } = load("components/rounds/RoundVideoUpload.tsx", {
    react,
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "@/utils/rounds/video-policy": { ROUND_VIDEO_MAX_BYTES: 100 * 1024 * 1024 },
  }, {
    fetch,
    setTimeout: (run) => { timers.set(++sequence, run); return sequence; },
    clearTimeout: (id) => timers.delete(id),
  });
  const props = {
    slug: "test-round", disabled: false, wallet: undefined,
    request: async () => { throw new Error("No upload should start"); },
    onChange() {}, onBusy() {},
  };
  return {
    render(changes = {}) {
      Object.assign(props, changes);
      cursor = 0;
      const tree = RoundVideoUpload(props);
      effects.splice(0).forEach((run) => run());
      return tree;
    },
    expire() { [...timers.values()].forEach((run) => run()); },
    unmount() { slots.forEach((slot) => slot?.cleanup?.()); },
  };
};
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const text = (tree) => JSON.stringify(tree);
const find = (tree, type) => {
  if (!tree || typeof tree !== "object") return undefined;
  if (tree.type === type) return tree;
  const children = tree.props?.children;
  return (Array.isArray(children) ? children : [children])
    .map((child) => find(child, type)).find(Boolean);
};

for (const response of [
  { ok: false, json: async () => { throw new Error("404 HTML"); } },
  { ok: true, json: async () => ({}) },
  { ok: true, json: async () => { throw new Error("Invalid JSON"); } },
]) {
  let calls = 0;
  const ui = harness(async (url, options) => {
    calls++;
    assert.equal(url, "/api/rounds/test-round/videos");
    assert.equal(options.cache, "no-store");
    return calls === 1 ? response : { ok: true, json: async () => ({ enabled: true }) };
  });
  assert.match(text(ui.render()), /Checking video upload availability/);
  await flush();
  const failed = ui.render();
  assert.match(text(failed), /Unable to check video uploads/);
  find(failed, "button").props.onClick();
  ui.render();
  await flush();
  const ready = ui.render();
  assert.match(text(ready), /Upload video/);
  assert.equal(find(ready, "input").props.disabled, true, "wallet still required");
  assert.equal(calls, 2);
  ui.unmount();
}
console.log("ok - missing route, malformed JSON and bad capability responses expose retry and recover");

{
  const ui = harness(async () => ({ ok: true, json: async () => ({ enabled: false }) }));
  ui.render(); await flush();
  assert.equal(ui.render(), null, "explicit server disable remains authoritative");
  ui.unmount();
}
{
  const ui = harness((_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(new Error("Aborted")));
  }));
  ui.render(); ui.expire(); await flush();
  assert.match(text(ui.render()), /Retry video availability/);
  ui.unmount();
}
{
  const pending = [];
  const ui = harness(() => new Promise((resolve) => { pending.push(resolve); }));
  ui.render();
  ui.render({ slug: "different-round" });
  pending[1]({ ok: true, json: async () => ({ enabled: true }) });
  await flush();
  assert.match(text(ui.render()), /Upload video/);
  pending[0]({ ok: true, json: async () => ({ enabled: false }) });
  await flush();
  assert.match(text(ui.render()), /Upload video/, "stale round response ignored");
  ui.unmount();
}
console.log("ok - intentional disable, request timeout and stale responses preserve safe behavior");

// A two-frame GIF must survive upload, validation, persisted JSON and deferred media.
const still = Buffer.from("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==", "base64");
const bytes = Buffer.concat([still.subarray(0, -1), still.subarray(still.indexOf(0x2c))]);
const gif = `data:image/gif;base64,${bytes.toString("base64")}`;
const upload = load("utils/rounds/round-image-upload.ts", {}, {
  FileReader: class { readAsDataURL() { this.result = gif; this.onload(); } },
  document: { createElement() { throw new Error("GIF must never be rasterized"); } },
});
const images = load("utils/rounds/submission-images.ts");
const media = load("utils/rounds/roundMediaPayload.ts");
const result = await upload.resizeRoundImageFile({ type: "image/gif", size: bytes.length });
assert.equal(result, gif);
assert.equal(images.getRoundSubmissionGifValidationError([result]), undefined);
const stored = JSON.parse(JSON.stringify({
  image: gif, submissions: [{ id: "synthetic", image: gif, images: [gif] }],
}));
const ssr = media.stripRoundInlineMediaForSsr(stored);
assert.equal(ssr.submissions[0].image, "");
const hydrated = media.hydrateRoundInlineMedia(ssr, JSON.parse(JSON.stringify(media.createRoundMediaPayload(stored))));
assert.equal(hydrated.submissions[0].image, gif);
assert.equal(hydrated.submissions[0].images[0], gif);
assert.deepEqual(Buffer.from(hydrated.submissions[0].image.split(",")[1], "base64"), bytes);
console.log("ok - both GIF frames survive upload, validation, stored JSON and gallery hydration unchanged");

// Next.js may extract the upload helper into a shared chunk in hosted builds.
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const smoke = new AsyncFunction("process", "fetch", "console", "URL", "AbortSignal",
  readFileSync("scripts/round-media-readonly-smoke.mjs", "utf8"));
const smokeProcess = { argv: ["node", "smoke", "https://example.com", "test-round"] };
const responses = {
  "/api/rounds/test-round/videos": '{"enabled":true}',
  "/rounds/test-round/submit": '<script id="__NEXT_DATA__">{"buildId":"synthetic"}</script><script src="/_next/static/chunks/shared-upload.js"></script><script src="/_next/static/chunks/pages/rounds/submit.js"></script>',
  "/_next/static/chunks/shared-upload.js": '"Choose a GIF no larger than 1MB to preserve animation."',
  "/_next/static/chunks/pages/rounds/submit.js": '"Optional video";"/videos"',
};
await smoke(smokeProcess, async (url) => {
  const body = responses[url.pathname];
  return { ok: body !== undefined, status: body === undefined ? 404 : 200, text: async () => body || "" };
}, { log() {} }, URL, AbortSignal);
assert.equal(smokeProcess.exitCode, 0, "release check must inspect shared uploader chunks");
console.log("ok - deployed media check finds GIF preservation in shared Next.js chunks");
