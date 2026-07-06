import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import ts from "typescript";

const root = process.cwd();
const require = createRequire(import.meta.url);
const read = (path) => readFileSync(resolve(root, path), "utf8");
const exists = (path) => existsSync(resolve(root, path));

const loadTsModule = (path, mocks = {}) => {
  const filename = resolve(root, path);
  const source = readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  }).outputText;
  const module = { exports: {} };
  const localRequire = (id) => {
    if (Object.prototype.hasOwnProperty.call(mocks, id)) return mocks[id];
    if (id.startsWith(".") && Object.prototype.hasOwnProperty.call(mocks, resolve(filename, "..", id))) {
      return mocks[resolve(filename, "..", id)];
    }
    return require(id);
  };
  const fn = new Function("require", "module", "exports", output);
  fn(localRequire, module, module.exports);
  return module.exports;
};

const makeJsonResponse = (payload, ok = true, status = 200) => ({
  ok,
  status,
  json: async () => payload,
});

const snapshotConstants = {
  SNAPSHOT_GRAPHQL_URL: "https://snapshot.test/graphql",
  SNAPSHOT_SPACE_ID: "yellowcollective.eth",
  SNAPSHOT_SPACE_URL: "https://snapshot.box/#/s:yellowcollective.eth",
};

{
  const { getSnapshotProposalForNouns } = loadTsModule("data/snapshot.ts", {
    "constants/metagov": snapshotConstants,
  });

  const originalFetch = global.fetch;
  global.fetch = async () =>
    makeJsonResponse({
      data: {
        proposals: [
          {
            id: "snapshot-nouns-game",
            title: "Current body-link-only proposal",
            body: "**Nouns proposal:** https://nouns.game/proposals/999",
            choices: ["For", "Against", "Abstain"],
            snapshot: "123",
            state: "active",
          },
          {
            id: "snapshot-site-link",
            title: "Site body-link-only proposal",
            body: "https://yellowcollective.art/proposals/nouns/998",
            choices: ["For", "Against", "Abstain"],
            snapshot: "122",
            state: "active",
          },
          {
            id: "snapshot-title",
            title: "Nouns #997: Title format changed",
            body: "",
            choices: ["For", "Against", "Abstain"],
            snapshot: "121",
            state: "active",
          },
        ],
      },
    });

  const nounsGameMatch = await getSnapshotProposalForNouns(999);
  assert.equal(
    nounsGameMatch?.id,
    "snapshot-nouns-game",
    "Snapshot matcher must recognize current nouns.game proposal body links."
  );

  const siteLinkMatch = await getSnapshotProposalForNouns(998);
  assert.equal(
    siteLinkMatch?.id,
    "snapshot-site-link",
    "Snapshot matcher must recognize Yellow proposal-page body links."
  );

  const titleMatch = await getSnapshotProposalForNouns(997);
  assert.equal(
    titleMatch?.id,
    "snapshot-title",
    "Snapshot matcher must continue to recognize Nouns #id title prefixes."
  );

  global.fetch = originalFetch;
  console.log("ok - Snapshot proposal matching covers current title/body/link formats");
}

{
  assert.equal(exists("data/metagov.ts"), true, "Site metagov state reader must exist.");
  assert.equal(
    exists("pages/api/metagov/nouns/[proposalNumber].ts"),
    true,
    "Per-proposal metagov status API must exist."
  );
  assert.equal(
    exists("components/MetagovStatusCard.tsx"),
    true,
    "Proposal detail page must have a metagov status card."
  );

  const metagovData = read("data/metagov.ts");
  assert.match(
    metagovData,
    /METAGOV_STATE_URL|NEXT_PUBLIC_METAGOV_STATE_URL|METAGOV_STATE_FILE|DATA_DIR/,
    "Metagov state reader must support remote and local persisted state sources."
  );

  const statusApi = read("pages/api/metagov/nouns/[proposalNumber].ts");
  assert.doesNotMatch(
    statusApi,
    /getNounsMetagovEnabled|isAdminAddress/,
    "Backend metagov status API must stay available when public UI access is toggled off."
  );
  assert.match(statusApi, /getMetagovProposalStatus/, "Status API must return persisted bot state.");

  const statusCard = read("components/MetagovStatusCard.tsx");
  for (const expected of [
    "winningChoice",
    "scores",
    "scoresTotal",
    "failureReason",
    "snapshotUrl",
    "snapshotTitle",
    "voterAddress",
    "stateUpdatedAt",
    "safeTxHash",
    "executionTxHash",
  ]) {
    assert.match(
      statusCard,
      new RegExp(expected),
      `Metagov status card must render ${expected}.`
    );
  }

  const detailPage = read("pages/proposals/nouns/[proposalNumber].tsx");
  assert.match(
    detailPage,
    /const isAdmin = isAdminAddress\(address\);/,
    "Nouns proposal detail page must calculate the connected admin state."
  );
  assert.match(
    detailPage,
    /\{isAdmin && \(\s*<MetagovStatusCard proposalNumber=\{proposal\.proposalNumber\} \/>\s*\)\}/,
    "Nouns proposal detail page must render the metagov status card only for admin wallets."
  );
  console.log("ok - Site metagov status API and UI are wired independently of public gating");
}

{
  const tempDir = mkdtempSync(join(tmpdir(), "yc-metagov-site-state-"));
  const statePath = join(tempDir, "metagov-state.json");
  const previousMetagovStateFile = process.env.METAGOV_STATE_FILE;
  const previousMetagovStateUrl = process.env.METAGOV_STATE_URL;
  const previousPublicMetagovStateUrl = process.env.NEXT_PUBLIC_METAGOV_STATE_URL;

  try {
    process.env.METAGOV_STATE_FILE = statePath;
    delete process.env.METAGOV_STATE_URL;
    delete process.env.NEXT_PUBLIC_METAGOV_STATE_URL;

    writeFileSync(
      statePath,
      JSON.stringify({
        version: 1,
        updatedAt: "2026-06-01T12:00:00.000Z",
        proposals: {
          "1002": {
            nounsProposalId: "1002",
            nounsTitle: "Verify metagov display",
            snapshotId: "snapshot-1002",
            snapshotTitle: "1002: Verify metagov display",
            snapshotUrl:
              "https://snapshot.box/#/s:yellowcollective.eth/proposal/snapshot-1002",
            status: "executed",
            createdAt: "2026-06-01T11:00:00.000Z",
            updatedAt: "2026-06-01T12:00:00.000Z",
            scores: [3, 1, 0],
            scoresTotal: 4,
            winningChoice: "FOR",
            executionMode: "safe",
            voterAddress: "0x00EC9615Ab4f45cBeb66b5FA36bcEd3D79f38Bb3",
            safeTxHash: "0xsafe",
          },
        },
        executedVotes: [
          {
            nounsProposalId: "1002",
            snapshotId: "snapshot-1002",
            choice: "FOR",
            executionMode: "safe",
            voterAddress: "0x00EC9615Ab4f45cBeb66b5FA36bcEd3D79f38Bb3",
            safeTxHash: "0xsafe-execution",
            executionTxHash: "0xexecution",
            blockNumber: 123,
            gasUsed: "456",
            executedAt: "2026-06-01T12:01:00.000Z",
          },
        ],
      })
    );

    const { getMetagovProposalStatus } = loadTsModule("data/metagov.ts");
    const status = await getMetagovProposalStatus(1002);

    assert.equal(status.stateUpdatedAt, "2026-06-01T12:00:00.000Z");
    assert.equal(status.proposal?.status, "executed");
    assert.equal(status.proposal?.winningChoice, "FOR");
    assert.deepEqual(status.proposal?.scores, [3, 1, 0]);
    assert.equal(status.proposal?.scoresTotal, 4);
    assert.equal(status.execution?.executionTxHash, "0xexecution");
  } finally {
    if (previousMetagovStateFile === undefined) {
      delete process.env.METAGOV_STATE_FILE;
    } else {
      process.env.METAGOV_STATE_FILE = previousMetagovStateFile;
    }
    if (previousMetagovStateUrl === undefined) {
      delete process.env.METAGOV_STATE_URL;
    } else {
      process.env.METAGOV_STATE_URL = previousMetagovStateUrl;
    }
    if (previousPublicMetagovStateUrl === undefined) {
      delete process.env.NEXT_PUBLIC_METAGOV_STATE_URL;
    } else {
      process.env.NEXT_PUBLIC_METAGOV_STATE_URL =
        previousPublicMetagovStateUrl;
    }
    rmSync(tempDir, { recursive: true, force: true });
  }
  console.log("ok - Site metagov state reader returns persisted status and execution data");
}

{
  const voteCard = read("components/NounsSnapshotVoteCard.tsx");
  assert.match(voteCard, /submitSuccess/, "Snapshot vote card must expose a success state after a mocked submit.");
  assert.match(voteCard, /submitError/, "Snapshot vote card must expose an error state after a mocked submit.");
  assert.match(voteCard, /Collective Noun required/, "Snapshot vote card must expose holder eligibility messaging.");
  assert.match(voteCard, /disabled=\{!canSubmitVote\}/, "Snapshot vote CTA must be disabled when voting is unavailable.");
  assert.match(
    voteCard,
    /getMiniAppEthereumProvider/,
    "Snapshot vote card must fall back to the Farcaster mini app provider when wagmi signer hydration lags."
  );
  assert.doesNotMatch(
    voteCard,
    /disabled=\{!choice \|\| !signer \|\| submitting\}/,
    "Snapshot vote modal must not dead-end on a missing preloaded signer."
  );
  console.log("ok - Snapshot vote UI exposes success, error, eligibility, and disabled states");
}

{
  const modalWrapper = read("components/ModalWrapper.tsx");
  assert.match(
    modalWrapper,
    /z-\[80\]/,
    "Shared modal wrapper must sit above the site header and mobile menu stack."
  );
  assert.doesNotMatch(
    modalWrapper,
    /z-40/,
    "Shared modal wrapper must not render below the header stack."
  );
  console.log("ok - Shared modal wrapper stays above header overlays");
}

{
  const core = loadTsModule("services/metagov/src/core.ts");

  assert.deepEqual(
    core.determineSnapshotWinner([4, 2, 1]),
    "FOR",
    "For must win when it has the highest Snapshot score."
  );
  assert.deepEqual(
    core.determineSnapshotWinner([1, 5, 1]),
    "AGAINST",
    "Against must win when it has the highest Snapshot score."
  );
  assert.deepEqual(
    core.determineSnapshotWinner([0, 0, 0]),
    "NO_VOTES",
    "Empty Snapshot tallies must be explicit."
  );
  assert.deepEqual(
    core.determineSnapshotWinner([5, 5, 1]),
    "ABSTAIN",
    "Tied Snapshot tallies must resolve to Abstain."
  );

  const proposal = {
    id: "1000",
    title: "Fund public goods",
    description: "Body",
    proposer: "0x0000000000000000000000000000000000000001",
    startBlock: "1",
    endBlock: "2",
    createdTimestamp: "3",
    status: "ACTIVE",
  };

  assert.equal(
    core.shouldCreateSnapshotProposal({
      proposal,
      minProposalId: 900,
      processedProposalIds: new Set(["1000"]),
      existingSnapshotProposalIds: new Set(),
      trackedProposal: { nounsProposalId: "1000", snapshotId: "dry-run-1000" },
      dryRun: false,
    }).eligible,
    true,
    "Stale dry-run state must not block real Snapshot creation after DRY_RUN is disabled."
  );

  assert.equal(
    core.shouldCreateSnapshotProposal({
      proposal: { ...proposal, status: "EXECUTED" },
      minProposalId: 900,
      processedProposalIds: new Set(),
      existingSnapshotProposalIds: new Set(),
      dryRun: false,
    }).eligible,
    false,
    "Executed Nouns proposals must not create Snapshot votes."
  );

  const message = core.buildSnapshotProposalMessage({
    proposal,
    from: "0x0000000000000000000000000000000000000002",
    space: "yellowcollective.eth",
    now: 100,
    snapshotBlock: 12345,
    votingDurationSeconds: 432000,
    proposalLinkTemplate: "https://nouns.game/proposals/{id}",
    siteProposalLinkTemplate: "https://yellowcollective.art/proposals/nouns/{id}",
  });
  assert.equal(message.title, "1000: Fund public goods");
  assert.deepEqual(message.choices, ["For", "Against", "Abstain"]);
  assert.equal(message.discussion, "https://nouns.game/proposals/1000");
  assert.match(message.body, /https:\/\/nouns\.game\/proposals\/1000/);
  assert.match(message.body, /https:\/\/yellowcollective\.art\/proposals\/nouns\/1000/);
  assert.equal(message.end - message.start, 432000);
  console.log("ok - Metagov core covers proposal eligibility, Snapshot shape, stale dry-run recovery, and winner resolution");
}

{
  const tempDir = mkdtempSync(join(tmpdir(), "yc-metagov-state-"));
  try {
    const statePath = join(tempDir, "metagov-state.json");
    const { StateStore } = loadTsModule("services/metagov/src/services/state-store.ts", {
      "../config": { config: { dataDir: tempDir } },
      "../types": {},
    });
    const store = new StateStore(statePath);
    store.upsertProposal({
      nounsProposalId: "1001",
      nounsTitle: "Restart-safe state",
      snapshotId: "snapshot-1001",
      snapshotTitle: "1001: Restart-safe state",
      snapshotUrl: "https://snapshot.box/#/s:yellowcollective.eth/proposal/snapshot-1001",
      status: "created",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    const reloaded = new StateStore(statePath).load();
    assert.equal(
      reloaded.proposals["1001"].snapshotId,
      "snapshot-1001",
      "StateStore must recover tracked proposals after restart."
    );
    assert.deepEqual(
      readdirSync(tempDir).filter((file) => file.endsWith(".tmp")),
      [],
      "StateStore atomic writes must not leave temp files after a successful save."
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
  console.log("ok - State persistence writes atomically and recovers after restart");
}

{
  const serviceSnapshot = read("services/metagov/src/services/snapshot.ts");
  assert.match(serviceSnapshot, /config\.dryRun[\s\S]*dry-run-\$\{proposal\.id\}/, "Snapshot creation must use DRY_RUN fake IDs.");
  assert.match(serviceSnapshot, /buildSnapshotProposalMessage/, "Snapshot creation must use the tested proposal message builder.");
  assert.match(
    serviceSnapshot,
    /getCurrentSnapshotBlockNumber/,
    "Snapshot creation must use the Snapshot-space chain block number."
  );
  assert.doesNotMatch(
    serviceSnapshot,
    /getCurrentBlockNumber/,
    "Snapshot creation must not use the Ethereum mainnet provider block number."
  );
  const metagovConfig = read("services/metagov/src/config.ts");
  assert.match(metagovConfig, /snapshotRpcUrl/, "Metagov config must expose a Snapshot-chain RPC URL.");
  assert.match(metagovConfig, /snapshotChainId/, "Metagov config must expose a Snapshot-chain id.");
  const walletUtils = read("services/metagov/src/utils/wallet.ts");
  assert.match(walletUtils, /getSnapshotProvider/, "Metagov wallet utils must have a Snapshot-chain provider.");
  assert.match(
    walletUtils,
    /validateSnapshotRpcEndpoint/,
    "Metagov startup validation must validate the Snapshot-chain RPC."
  );
  assert.match(
    walletUtils,
    /eth_chainId/,
    "Metagov startup validation must verify the Snapshot RPC's actual chain id."
  );
  const validation = read("services/metagov/src/validation.ts");
  assert.match(
    validation,
    /spaceNetwork[\s\S]*config\.snapshotChainId/,
    "Metagov startup validation must compare the Snapshot space network to the configured Snapshot chain."
  );
  assert.match(
    read("services/metagov/src/core.ts"),
    /discussion:\s*proposalLinkTemplate\.replace\("\{id\}", proposal\.id\)/,
    "Snapshot discussion must use the configured proposal link template."
  );

  const safeVoting = read("services/metagov/src/services/safe-voting.ts");
  assert.match(safeVoting, /executionMode:\s*"safe"/, "Final execution result must be Safe-only.");
  assert.match(safeVoting, /castRefundableVoteWithReason/, "Final execution must target the Nouns DAO vote method.");
  assert.match(safeVoting, /hasAlreadyVoted\(proposalId,\s*config\.safeAddress\)/, "Already-voted detection must check the configured Safe address.");
  assert.doesNotMatch(safeVoting, /getCurrentVotes|getPriorVotes/, "Final execution must not hard-block zero-weight Safe votes.");
  assert.doesNotMatch(safeVoting, /bot-wallet|executionMode:\s*"bot"/, "Final execution must not fall back to a bot-wallet vote.");
  console.log("ok - Final Nouns DAO execution path is dry-run capable, Safe-only, and zero-weight tolerant");
}
