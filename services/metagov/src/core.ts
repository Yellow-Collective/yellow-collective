import type { NounsProposal, SnapshotChoice, SnapshotResult } from "./types";

type SnapshotProposalText = {
  title?: string;
  body?: string;
};

type TrackedProposalLike = {
  snapshotId?: string;
};

type SnapshotProposalEligibilityInput = {
  proposal: Pick<NounsProposal, "id" | "status">;
  minProposalId: number;
  processedProposalIds: Set<string>;
  existingSnapshotProposalIds: Set<string>;
  trackedProposal?: TrackedProposalLike;
  dryRun: boolean;
};

type SnapshotProposalEligibility =
  | { eligible: true; reason: "eligible" | "stale-dry-run-state" }
  | {
      eligible: false;
      reason:
        | "below-min-proposal-id"
        | "processed"
        | "existing-snapshot"
        | "tracked-state"
        | "stale-dry-run-state-existing-snapshot"
        | "terminal-nouns-status";
    };

type BuildSnapshotProposalMessageInput = {
  proposal: NounsProposal;
  from: string;
  space: string;
  now: number;
  snapshotBlock: number;
  votingDurationSeconds: number;
  proposalLinkTemplate: string;
  siteProposalLinkTemplate: string;
};

export const isTerminalNounsProposalStatus = (status: string) =>
  ["CANCELLED", "VETOED", "EXECUTED"].includes(status);

export const isDryRunSnapshotId = (snapshotId?: string) =>
  Boolean(snapshotId?.startsWith("dry-run-"));

export const parseNounsIdFromSnapshotProposal = ({
  title = "",
  body = "",
}: SnapshotProposalText) => {
  const normalizedTitle = title.trim();
  const directMatch = normalizedTitle.match(/^(\d+)\s*:/);
  if (directMatch) return directMatch[1];

  const nounsMatch = normalizedTitle.match(/^Nouns\s*#?(\d+)\s*:/i);
  if (nounsMatch) return nounsMatch[1];

  const text = `${normalizedTitle}\n${body}`;
  const linkPatterns = [
    /nouns\.game\/proposals\/(\d+)/i,
    /yellowcollective\.art\/proposals\/nouns\/(\d+)/i,
    /nouns\.wtf\/vote\/(\d+)/i,
  ];

  for (const pattern of linkPatterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }

  return null;
};

export const shouldCreateSnapshotProposal = ({
  proposal,
  minProposalId,
  processedProposalIds,
  existingSnapshotProposalIds,
  trackedProposal,
  dryRun,
}: SnapshotProposalEligibilityInput): SnapshotProposalEligibility => {
  const proposalNumber = Number(proposal.id);
  if (proposalNumber < minProposalId) {
    return { eligible: false, reason: "below-min-proposal-id" };
  }

  const hasExistingSnapshot = existingSnapshotProposalIds.has(proposal.id);
  const hasStaleDryRunState =
    !dryRun && isDryRunSnapshotId(trackedProposal?.snapshotId);

  if (processedProposalIds.has(proposal.id) && !hasStaleDryRunState) {
    return { eligible: false, reason: "processed" };
  }

  if (hasExistingSnapshot) {
    return {
      eligible: false,
      reason: hasStaleDryRunState
        ? "stale-dry-run-state-existing-snapshot"
        : "existing-snapshot",
    };
  }

  if (trackedProposal && !hasStaleDryRunState) {
    return { eligible: false, reason: "tracked-state" };
  }

  if (isTerminalNounsProposalStatus(proposal.status)) {
    return { eligible: false, reason: "terminal-nouns-status" };
  }

  return {
    eligible: true,
    reason: hasStaleDryRunState ? "stale-dry-run-state" : "eligible",
  };
};

export const determineSnapshotWinner = (
  scores: Array<number | undefined>
): SnapshotResult => {
  const [forVotes = 0, againstVotes = 0, abstainVotes = 0] = scores;
  const maxVotes = Math.max(forVotes, againstVotes, abstainVotes);

  if (maxVotes === 0) return "NO_VOTES";

  const winners = [
    ["FOR", forVotes],
    ["AGAINST", againstVotes],
    ["ABSTAIN", abstainVotes],
  ].filter(([, score]) => score === maxVotes);

  if (winners.length > 1) return "ABSTAIN";

  return winners[0][0] as SnapshotChoice;
};

export const formatProposalBody = ({
  proposal,
  proposalLinkTemplate,
  siteProposalLinkTemplate,
}: Pick<
  BuildSnapshotProposalMessageInput,
  "proposal" | "proposalLinkTemplate" | "siteProposalLinkTemplate"
>) => {
  const nounsLink = proposalLinkTemplate.replace("{id}", proposal.id);
  const siteLink = siteProposalLinkTemplate.replace("{id}", proposal.id);

  return [
    `**Nouns proposal:** ${nounsLink}`,
    `**Yellow Collective voting page:** ${siteLink}`,
    "",
    "Vote here to decide how Yellow Collective should vote on the Nouns DAO proposal.",
  ].join("\n");
};

export const buildSnapshotProposalMessage = ({
  proposal,
  from,
  space,
  now,
  snapshotBlock,
  votingDurationSeconds,
  proposalLinkTemplate,
  siteProposalLinkTemplate,
}: BuildSnapshotProposalMessageInput) => ({
  from,
  space,
  timestamp: now,
  type: "single-choice",
  title: `${proposal.id}: ${proposal.title}`,
  body: formatProposalBody({
    proposal,
    proposalLinkTemplate,
    siteProposalLinkTemplate,
  }),
  discussion: proposalLinkTemplate.replace("{id}", proposal.id),
  choices: ["For", "Against", "Abstain"],
  labels: [] as string[],
  start: now,
  end: now + votingDurationSeconds,
  snapshot: snapshotBlock,
  plugins: "{}",
  privacy: "",
  app: "yellowcollective",
});
