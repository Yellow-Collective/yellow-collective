import {
  SNAPSHOT_GRAPHQL_URL,
  SNAPSHOT_SPACE_ID,
  SNAPSHOT_SPACE_URL,
} from "constants/metagov";

export type SnapshotProposalState =
  | "pending"
  | "active"
  | "closed"
  | "cancelled";

export type SnapshotProposalChoice = "For" | "Against" | "Abstain";

export type SnapshotProposal = {
  id: string;
  title: string;
  body: string;
  choices: SnapshotProposalChoice[];
  start: number;
  end: number;
  snapshot: string;
  state: SnapshotProposalState;
  scores: number[];
  scoresTotal: number;
  link: string;
};

export type SnapshotVote = {
  id: string;
  voter: string;
  choice: number;
  reason: string;
  vp: number;
  created: number;
};

export type SnapshotProposalResponse = {
  id: string;
  title: string;
  body?: string;
  choices?: string[];
  start?: number;
  end?: number;
  snapshot?: string;
  state?: SnapshotProposalState;
  scores?: number[];
  scores_total?: number;
};

type SnapshotVoteResponse = {
  id: string;
  voter: string;
  choice: number;
  reason?: string;
  vp?: number;
  created?: number;
};

const SNAPSHOT_PROPOSALS_QUERY = `
  query YellowNounsSnapshotProposals($space: String!) {
    proposals(
      first: 100
      where: { space: $space }
      orderBy: "created"
      orderDirection: desc
    ) {
      id
      title
      body
      choices
      start
      end
      snapshot
      state
      scores
      scores_total
    }
  }
`;

const SNAPSHOT_VOTES_QUERY = `
  query YellowNounsSnapshotVotes($proposal: String!, $voter: String) {
    votes(
      first: 1000
      where: { proposal: $proposal, voter: $voter }
      orderBy: "created"
      orderDirection: desc
    ) {
      id
      voter
      choice
      reason
      vp
      created
    }
  }
`;

const normalizeSnapshotProposal = (
  proposal: SnapshotProposalResponse
): SnapshotProposal => ({
  id: proposal.id,
  title: proposal.title,
  body: proposal.body || "",
  choices: (proposal.choices || ["For", "Against", "Abstain"]).slice(
    0,
    3
  ) as SnapshotProposalChoice[],
  start: Number(proposal.start || 0),
  end: Number(proposal.end || 0),
  snapshot: String(proposal.snapshot || ""),
  state: proposal.state || "pending",
  scores: proposal.scores || [0, 0, 0],
  scoresTotal: Number(proposal.scores_total || 0),
  link: `${SNAPSHOT_SPACE_URL}/proposal/${proposal.id}`,
});

export const parseNounsProposalNumber = (
  proposal: Pick<SnapshotProposalResponse, "title" | "body">
) => {
  const title = proposal.title.trim();
  const directMatch = title.match(/^(\d+)\s*:/);
  if (directMatch) return Number(directMatch[1]);

  const nounsMatch = title.match(/^Nouns\s*#?(\d+)\s*:/i);
  if (nounsMatch) return Number(nounsMatch[1]);

  const text = `${title}\n${proposal.body || ""}`;
  const linkPatterns = [
    /nouns\.game\/proposals\/(\d+)/i,
    /yellowcollective\.art\/proposals\/nouns\/(\d+)/i,
    /nouns\.wtf\/vote\/(\d+)/i,
  ];

  for (const pattern of linkPatterns) {
    const linkMatch = text.match(pattern);
    if (linkMatch) return Number(linkMatch[1]);
  }

  return null;
};

export const getSnapshotProposals = async (): Promise<SnapshotProposal[]> => {
  const data = await snapshotGraphql<{
    proposals: SnapshotProposalResponse[];
  }>(SNAPSHOT_PROPOSALS_QUERY, { space: SNAPSHOT_SPACE_ID });

  return data.proposals.map(normalizeSnapshotProposal);
};

const snapshotGraphql = async <TData>(
  query: string,
  variables: Record<string, unknown>
) => {
  const response = await fetch(SNAPSHOT_GRAPHQL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`Snapshot GraphQL request failed: ${response.status}`);
  }

  const payload = (await response.json()) as {
    data?: TData;
    errors?: Array<{ message: string }>;
  };

  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join(", "));
  }

  if (!payload.data) {
    throw new Error("Snapshot GraphQL response did not include data.");
  }

  return payload.data;
};

export const getSnapshotProposalForNouns = async (
  proposalNumber: number
): Promise<SnapshotProposal | null> => {
  const proposals = await getSnapshotProposals();
  const match = proposals.find(
    (proposal) => parseNounsProposalNumber(proposal) === proposalNumber
  );

  return match || null;
};

export const getSnapshotVotes = async (
  snapshotProposalId: string,
  voter?: string
): Promise<SnapshotVote[]> => {
  const data = await snapshotGraphql<{ votes: SnapshotVoteResponse[] }>(
    SNAPSHOT_VOTES_QUERY,
    {
      proposal: snapshotProposalId,
      voter: voter?.toLowerCase(),
    }
  );

  return data.votes.map((vote) => ({
    id: vote.id,
    voter: vote.voter,
    choice: vote.choice,
    reason: vote.reason || "",
    vp: Number(vote.vp || 0),
    created: Number(vote.created || 0),
  }));
};
