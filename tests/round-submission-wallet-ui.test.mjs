import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import test from "node:test";
const require = createRequire(import.meta.url);
const ts = require("typescript");
const nodes = (tree) =>
  Array.isArray(tree)
    ? tree.flatMap(nodes)
    : !tree || typeof tree !== "object"
      ? []
      : [tree, ...nodes(tree.props?.children)];
function harness() {
  const state = {
    status: "connected",
    connector: {},
    signing: true,
    calls: 0,
    fail: true,
  };
  const slots = [];
  const timers = new Map();
  let nextTimer = 0;
  let cursor = 0;
  const overrides = {
    react: {
      ...require("react"),
      useRef(initial) {
        const i = cursor++;
        if (!(i in slots)) slots[i] = { current: initial };
        return slots[i];
      },
      useState(initial) {
        const i = cursor++;
        if (!(i in slots)) slots[i] = initial;
        return [
          slots[i],
          (value) => {
            slots[i] = typeof value === "function" ? value(slots[i]) : value;
          },
        ];
      },
    },
    wagmi: {
      useAccount: () => ({
        address: "0x1111111111111111111111111111111111111111",
        status: state.status,
        connector: state.connector,
        isConnected: true,
      }),
      useSignMessage: () => ({
        signMessageAsync: async () => "signature",
        isLoading: state.signing,
      }),
    },
    "next/dynamic": { default: () => "connect-button", __esModule: true },
    "next/head": { default: "head", __esModule: true },
    "next/link": { default: "link", __esModule: true },
    "@/components/Layout": { default: "layout", __esModule: true },
    "@/components/rounds/RoundVideoUpload": {
      RoundVideoUpload: "video-upload",
    },
    "@/components/rounds/SubmissionImagesField": {
      SubmissionImagesField: "images",
    },
    "@heroicons/react/20/solid": { ArrowLeftIcon: "icon" },
    "constants/addresses": { TOKEN_NETWORK: 8453 },
    "data/rounds": {},
    "@/utils/rounds/state": { getRoundState: () => "submissions_open" },
    "@/utils/rounds/submission-copy": {
      getRoundSubmissionPlaceholders: () => ({}),
    },
    "@/utils/rounds/submission-images": {
      appendRoundSubmissionImages: (a, b) => [...a, ...b],
      getRoundSubmissionImagesPayloadBytes: () => 0,
      ROUND_SUBMISSION_MAX_TOTAL_IMAGE_BYTES: 1000,
    },
    "@/utils/rounds/auth": { getRoundSignedRequestAction: (v) => v },
    "@/utils/signature-auth-client": {
      createSignedRequestAuthHeader: async (args) => {
        state.calls++;
        assert.equal(args.bounded, true);
        if (state.fail) throw new Error("Wallet confirmation timed out.");
        return "auth";
      },
    },
  };
  const module = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(readFileSync("pages/rounds/[slug]/submit.tsx", "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    {
      module,
      exports: module.exports,
      AbortSignal,
      AbortController,
      Error,
      setTimeout: (fn) => {
        const id = ++nextTimer;
        timers.set(id, fn);
        return id;
      },
      clearTimeout: (id) => timers.delete(id),
      require: (name) => (name in overrides ? overrides[name] : require(name)),
      fetch: async () => {
        state.posts = (state.posts || 0) + 1;
        return state.fetchHook
          ? state.fetchHook()
          : { ok: true, json: async () => ({ submission: { id: "saved" } }) };
      },
    }
  );
  const render = () => {
    cursor = 0;
    return module.exports.default({
      round: { slug: "round", title: "Propaganda" },
    });
  };
  const find = (type) => nodes(render()).find((n) => n.type === type);
  const fill = () => {
    for (const label of ["Submission title", "Submission URL (optional)"])
      nodes(render())
        .find((n) => n.props?.label === label)
        .props.onChange("Entry");
    find("textarea").props.onChange({ target: { value: "Description" } });
    find("images").props.onAdd(["https://example.invalid/cover.png"]);
  };
  const submit = () =>
    nodes(render()).find(
      (n) => n.type === "button" && n.props.children === "Submit entry"
    );
  const flush = async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve();
  };
  return { state, render, find, fill, submit, timers, flush };
}
test("cached address without a connector blocks both video authorization and submission", async () => {
  const h = harness();
  h.state.status = "reconnecting";
  h.state.connector = undefined;
  h.fill();
  assert.equal(h.find("video-upload").props.disabled, true);
  assert.equal(h.submit().props.disabled, true);
  await assert.rejects(
    h.find("video-upload").props.request("reserve"),
    /Reconnect your wallet/
  );
  assert.equal(h.state.calls, 0);
});

test("POST and body timeouts release progress, preserve inputs and block duplicates including late responses", async () => {
  for (const body of [false, true]) {
    const h = harness();
    h.fill();
    h.state.fail = false;
    let finish;
    h.state.fetchHook = body
      ? async () => ({
          ok: true,
          json: () =>
            new Promise((resolve) => {
              finish = resolve;
            }),
        })
      : () =>
          new Promise((resolve) => {
            finish = resolve;
          });
    const click = h.submit().props.onClick;
    const request = click();
    await click();
    await h.flush();
    assert.equal(h.state.posts, 1);
    assert.equal(h.timers.size, 1);
    [...h.timers.values()][0]();
    await request;
    assert.equal(h.submit().props.disabled, true);
    assert.equal(h.find("textarea").props.value, "Description");
    const link = nodes(h.render()).find(
      (n) => n.type === "link" && n.props.target === "_blank"
    );
    assert.equal(link.props.href, "/rounds/round/edit");
    finish(
      body
        ? { submission: { id: "late" } }
        : { ok: true, json: async () => ({ submission: { id: "late" } }) }
    );
    await h.flush();
    await click();
    h.find("textarea").props.onChange({ target: { value: "Still editable" } });
    assert.equal(h.submit().props.disabled, true);
    assert.equal(h.state.posts, 1);
    assert.equal(h.find("images").props.images.length, 1);
  }
});

test("400 after dispatch and malformed success remain uncertain; confirmed success clears the form", async () => {
  for (const response of [
    { ok: false, json: async () => ({ error: "Readback failed" }) },
    { ok: true, json: async () => ({}) },
  ]) {
    const h = harness();
    h.fill();
    h.state.fail = false;
    h.state.fetchHook = async () => response;
    await h.submit().props.onClick();
    assert.equal(h.submit().props.disabled, true);
    assert.equal(h.find("images").props.images.length, 1);
  }
  const h = harness();
  h.fill();
  h.state.fail = false;
  await h.submit().props.onClick();
  assert.equal(h.find("images").props.images.length, 0);
  assert.equal(h.timers.size, 0);
});

test("proven validation rejection and auth rejection preserve draft and permit deliberate retry", async () => {
  for (const response of [
    {
      ok: false,
      status: 400,
      json: async () => ({ error: "Title too long", outcome: "not_saved" }),
    },
    ...[401, 403, 409].map((status) => ({
      ok: false,
      status,
      json: async () => ({ error: "Authorize again" }),
    })),
  ]) {
    const h = harness();
    h.fill();
    h.state.fail = false;
    h.state.fetchHook = async () => response;
    await h.submit().props.onClick();
    assert.equal(h.submit().props.disabled, false);
    assert.equal(h.find("images").props.images.length, 1);
    assert.equal(h.find("video-upload").props.disabled, false);
  }
});
test("signing failure preserves form and releases submit despite a still-pending wagmi mutation", async () => {
  const h = harness();
  h.fill();
  await h.submit().props.onClick();
  assert.equal(h.submit().props.disabled, false);
  assert.equal(h.find("textarea").props.value, "Description");
  assert.equal(h.find("images").props.images.length, 1);
  assert.equal(h.state.calls, 1);
});
