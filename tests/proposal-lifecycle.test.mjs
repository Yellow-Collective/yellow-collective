import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const lifecyclePath = resolve(process.cwd(), "utils/proposal-lifecycle.ts");
assert.ok(existsSync(lifecyclePath), "Proposal lifecycle helpers must exist.");

const lifecycleSource = readFileSync(lifecyclePath, "utf8");
const transpiled = ts.transpileModule(lifecycleSource, {
  compilerOptions: {
    esModuleInterop: true,
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
});
const lifecycleModule = { exports: {} };
vm.runInNewContext(transpiled.outputText, {
  require,
  module: lifecycleModule,
  exports: lifecycleModule.exports,
});

const { formatExecutionCountdown, getProposalLifecycleAction } =
  lifecycleModule.exports;

test("state 4 produces the queue action", () => {
  assert.equal(
    getProposalLifecycleAction({
      state: 4,
      proposalEta: undefined,
      blockTimestamp: 100,
      isPreview: false,
    }),
    "queue"
  );
});

test("state 5 before ETA produces the security-delay countdown", () => {
  assert.equal(
    getProposalLifecycleAction({
      state: 5,
      proposalEta: 200,
      blockTimestamp: 199,
      isPreview: false,
    }),
    "countdown"
  );
  assert.equal(formatExecutionCountdown(101_520), "1d 4h 12m");
});

test("state 5 at or after ETA produces the execute action", () => {
  for (const blockTimestamp of [200, 201]) {
    assert.equal(
      getProposalLifecycleAction({
        state: 5,
        proposalEta: 200,
        blockTimestamp,
        isPreview: false,
      }),
      "execute"
    );
  }
});

test("missing ETA is surfaced instead of enabling execution", () => {
  for (const proposalEta of [undefined, 0, Number.NaN]) {
    assert.equal(
      getProposalLifecycleAction({
        state: 5,
        proposalEta,
        blockTimestamp: 200,
        isPreview: false,
      }),
      "invalid-eta"
    );
  }
});

test("expired and executed proposals produce no action", () => {
  for (const state of [6, 7]) {
    assert.equal(
      getProposalLifecycleAction({
        state,
        proposalEta: 100,
        blockTimestamp: 200,
        isPreview: false,
      }),
      "none"
    );
  }
});

test("preview proposals never produce lifecycle transactions", () => {
  for (const state of [4, 5]) {
    assert.equal(
      getProposalLifecycleAction({
        state,
        proposalEta: 100,
        blockTimestamp: 200,
        isPreview: true,
      }),
      "none"
    );
  }
});

test("lifecycle component preserves payloads and both wallet transaction paths", () => {
  const source = readFileSync(
    resolve(process.cwd(), "components/ProposalLifecycleAction.tsx"),
    "utf8"
  );

  assert.match(source, /functionName: "queue"[\s\S]*args: \[proposal\.proposalId\]/);
  assert.match(
    source,
    /const executionArgs = \[[\s\S]*proposal\.targets,[\s\S]*proposal\.values\.map\(\(value\) => BigNumber\.from\(value\)\),[\s\S]*proposal\.calldatas,[\s\S]*proposal\.descriptionHash,[\s\S]*proposal\.proposal\.proposer,[\s\S]*\]/
  );
  assert.match(source, /functionName: "execute"[\s\S]*args: executionArgs/);
  assert.match(source, /getMiniAppEthereumProvider/);
  assert.match(source, /encodeFunctionData\(action/);
  assert.match(source, /eth_sendTransaction/);
  assert.match(source, /useContractRead\([\s\S]*functionName: "state"/);
  assert.match(source, /useContractRead\([\s\S]*functionName: "proposalEta"/);
  assert.match(source, /getBlock\("latest"\)/);
  assert.match(source, /This function sends a transaction\./);
  assert.match(source, /Queueing\u2026/);
  assert.match(source, /Executing\u2026/);
  assert.match(source, /Execution available in/);
  assert.match(source, /Proposal queued successfully\./);
  assert.match(source, /Proposal executed successfully\./);
  assert.match(source, /Connect your wallet before submitting this transaction\./);
  assert.match(source, /Switch your wallet to the configured network/);
  assert.match(source, /The wallet request was rejected\./);
  assert.match(source, /Transaction preparation failed\./);
  assert.match(source, /missing or invalid ETA data/);
  assert.match(source, /refreshedBlockTimestamp < refreshedEta/);
  assert.match(source, /disabled=\{isSubmitting\}/);
  assert.match(source, /role="alert"/);
  assert.match(source, /mutate\(proposalListKey\)/);
});

test("proposal page keeps vote and lifecycle actions in one responsive placement", () => {
  const source = readFileSync(
    resolve(process.cwd(), "pages/vote/[proposalid].tsx"),
    "utf8"
  );

  assert.match(
    source,
    /className="w-full sm:w-auto"[\s\S]*<VoteButton[\s\S]*<ProposalLifecycleAction/
  );
  assert.equal(
    (source.match(/<ProposalLifecycleAction/g) || []).length,
    1,
    "Only one lifecycle component should read state and submit transactions."
  );
});
