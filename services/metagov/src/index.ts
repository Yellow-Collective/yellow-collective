import { config } from "./config";
import { shouldCreateSnapshotProposal } from "./core";
import { fetchNewProposals, fetchProposalById } from "./listeners/nouns-proposals";
import {
  cancelSnapshotProposal,
  createSnapshotProposal,
  formatVoteReason,
  getActiveSnapshotProposals,
  getClosedSnapshotProposals,
  getExistingProposalIds,
  getSnapshotResults,
  getSnapshotScores,
  getSnapshotUrl,
} from "./services/snapshot";
import {
  executeFinalVote,
  getConfiguredVoterVoteStatus,
} from "./services/safe-voting";
import { StateStore } from "./services/state-store";
import { sendMetagovNotification } from "./services/notifications";
import { startHttpServer } from "./server/http-server";
import { TrackedProposal } from "./types";
import { getWalletAddress } from "./utils/wallet";
import { validateRuntime } from "./validation";

const store = new StateStore();
const processedProposals = new Set<string>();
const pendingVotes = new Map<string, string>();
const submittedVotes = new Set<string>();
let lastCheckedTimestamp =
  Math.floor(Date.now() / 1000) - config.lookbackDays * 24 * 60 * 60;
let isExecutingVotes = false;

const buildTrackedProposal = (
  nounsProposalId: string,
  nounsTitle: string,
  snapshotId: string,
  snapshotIpfs?: string
): TrackedProposal => ({
  nounsProposalId,
  nounsTitle,
  snapshotId,
  snapshotIpfs,
  snapshotTitle: `${nounsProposalId}: ${nounsTitle}`,
  snapshotUrl: getSnapshotUrl(snapshotId),
  status: "created",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const loadStateIntoMemory = async () => {
  let state = store.load();
  for (const execution of state.executedVotes) {
    const voteStatus = await getConfiguredVoterVoteStatus(
      execution.nounsProposalId
    );
    if (voteStatus === false) {
      console.warn(
        `Removing stale execution record for Nouns #${execution.nounsProposalId}; Governor reports hasVoted=false.`
      );
      store.removeStaleExecution(execution.nounsProposalId);
    }
  }
  state = store.load();

  for (const proposal of Object.values(state.proposals)) {
    processedProposals.add(proposal.nounsProposalId);
    if (!["executed", "skipped", "failed", "cancelled"].includes(proposal.status)) {
      pendingVotes.set(proposal.snapshotId, proposal.nounsProposalId);
    }
  }

  for (const execution of state.executedVotes) {
    submittedVotes.add(execution.snapshotId);
  }

  const activeProposals = await getActiveSnapshotProposals();
  for (const proposal of activeProposals) {
    if (!submittedVotes.has(proposal.snapshotId)) {
      pendingVotes.set(proposal.snapshotId, proposal.nounsId);
    }
  }

  const closedProposals = await getClosedSnapshotProposals();
  for (const proposal of closedProposals) {
    if (
      Number(proposal.nounsId) >= config.minProposalId &&
      !submittedVotes.has(proposal.snapshotId)
    ) {
      pendingVotes.set(proposal.snapshotId, proposal.nounsId);
    }
  }
};

const checkForNewProposals = async () => {
  const existingSnapshotIds = await getExistingProposalIds();
  const proposals = await fetchNewProposals(lastCheckedTimestamp);
  const state = store.load();

  for (const proposal of proposals) {
    const eligibility = shouldCreateSnapshotProposal({
      proposal,
      minProposalId: config.minProposalId,
      processedProposalIds: processedProposals,
      existingSnapshotProposalIds: existingSnapshotIds,
      trackedProposal: state.proposals[proposal.id],
      dryRun: config.dryRun,
    });

    if (!eligibility.eligible) {
      if (eligibility.reason === "terminal-nouns-status") {
        processedProposals.add(proposal.id);
      }

      if (eligibility.reason === "stale-dry-run-state-existing-snapshot") {
        console.warn(
          `Stale dry-run state found for Nouns #${proposal.id}, but a live Snapshot proposal already exists; skipping duplicate creation.`
        );
      }
      continue;
    }

    if (eligibility.reason === "stale-dry-run-state") {
      console.warn(
        `Stale dry-run state found for Nouns #${proposal.id}; creating a real Snapshot proposal because DRY_RUN is disabled.`
      );
    }

    console.log(`Creating Snapshot vote for Nouns #${proposal.id}`);
    const receipt = await createSnapshotProposal(proposal);
    const trackedProposal = buildTrackedProposal(
      proposal.id,
      proposal.title,
      receipt.id,
      receipt.ipfs
    );
    store.upsertProposal(trackedProposal);
    processedProposals.add(proposal.id);
    pendingVotes.set(receipt.id, proposal.id);
    await sendMetagovNotification({
      store,
      eventType: "nouns_snapshot_created",
      sourceId: `${proposal.id}:${receipt.id}`,
      targetPath: `/proposals/nouns/${proposal.id}`,
      variables: {
        proposalNumber: proposal.id,
        proposalTitle: proposal.title,
      },
    }).catch(console.error);

    const createdTimestamp = Number(proposal.createdTimestamp);
    if (createdTimestamp > lastCheckedTimestamp) {
      lastCheckedTimestamp = createdTimestamp;
    }
  }
};

const checkForClosedVotes = async () => {
  if (isExecutingVotes) return;
  isExecutingVotes = true;

  try {
    for (const [snapshotId, nounsId] of Array.from(pendingVotes.entries())) {
      if (submittedVotes.has(snapshotId)) continue;

      const configuredVoterStatus =
        await getConfiguredVoterVoteStatus(nounsId);
      if (configuredVoterStatus === null) {
        console.warn(
          `Deferring Nouns #${nounsId}; configured voter receipt could not be read.`
        );
        continue;
      }
      if (configuredVoterStatus) {
        store.markProposal(nounsId, "skipped", {
          failureReason:
            "Configured metagov voter already voted on this Nouns proposal.",
        });
        submittedVotes.add(snapshotId);
        pendingVotes.delete(snapshotId);
        continue;
      }

      const result = await getSnapshotResults(snapshotId);
      if (!result) continue;

      const { scores, scoresTotal, submittedVotesCount } =
        await getSnapshotScores(snapshotId);
      store.markWinningChoice(nounsId, result, scores, scoresTotal);
      await sendMetagovNotification({
        store,
        eventType: "nouns_snapshot_closed",
        sourceId: `${nounsId}:${snapshotId}`,
        targetPath: `/proposals/nouns/${nounsId}`,
        variables: {
          proposalNumber: nounsId,
          proposalTitle: store.load().proposals[nounsId]?.nounsTitle || "",
          winningChoice: result || "NO_VOTES",
        },
      }).catch(console.error);

      if (submittedVotesCount === 0) {
        store.markProposal(nounsId, "skipped", {
          failureReason: "No Snapshot votes were submitted.",
        });
        submittedVotes.add(snapshotId);
        pendingVotes.delete(snapshotId);
        continue;
      }

      if (result === "NO_VOTES" && config.noVotesAction === "skip") {
        store.markProposal(nounsId, "skipped", {
          failureReason: "No Snapshot votes were cast.",
        });
        submittedVotes.add(snapshotId);
        pendingVotes.delete(snapshotId);
        continue;
      }

      const voteData =
        result === "NO_VOTES"
          ? {
              choice: "ABSTAIN" as const,
              reason:
                "**FOR 0 VOTES**\n\n**AGAINST 0 VOTES**\n\n**ABSTAIN 0 VOTES**",
            }
          : await formatVoteReason(snapshotId);

      if (!voteData) continue;

      const execution = await executeFinalVote(
        nounsId,
        voteData.choice,
        voteData.reason
      );

      if (!execution) {
        store.markProposal(nounsId, "failed", {
          failureReason: "Safe execution did not complete; will retry.",
        });
        continue;
      }

      store.appendExecution({
        nounsProposalId: nounsId,
        snapshotId,
        choice: voteData.choice,
        executionMode: execution.executionMode,
        voterAddress: execution.voterAddress,
        safeTxHash: execution.safeTxHash,
        executionTxHash: execution.executionTxHash,
        blockNumber: execution.blockNumber,
        gasUsed: execution.gasUsed,
        executedAt: new Date().toISOString(),
      });
      await sendMetagovNotification({
        store,
        eventType: "nouns_vote_executed",
        sourceId: `${nounsId}:${snapshotId}`,
        targetPath: `/proposals/nouns/${nounsId}`,
        variables: {
          proposalNumber: nounsId,
          proposalTitle: store.load().proposals[nounsId]?.nounsTitle || "",
          winningChoice: voteData.choice,
        },
      }).catch(console.error);
      submittedVotes.add(snapshotId);
      pendingVotes.delete(snapshotId);
    }
  } finally {
    isExecutingVotes = false;
  }
};

const checkForCancelledProposals = async () => {
  const activeProposals = await getActiveSnapshotProposals();

  for (const proposal of activeProposals) {
    const onchainProposal = await fetchProposalById(proposal.nounsId);
    if (!onchainProposal) continue;

    if (["CANCELLED", "VETOED"].includes(onchainProposal.status)) {
      const cancelled = await cancelSnapshotProposal(proposal.snapshotId);
      if (cancelled) {
        store.markProposal(proposal.nounsId, "cancelled");
        await sendMetagovNotification({
          store,
          eventType: "nouns_snapshot_cancelled",
          sourceId: `${proposal.nounsId}:${proposal.snapshotId}`,
          targetPath: `/proposals/nouns/${proposal.nounsId}`,
          variables: {
            proposalNumber: proposal.nounsId,
            proposalTitle:
              store.load().proposals[proposal.nounsId]?.nounsTitle || "",
          },
        }).catch(console.error);
        pendingVotes.delete(proposal.snapshotId);
      }
    }
  }
};

const logStatus = () => {
  console.log(
    `[${new Date().toISOString()}] processed=${processedProposals.size} pending=${pendingVotes.size} submitted=${submittedVotes.size}`
  );
};

const runCycle = async () => {
  await checkForNewProposals();
  await checkForClosedVotes();
  await checkForCancelledProposals();
  logStatus();
};

const main = async () => {
  console.log("Yellow metagov bot starting");
  await validateRuntime();
  startHttpServer(store);
  await loadStateIntoMemory();

  console.log(`Wallet: ${await getWalletAddress()}`);
  console.log(`Safe: ${config.safeAddress || "not configured"}`);
  console.log("Vote execution: Safe only");
  console.log(`Snapshot space: ${config.snapshotSpaceId}`);
  console.log(`Dry run: ${config.dryRun}`);
  console.log(`State: ${store.path}`);

  await runCycle();

  setInterval(
    () => checkForNewProposals().catch(console.error),
    config.proposalPollMinutes * 60 * 1000
  );
  setInterval(
    () =>
      Promise.resolve()
        .then(checkForClosedVotes)
        .then(checkForCancelledProposals)
        .then(logStatus)
        .catch(console.error),
    config.votePollMinutes * 60 * 1000
  );
};

process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));

main().catch((error) => {
  console.error("Fatal metagov error", error);
  process.exit(1);
});
