import { getProposalName } from "./getProposalName";
import { getYellowProposalPath } from "./proposal-routing";
import { getRoundState } from "./rounds/state";
import { parseNounsProposalNumber } from "data/snapshot";
import type { Proposal } from "data/nouns-builder/governor";
import type { NounsDaoProposal } from "data/nouns-dao/proposals";
import type { Round } from "data/rounds";
import type { SnapshotProposal } from "data/snapshot";

export type DashboardActionItem = {
  id: string;
  title: string;
  label: string;
  status: string;
  deadline: number;
  deadlineLabel: string;
  stats: string[];
  href: string;
  actionLabel: string;
};

export type DashboardSection = {
  items: DashboardActionItem[];
  total: number;
  error?: string;
};

export type DashboardPayload = {
  submissions: DashboardSection;
  voting: DashboardSection;
  yellowProposals: DashboardSection;
  nounsProposals: DashboardSection;
};

type ProviderResult<T> = { data?: T; error?: string };

export type DashboardNounsSource = {
  enabled: boolean;
  snapshots: SnapshotProposal[];
  proposals: Array<Pick<NounsDaoProposal, "proposalNumber" | "title">>;
};

type DashboardSources = {
  rounds: ProviderResult<Round[]>;
  yellowProposals: ProviderResult<Proposal[]>;
  nouns: ProviderResult<DashboardNounsSource>;
};

const compactSection = (
  items: DashboardActionItem[],
  error?: string
): DashboardSection => {
  const sorted = [...items].sort((a, b) => a.deadline - b.deadline);
  return { items: sorted.slice(0, 3), total: sorted.length, ...(error ? { error } : {}) };
};

const mapRound = (
  round: Round,
  kind: "submissions" | "voting"
): DashboardActionItem => {
  const isSubmissions = kind === "submissions";
  return {
    id: round.id,
    title: round.title,
    label: isSubmissions ? "Round" : "Round",
    status: isSubmissions ? "Submissions open" : "Voting open",
    deadline: new Date(
      isSubmissions ? round.votingStartsAt : round.votingEndsAt
    ).getTime(),
    deadlineLabel: isSubmissions ? "Voting starts" : "Voting ends",
    stats: isSubmissions
      ? [`${round.approvedSubmissionCount || 0} approved submissions`]
      : [
          `${round.approvedSubmissionCount || 0} submissions`,
          `${round.totalVotes || 0} votes`,
        ],
    href: isSubmissions
      ? `/rounds/${round.slug}/submit`
      : `/rounds/${round.slug}`,
    actionLabel: isSubmissions ? "Submit" : "Review & vote",
  };
};

const mapYellowProposal = (proposal: Proposal): DashboardActionItem => ({
  id: proposal.proposalId,
  title: getProposalName(proposal.description),
  label: `Proposal ${proposal.proposalNumber}`,
  status: "Active",
  deadline: proposal.proposal.voteEnd * 1000,
  deadlineLabel: "Voting ends",
  stats: [
    `${proposal.proposal.forVotes || 0} for`,
    `${proposal.proposal.againstVotes || 0} against`,
    `${proposal.proposal.abstainVotes || 0} abstain`,
  ],
  href: getYellowProposalPath(proposal),
  actionLabel: "Review & vote",
});

const mapNounsProposals = ({
  enabled,
  snapshots,
  proposals,
}: DashboardNounsSource): DashboardActionItem[] => {
  if (!enabled) return [];

  const proposalsByNumber = new Map(
    proposals.map((proposal) => [proposal.proposalNumber, proposal])
  );
  const activeByNumber = new Map<number, SnapshotProposal>();

  for (const snapshot of snapshots) {
    if (snapshot.state !== "active") continue;
    const proposalNumber = parseNounsProposalNumber(snapshot);
    if (proposalNumber === null) continue;
    const existing = activeByNumber.get(proposalNumber);
    if (!existing || snapshot.end < existing.end) {
      activeByNumber.set(proposalNumber, snapshot);
    }
  }

  return Array.from(activeByNumber, ([proposalNumber, snapshot]) => ({
    id: snapshot.id,
    title:
      proposalsByNumber.get(proposalNumber)?.title ||
      snapshot.title.replace(/^(?:Nouns\s*)?#?\d+\s*:\s*/i, ""),
    label: `Nouns proposal ${proposalNumber}`,
    status: "Snapshot voting active",
    deadline: snapshot.end * 1000,
    deadlineLabel: "Snapshot voting ends",
    stats: [],
    href: `/proposals/nouns/${proposalNumber}`,
    actionLabel: "Review & vote",
  }));
};

export const buildDashboardPayload = ({
  rounds,
  yellowProposals,
  nouns,
}: DashboardSources): DashboardPayload => {
  const roundItems = rounds.data || [];
  const submissionItems = roundItems
    .filter((round) => getRoundState(round) === "submissions_open")
    .map((round) => mapRound(round, "submissions"));
  const votingItems = roundItems
    .filter((round) => getRoundState(round) === "voting_open")
    .map((round) => mapRound(round, "voting"));
  const yellowItems = (yellowProposals.data || [])
    .filter((proposal) => proposal.state === 1)
    .map(mapYellowProposal);
  const nounsItems = nouns.data ? mapNounsProposals(nouns.data) : [];

  return {
    submissions: compactSection(submissionItems, rounds.error),
    voting: compactSection(votingItems, rounds.error),
    yellowProposals: compactSection(yellowItems, yellowProposals.error),
    nounsProposals: compactSection(nounsItems, nouns.error),
  };
};
