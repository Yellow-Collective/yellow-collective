import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import test from "node:test";
const require = createRequire(import.meta.url);
const ts = require("typescript");
const load = (path, overrides = {}, globals = {}) => {
  const module = { exports: {} };
  const { outputText } = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  });
  vm.runInNewContext(outputText, { module, exports: module.exports, console, AbortSignal,
    setInterval: () => 1, clearInterval() {}, ...globals,
    require: name => name in overrides ? overrides[name] : require(name),
  });
  return module.exports;
};
const policy = load("utils/rounds/submission-edit.ts");
const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : !tree || typeof tree !== "object" ? [] : [tree, ...nodes(tree.props?.children)];
const text = tree => Array.isArray(tree) ? tree.map(text).join(" ") : tree == null || typeof tree === "boolean" ? "" : typeof tree === "object" ? text(tree.props?.children) : String(tree);
const wallet = "0x1111111111111111111111111111111111111111";
const harness = () => {
  const slots = [], dependencies = [], pending = [];
  let cursor = 0;
  const state = { address: wallet, confirm: true, failSave: false, trace: [], signHook: null,
    row: { id: "entry", walletAddress: wallet, title: "Original entry", description: "Description", images: ["https://example.invalid/cover.png"], url: "", status: "approved", userEditedAt: null, submissionType: "project" },
  };
  const round = { slug: "round", status: "published", active: true, votingStartsAt: "2030-01-01T00:00:00Z", minTitleLength: 1, maxTitleLength: 100, minDescriptionLength: 1, maxDescriptionLength: 2000 };
  const react = { ...require("react"),
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial; return [slots[i], value => { slots[i] = typeof value === "function" ? value(slots[i]) : value; }]; },
    useRef(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; },
    useEffect(fn, deps) { const i = cursor++; if (!dependencies[i] || deps.some((v, n) => v !== dependencies[i][n])) { dependencies[i] = deps; pending.push(fn); } },
  };
  const { RoundSubmissionEditor } = load("components/rounds/RoundSubmissionEditor.tsx", {
    react,
    wagmi: { useAccount: () => ({ address: state.address }), useSignMessage: () => ({ signMessageAsync: async () => "synthetic" }) },
    "./SubmissionImagesField": { SubmissionImagesField: "image-picker" },
    "@/utils/rounds/submission-images": { appendRoundSubmissionImages: (current, added) => [...current, ...added] },
    "@/utils/rounds/submission-edit": policy,
    "@/utils/rounds/auth": { getRoundSignedRequestAction: action => `round:${action}` },
    "constants/addresses": { TOKEN_NETWORK: 8453 },
    "@/utils/signature-auth-client": { createSignedRequestAuthHeader: async ({ method }) => { state.trace.push(`sign:${method}`); if (state.signHook) state.signHook(); return "synthetic"; } },
  }, {
    window: { confirm(message) { assert.match(message, /only once/); state.trace.push("confirm"); return state.confirm; } },
    fetch: async (_path, options) => {
      state.trace.push(`fetch:${options.method}`);
      if (options.method === "PATCH" && state.failSave) return { ok: false, json: async () => ({ error: "Invalid edit." }) };
      if (options.method === "PATCH") state.row = { ...state.row, ...JSON.parse(options.body).submission, userEditedAt: "2026-10-15T12:00:00Z" };
      return { ok: true, json: async () => ({ submission: { ...state.row } }) };
    },
  });
  const render = () => { cursor = 0; const tree = RoundSubmissionEditor({ round, submissionId: "entry" }); pending.splice(0).forEach(fn => fn()); return tree; };
  const button = label => { const match = nodes(render()).find(n => n.type === "button" && text(n) === label); assert.ok(match, `Button ${label} exists`); return match; };
  const changeTitle = value => nodes(render()).find(n => n.type === "input" && n.props.value === state.row.title).props.onChange({ target: { value } });
  const start = async () => { render(); await button("Load my submission").props.onClick(); render(); };
  return { state, round, render, button, changeTitle, start };
};

test("one-time save warns before signing; cancel preserves draft and successful save disables another edit", async () => {
  const h = harness(); await h.start(); h.changeTitle("Changed entry");
  h.state.trace = []; h.state.confirm = false;
  await h.button("Save edits").props.onClick();
  assert.deepEqual(h.state.trace, ["confirm"]);
  assert.equal(h.state.row.userEditedAt, null);
  assert.ok(nodes(h.render()).some(n => n.props?.value === "Changed entry"));
  h.state.trace = []; h.state.confirm = true;
  await h.button("Save edits").props.onClick();
  assert.deepEqual(h.state.trace, ["confirm", "sign:PATCH", "fetch:PATCH"]);
  assert.equal(h.state.row.title, "Changed entry");
  assert.equal(h.button("Save edits").props.disabled, true);
  assert.match(text(h.render()), /one-time edit has now been used/);
});

test("failed save preserves draft and does not consume the allowance", async () => {
  const h = harness(); await h.start(); h.changeTitle("Changed entry"); h.state.failSave = true;
  await h.button("Save edits").props.onClick();
  assert.equal(h.state.row.userEditedAt, null);
  assert.equal(h.button("Save edits").props.disabled, false);
  assert.match(text(h.render()), /Invalid edit/);
});

test("wallet changes during signing stop the edit before a PATCH request", async () => {
  const h = harness(); await h.start(); h.changeTitle("Changed entry"); h.state.trace = [];
  h.state.signHook = () => { h.state.address = "0x2222222222222222222222222222222222222222"; h.render(); };
  await h.button("Save edits").props.onClick();
  assert.deepEqual(h.state.trace, ["confirm", "sign:PATCH"]);
  assert.equal(h.state.row.userEditedAt, null);
  assert.match(text(h.render()), /Wallet changed/);
});

test("voting deadline disables saving and trait controls preserve canonical media", async () => {
  const h = harness(); h.state.row.submissionType = "trait"; await h.start(); h.changeTitle("Changed trait");
  assert.equal(nodes(h.render()).some(n => n.type === "image-picker"), false);
  h.round.votingStartsAt = "2000-01-01T00:00:00Z";
  assert.equal(h.button("Save edits").props.disabled, true);
});
