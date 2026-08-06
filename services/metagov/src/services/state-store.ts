import fs from "fs";
import path from "path";
import { config } from "../config";
import {
  ExecutionRecord,
  MetagovState,
  SnapshotProposalStatus,
  SnapshotChoice,
  TrackedProposal,
} from "../types";

const emptyState = (): MetagovState => ({
  version: 1,
  updatedAt: new Date().toISOString(),
  proposals: {},
  executedVotes: [],
  notifications: {},
});

export class StateStore {
  private readonly filePath: string;

  constructor(filePath = path.join(config.dataDir, "metagov-state.json")) {
    this.filePath = filePath;
  }

  get path() {
    return this.filePath;
  }

  load(): MetagovState {
    if (!fs.existsSync(this.filePath)) return emptyState();

    const parsed = JSON.parse(fs.readFileSync(this.filePath, "utf8")) as
      | MetagovState
      | Partial<MetagovState>;

    return {
      version: 1,
      updatedAt: parsed.updatedAt || new Date().toISOString(),
      proposals: parsed.proposals || {},
      executedVotes: parsed.executedVotes || [],
      notifications:
        (parsed as Partial<MetagovState>).notifications || {},
    };
  }

  save(state: MetagovState) {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const nextState = {
      ...state,
      updatedAt: new Date().toISOString(),
    };
    const tmpPath = `${this.filePath}.${process.pid}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(nextState, null, 2));
    fs.renameSync(tmpPath, this.filePath);
  }

  upsertProposal(proposal: TrackedProposal) {
    const state = this.load();
    state.proposals[proposal.nounsProposalId] = {
      ...state.proposals[proposal.nounsProposalId],
      ...proposal,
      updatedAt: new Date().toISOString(),
    };
    this.save(state);
  }

  markProposal(
    nounsProposalId: string,
    status: SnapshotProposalStatus,
    updates: Partial<TrackedProposal> = {}
  ) {
    const state = this.load();
    const existing = state.proposals[nounsProposalId];
    if (!existing) return;

    state.proposals[nounsProposalId] = {
      ...existing,
      ...updates,
      status,
      updatedAt: new Date().toISOString(),
    };
    this.save(state);
  }

  appendExecution(record: ExecutionRecord) {
    const state = this.load();
    if (
      state.executedVotes.some(
        (vote) =>
          vote.snapshotId === record.snapshotId ||
          vote.nounsProposalId === record.nounsProposalId
      )
    ) {
      return;
    }

    state.executedVotes.push(record);
    const existing = state.proposals[record.nounsProposalId];
    if (existing) {
      state.proposals[record.nounsProposalId] = {
        ...existing,
        status: "executed",
        winningChoice: record.choice,
        executionMode: record.executionMode,
        voterAddress: record.voterAddress,
        safeTxHash: record.safeTxHash,
        executionTxHash: record.executionTxHash,
        updatedAt: new Date().toISOString(),
      };
    }
    this.save(state);
  }

  removeStaleExecution(nounsProposalId: string) {
    const state = this.load();
    const nextExecutions = state.executedVotes.filter(
      (execution) => execution.nounsProposalId !== nounsProposalId
    );
    if (nextExecutions.length === state.executedVotes.length) return false;

    state.executedVotes = nextExecutions;
    const existing = state.proposals[nounsProposalId];
    if (existing) {
      const {
        executionMode: _executionMode,
        voterAddress: _voterAddress,
        safeTxHash: _safeTxHash,
        executionTxHash: _executionTxHash,
        failureReason: _failureReason,
        ...proposal
      } = existing;
      state.proposals[nounsProposalId] = {
        ...proposal,
        status: "closed",
        updatedAt: new Date().toISOString(),
      };
    }
    this.save(state);
    return true;
  }

  markWinningChoice(
    nounsProposalId: string,
    winningChoice: SnapshotChoice | "NO_VOTES",
    scores: number[],
    scoresTotal: number
  ) {
    this.markProposal(nounsProposalId, "closed", {
      winningChoice,
      scores,
      scoresTotal,
    });
  }

  hasNotification(eventType: string, sourceId: string) {
    const state = this.load();
    return Boolean(state.notifications[`${eventType}:${sourceId}`]);
  }

  markNotification({
    eventType,
    sourceId,
    targetUrl,
    response,
  }: {
    eventType: string;
    sourceId: string;
    targetUrl: string;
    response?: unknown;
  }) {
    const state = this.load();
    state.notifications[`${eventType}:${sourceId}`] = {
      eventType,
      sourceId,
      targetUrl,
      response,
      sentAt: new Date().toISOString(),
    };
    this.save(state);
  }
}
