import fs from "fs";
import path from "path";

export type MetagovProposalStatus =
  | "created"
  | "active"
  | "closed"
  | "executed"
  | "skipped"
  | "failed"
  | "cancelled";

export type MetagovTrackedProposal = {
  nounsProposalId: string;
  nounsTitle: string;
  snapshotId: string;
  snapshotIpfs?: string;
  snapshotTitle: string;
  snapshotUrl: string;
  status: MetagovProposalStatus;
  createdAt: string;
  updatedAt: string;
  scores?: number[];
  scoresTotal?: number;
  winningChoice?: "FOR" | "AGAINST" | "ABSTAIN" | "NO_VOTES";
  executionMode?: "safe";
  voterAddress?: string;
  executionTxHash?: string;
  safeTxHash?: string;
  failureReason?: string;
};

export type MetagovExecutionRecord = {
  nounsProposalId: string;
  snapshotId: string;
  choice: "FOR" | "AGAINST" | "ABSTAIN";
  executionMode: "safe";
  voterAddress: string;
  safeTxHash?: string;
  executionTxHash: string;
  blockNumber: number;
  gasUsed: string;
  executedAt: string;
};

export type MetagovState = {
  version: 1;
  updatedAt: string;
  proposals: Record<string, MetagovTrackedProposal>;
  executedVotes: MetagovExecutionRecord[];
};

export type MetagovProposalStatusResponse = {
  stateUpdatedAt: string | null;
  proposal: MetagovTrackedProposal | null;
  execution: MetagovExecutionRecord | null;
};

const getLocalStatePath = () => {
  if (process.env.METAGOV_STATE_FILE) {
    return path.isAbsolute(process.env.METAGOV_STATE_FILE)
      ? process.env.METAGOV_STATE_FILE
      : path.join(process.cwd(), process.env.METAGOV_STATE_FILE);
  }

  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data");
  return path.join(dataDir, "metagov-state.json");
};

const readRemoteState = async (url: string): Promise<MetagovState | null> => {
  const secret = process.env.METAGOV_STATE_SECRET;
  const target = new URL(url);
  if (secret && (target.protocol !== "https:" || target.username || target.password)) {
    throw new Error("Authenticated metagov state must use an HTTPS URL without credentials.");
  }
  const response = await fetch(url, {
    cache: "no-store", redirect: "error",
    headers: secret ? { Authorization: `Bearer ${secret}` } : {},
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Metagov state request failed: ${response.status}`);
  }
  return (await response.json()) as MetagovState;
};

const readLocalState = (): MetagovState | null => {
  const statePath = getLocalStatePath();
  if (!fs.existsSync(statePath)) return null;
  return JSON.parse(fs.readFileSync(statePath, "utf8")) as MetagovState;
};

export const getMetagovState = async (): Promise<MetagovState | null> => {
  const stateUrl =
    process.env.METAGOV_STATE_URL || process.env.NEXT_PUBLIC_METAGOV_STATE_URL;

  if (stateUrl) return readRemoteState(stateUrl);

  return readLocalState();
};

export const getMetagovProposalStatus = async (
  proposalNumber: number
): Promise<MetagovProposalStatusResponse> => {
  const state = await getMetagovState();
  if (!state) {
    return {
      stateUpdatedAt: null,
      proposal: null,
      execution: null,
    };
  }

  const proposalId = String(proposalNumber);
  const proposal = state.proposals[proposalId] || null;
  const execution =
    state.executedVotes.find(
      (vote) =>
        vote.nounsProposalId === proposalId ||
        (proposal && vote.snapshotId === proposal.snapshotId)
    ) || null;

  return {
    stateUpdatedAt: state.updatedAt || null,
    proposal: proposal ? {
      ...pickPublicFields(proposal, "nounsProposalId nounsTitle snapshotId snapshotTitle snapshotUrl status createdAt updatedAt scores scoresTotal winningChoice executionMode voterAddress executionTxHash safeTxHash"),
      ...(proposal.failureReason ? { failureReason: "Metagovernance processing failed. Please contact the team." } : {}),
    } as MetagovTrackedProposal : null,
    execution: execution ? pickPublicFields(execution, "nounsProposalId snapshotId choice executionMode voterAddress safeTxHash executionTxHash blockNumber gasUsed executedAt") as MetagovExecutionRecord : null,
  };
};

const pickPublicFields = (record: object, fields: string) => Object.fromEntries(
  fields.split(" ").filter((key) => Object.prototype.hasOwnProperty.call(record, key))
    .map((key) => [key, (record as Record<string, unknown>)[key]])
);
