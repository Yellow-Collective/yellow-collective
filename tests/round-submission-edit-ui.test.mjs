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
  vm.runInNewContext(outputText, { module, exports: module.exports, console, AbortSignal, Error,
    setInterval: () => 1, clearInterval() {}, ...globals,
    require: name => name in overrides ? overrides[name] : require(name),
  });
  return module.exports;
};
const policy = load("utils/rounds/submission-edit.ts");
const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : !tree || typeof tree !== "object" ? [] : [tree, ...nodes(tree.props?.children)];
const text = tree => Array.isArray(tree) ? tree.map(text).join(" ") : tree == null || typeof tree === "boolean" ? "" : typeof tree === "object" ? text(tree.props?.children) : String(tree);
const wallet = "0x1111111111111111111111111111111111111111";
const harness = (listMode = false) => {
  const slots = [], dependencies = [], pending = [];
  let cursor = 0;
  const state = { address: wallet, status: "connected", connector: {}, confirm: true, failSave: false, trace: [], signHook: null,
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
    swr: { default: () => ({}) },
    "./RoundSubmissionCard": { SubmissionCard: "submission-card" },
    wagmi: { useAccount: () => ({ address: state.address, status: state.status, connector: state.connector }), useSignMessage: () => ({ signMessageAsync: async () => "synthetic" }) },
    "./SubmissionImagesField": { SubmissionImagesField: "image-picker" },
    "@/utils/rounds/submission-images": { appendRoundSubmissionImages: (current, added) => [...current, ...added] },
    "@/utils/rounds/submission-edit": policy,
    "@/utils/rounds/auth": { getRoundSignedRequestAction: action => `round:${action}` },
    "constants/addresses": { TOKEN_NETWORK: 8453 },
    "@/utils/signature-auth-client": { createSignedRequestAuthHeader: async ({ method }) => { state.trace.push(`sign:${method}`); if (state.signHook) state.signHook(); if (state.failRead && method === "GET") throw new Error("Wallet confirmation timed out. Dismiss the pending request, then try again."); return "synthetic"; } },
  }, {
    window: { confirm(message) { assert.match(message, /only once/); state.trace.push("confirm"); return state.confirm; } },
    fetch: async (_path, options) => {
      state.trace.push(`fetch:${options.method}`);
      if (state.fetchHook) return state.fetchHook(options);
      if (_path.endsWith("/my-submissions")) return { ok: true, json: async () => ({ submissions: [{ ...state.row }] }) };
      if (options.method === "PATCH" && state.failSave) return { ok: false, json: async () => ({ error: "Invalid edit." }) };
      if (options.method === "PATCH") state.row = { ...state.row, ...JSON.parse(options.body).submission, userEditedAt: "2026-10-15T12:00:00Z" };
      return { ok: true, json: async () => ({ submission: { ...state.row } }) };
    },
  });
  const render = () => { cursor = 0; const tree = RoundSubmissionEditor({ round, submissionId: state.submissionId || (listMode ? undefined : "entry"), navigation: "Back to round" }); pending.splice(0).forEach(fn => fn()); return tree; };
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

test("signed owner list renders full shared cards and selecting Edit loads the protected editor", async () => {
  const h = harness(true);
  h.render();
  assert.deepEqual(h.state.trace, []);
  const header = nodes(h.render()).find(n => n.type === "div" && text(n).includes("Back to round"));
  assert.ok(nodes(header).some(n => n.type === "button" && text(n) === "Load my submissions"));
  await h.button("Load my submissions").props.onClick();
  const card = nodes(h.render()).find(n => n.type === "submission-card");
  assert.ok(card);
  assert.equal(card.props.submission.description, "Description");
  assert.equal(card.props.submission.images[0], "https://example.invalid/cover.png");
  assert.equal(card.props.canVote, false);
  assert.equal(card.props.showVoteCount, false);
  const edit = nodes(card.props.ownerAction).find(n => n.type === "button");
  assert.equal(edit.props["aria-label"], "Edit Original entry");
  await edit.props.onClick();
  assert.deepEqual(h.state.trace, ["sign:GET", "fetch:GET", "sign:GET", "fetch:GET"]);
  assert.ok(nodes(h.render()).some(n => n.props?.value === "Original entry"));
  assert.equal(nodes(h.render()).some(n => n.type === "submission-card"), false);
});

test("owner card list is cleared when the connected wallet changes", async () => {
  const h = harness(true); h.render();
  await h.button("Load my submissions").props.onClick();
  assert.ok(nodes(h.render()).some(n => n.type === "submission-card"));
  h.state.address = "0x2222222222222222222222222222222222222222";
  assert.equal(nodes(h.render()).some(n => n.type === "submission-card"), false);
});

test("return to owned cards needs no new signature and reflects the used edit after save", async () => {
  const h = harness(true); h.render();
  await h.button("Load my submissions").props.onClick();
  let card = nodes(h.render()).find(n => n.type === "submission-card");
  await nodes(card.props.ownerAction).find(n => n.type === "button").props.onClick();
  h.changeTitle("Updated title");
  await h.button("Save edits").props.onClick();
  h.state.trace = [];
  await h.button("Back to my submissions").props.onClick();
  card = nodes(h.render()).find(n => n.type === "submission-card");
  assert.equal(card.props.submission.title, "Updated title");
  assert.ok(card.props.submission.userEditedAt);
  assert.match(text(card.props.ownerAction), /Edit used/);
  assert.match(text(card.props.ownerAction), /View submission/);
  assert.deepEqual(h.state.trace, []);
});

test("shared full card renders project media, description, wallet and owner action without votes", () => {
  const { renderToStaticMarkup } = require("react-dom/server");
  const React = require("react");
  const { SubmissionCard } = load("components/rounds/RoundSubmissionCard.tsx", {
    "next/link": { default: "a" },
    "react-markdown": { default: ({ children }) => React.createElement("p", null, children) },
    "remark-gfm": { default: () => {} },
    swr: { default: () => ({}) },
    "@/components/WalletIdentityLink": { default: ({ address }) => React.createElement("a", null, address) },
    "@/hooks/useIsMounted": { useIsMounted: () => true },
    "@/components/noundry/NoundryPreview": { NounPreviewTile: "noun-preview", getSubmissionPreviewTraits: () => ({}) },
    "@/utils/noundry/round-trait-submission": { isRoundTraitAutoDescription: () => false },
  });
  const submission = { id: "one", title: "Full card", description: "Real description", image: "https://example.invalid/cover.png", images: ["https://example.invalid/cover.png", "https://example.invalid/second.png"], walletAddress: wallet, submissionType: "project", video: { url: "https://example.invalid/video.mp4" } };
  const html = renderToStaticMarkup(React.createElement(SubmissionCard, {
    submission, rank: 0, isWinner: false, isRoundEnded: false, isVotingOpen: false, isOwnSubmission: true,
    canVote: false, allocation: 0, lockedVotes: 0, remainingVotes: 0, maxVotesPerEntry: null,
    onChange() {}, onOpen() {}, showRank: false, showVoteCount: false,
    ownerAction: React.createElement("button", null, "Edit"),
  }));
  for (const content of ["yc-round-submission-card", 'src="https://example.invalid/cover.png"', "Full card", "Real description", wallet, "Video", "2 images", ">Edit</button>"]) assert.ok(html.includes(content), content);
  assert.doesNotMatch(html, /New votes|votes<|locked<|yc-round-rank-pill/);
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
  assert.equal(nodes(h.render()).some(n => n.props?.value === "Changed entry"), false);
});

test("disconnect and reconnect same wallet preserves unsaved draft without reloading", async () => {
  const h = harness(); await h.start(); h.changeTitle("Unsaved draft");
  h.state.address = undefined; h.state.status = "disconnected"; h.state.connector = undefined;
  h.render(); h.render();
  h.state.address = wallet; h.state.status = "connected"; h.state.connector = {};
  h.render();
  assert.ok(nodes(h.render()).some(n => n.props?.value === "Unsaved draft"));
  assert.equal(h.button("Save edits").props.disabled, false);
});

test("different wallet or submission cannot receive retained draft", async () => {
  for (const change of [h => { h.state.address = "0x2222222222222222222222222222222222222222"; }, h => { h.state.submissionId = "different"; }]) {
    const h = harness(); await h.start(); h.changeTitle("Private draft"); change(h);
    assert.equal(nodes(h.render()).some(n => n.props?.value === "Private draft"), false);
    assert.equal(nodes(h.render()).some(n => n.props?.value === "Private draft"), false);
  }
});

test("late load after disconnect and same-wallet reconnect cannot overwrite draft", async () => {
  const h = harness(); await h.start(); h.changeTitle("Keep draft");
  let finish; h.state.fetchHook = () => new Promise(resolve => { finish = resolve; });
  const pending = h.button("Reload saved submission").props.onClick();
  for (let i = 0; i < 10; i++) await Promise.resolve();
  h.state.address = undefined; h.state.status = "disconnected"; h.render();
  h.state.address = wallet; h.state.status = "connected"; h.render();
  finish({ ok: true, json: async () => ({ submission: { ...h.state.row, title: "Stale result" } }) });
  await pending;
  assert.ok(nodes(h.render()).some(n => n.props?.value === "Keep draft"));
  assert.equal(h.button("Save edits").props.disabled, false);
});

test("same-render double save cannot dispatch duplicate edits", async () => {
  const h = harness(); await h.start(); h.changeTitle("One save"); h.state.trace = [];
  let finish; h.state.fetchHook = () => new Promise(resolve => { finish = resolve; });
  const click = h.button("Save edits").props.onClick;
  const pending = click(); await click();
  for (let i = 0; i < 10; i++) await Promise.resolve();
  assert.deepEqual(h.state.trace, ["confirm", "sign:PATCH", "fetch:PATCH"]);
  finish({ ok: true, json: async () => ({ submission: { ...h.state.row, title: "One save", userEditedAt: "2026-10-16T12:00:00Z" } }) });
  await pending;
  assert.equal(h.button("Save edits").props.disabled, true);
});

test("voting deadline disables saving and trait controls preserve canonical media", async () => {
  const h = harness(); h.state.row.submissionType = "trait"; await h.start(); h.changeTitle("Changed trait");
  assert.equal(nodes(h.render()).some(n => n.type === "image-picker"), false);
  h.round.votingStartsAt = "2000-01-01T00:00:00Z";
  assert.equal(h.button("Save edits").props.disabled, true);
});

test("cached address without a connected connector cannot start loading", async () => {
  const h = harness(); h.state.status = "reconnecting"; h.state.connector = undefined;
  assert.equal(h.button("Load my submission").props.disabled, true);
  await h.button("Load my submission").props.onClick();
  assert.deepEqual(h.state.trace, []);
  assert.match(text(h.render()), /reconnect.*wallet/i);
});

test("load signing timeout leaves a recoverable editor and retry loads the entry", async () => {
  const h = harness(); h.state.failRead = true; await h.start();
  assert.equal(h.button("Load my submission").props.disabled, false);
  assert.match(text(h.render()), /Wallet confirmation timed out/);
  assert.deepEqual(h.state.trace, ["sign:GET"]);
  h.state.failRead = false; await h.start();
  assert.ok(nodes(h.render()).some(n => n.props?.value === "Original entry"));
});
