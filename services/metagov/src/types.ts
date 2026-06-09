export type NounsProposalStatus =
  | "PENDING"
  | "ACTIVE"
  | "CANCELLED"
  | "VETOED"
  | "QUEUED"
  | "EXECUTED"
  | "DEFEATED"
  | "SUCCEEDED"
  | "EXPIRED"
  | string;

export type NounsProposal = {
  id: string;
  title: string;
  description: string;
  proposer: string;
  startBlock: string;
  endBlock: string;
  createdTimestamp: string;
  status: NounsProposalStatus;
};

export type SnapshotChoice = "FOR" | "AGAINST" | "ABSTAIN";

export type SnapshotResult = SnapshotChoice | "NO_VOTES" | null;

export type SnapshotProposalStatus =
  | "created"
  | "active"
  | "closed"
  | "executed"
  | "skipped"
  | "failed"
  | "cancelled";

export type TrackedProposal = {
  nounsProposalId: string;
  nounsTitle: string;
  snapshotId: string;
  snapshotIpfs?: string;
  snapshotTitle: string;
  snapshotUrl: string;
  status: SnapshotProposalStatus;
  createdAt: string;
  updatedAt: string;
  scores?: number[];
  scoresTotal?: number;
  winningChoice?: SnapshotChoice | "NO_VOTES";
  executionMode?: "safe";
  voterAddress?: string;
  executionTxHash?: string;
  safeTxHash?: string;
  failureReason?: string;
};

export type ExecutionRecord = {
  nounsProposalId: string;
  snapshotId: string;
  choice: SnapshotChoice;
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
  proposals: Record<string, TrackedProposal>;
  executedVotes: ExecutionRecord[];
  notifications: Record<
    string,
    {
      eventType: string;
      sourceId: string;
      targetUrl: string;
      response?: unknown;
      sentAt: string;
    }
  >;
};
