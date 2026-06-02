import { BuilderSDK } from "@buildersdk/sdk";
import DefaultProvider from "@/utils/DefaultProvider";
import { GraphQLClient, gql } from "graphql-request";
import { SUBGRAPH_ENDPOINT } from "constants/urls";

const { governor } = BuilderSDK.connect({ signerOrProvider: DefaultProvider });

export const PREVIEW_PROPOSAL_ID =
  "0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff1";

export type Proposal = {
  proposalId: `0x${string}`;
  targets: `0x${string}`[];
  values: string[];
  calldatas: `0x${string}`[];
  description: string;
  descriptionHash: `0x${string}`;
  proposal: ProposalDetails;
  state: number;
};

type SubgraphProposal = {
  proposalId: `0x${string}`;
  targets: `0x${string}`[];
  values: string[] | string;
  calldatas: `0x${string}`[] | `0x${string}`;
  title?: string | null;
  description?: string | null;
  descriptionHash: `0x${string}`;
  proposer: `0x${string}`;
  timeCreated: string;
  voteStart: string;
  voteEnd: string;
  proposalThreshold: string;
  quorumVotes: string;
  forVotes: number;
  againstVotes: number;
  abstainVotes: number;
  queued: boolean;
  executed: boolean;
  canceled: boolean;
  vetoed: boolean;
};

const proposalsQuery = gql`
  query governorProposals($governorAddress: String!) {
    daos(first: 1, where: { governorAddress: $governorAddress }) {
      proposals(first: 100, orderBy: proposalNumber, orderDirection: desc) {
        proposalId
        targets
        values
        calldatas
        title
        description
        descriptionHash
        proposer
        timeCreated
        voteStart
        voteEnd
        proposalThreshold
        quorumVotes
        forVotes
        againstVotes
        abstainVotes
        queued
        executed
        canceled
        vetoed
      }
    }
  }
`;

export type ProposalDetails = {
  proposer: `0x${string}`;
  timeCreated: number;
  againstVotes: number;
  forVotes: number;
  abstainVotes: number;
  voteStart: number;
  voteEnd: number;
  proposalThreshold: number;
  quorumVotes: number;
  executed: boolean;
  canceled: boolean;
  vetoed: boolean;
};

export const getUserVotes = async ({
  address,
  user,
  timestamp,
}: {
  address: string;
  user: `0x${string}`;
  timestamp: number;
}) => {
  return governor({ address }).getVotes(user, BigInt(timestamp));
};

export const getProposalThreshold = async ({
  address,
}: {
  address: string;
}) => {
  return governor({ address }).proposalThreshold();
};

export const getProposalState = async ({
  address,
  proposalId,
}: {
  address: `0x${string}`;
  proposalId: `0x${string}`;
}) => {
  return governor({ address }).state(proposalId);
};

export const getProposalDetails = async ({
  address,
  proposalId,
}: {
  address: `0x${string}`;
  proposalId: `0x${string}`;
}): Promise<ProposalDetails> => {
  const {
    proposer,
    timeCreated,
    againstVotes,
    forVotes,
    abstainVotes,
    voteStart,
    voteEnd,
    proposalThreshold,
    quorumVotes,
    executed,
    canceled,
    vetoed,
  } = await governor({ address }).getProposal(proposalId);

  return {
    proposer,
    timeCreated,
    againstVotes,
    forVotes,
    abstainVotes,
    voteStart,
    voteEnd,
    proposalThreshold,
    quorumVotes,
    executed,
    canceled,
    vetoed,
  };
};

const toArray = <T>(value: T[] | T | null | undefined): T[] => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

const normalizeProposalDescription = (proposal: SubgraphProposal) => {
  if (proposal.title) {
    try {
      JSON.parse(proposal.title);
      return proposal.title;
    } catch {
      if (proposal.description)
        return `${proposal.title}&&${proposal.description}`;
      return proposal.title;
    }
  }

  return proposal.description || "";
};

const getSubgraphProposalState = (proposal: SubgraphProposal) => {
  const now = Date.now() / 1000;
  const forVotes = Number(proposal.forVotes || 0);
  const againstVotes = Number(proposal.againstVotes || 0);
  const quorumVotes = Number(proposal.quorumVotes || 0);

  if (proposal.vetoed) return 8;
  if (proposal.canceled) return 2;
  if (proposal.executed) return 7;
  if (proposal.queued) return 5;
  if (now < Number(proposal.voteStart || 0)) return 0;
  if (now <= Number(proposal.voteEnd || 0)) return 1;
  if (forVotes > againstVotes && forVotes >= quorumVotes) return 4;
  return 3;
};

const getPreviewProposal = (): Proposal => {
  const now = Math.floor(Date.now() / 1000);

  return {
    proposalId: PREVIEW_PROPOSAL_ID,
    targets: ["0x55333306a4c6e74eb9e23a521a24fb78be2de92c"],
    values: ["0"],
    calldatas: ["0x"],
    description: JSON.stringify({
      version: 1,
      title: "Preview Active Proposal",
      description:
        "This local-only proposal is active so the Yellow Collective voting modal can be previewed during development.",
    }),
    descriptionHash:
      "0x0000000000000000000000000000000000000000000000000000000000000000",
    proposal: {
      proposer: "0x0b379F1848fA2aab7790966373618F4B0Fea6A6e",
      timeCreated: now - 3600,
      againstVotes: 2,
      forVotes: 11,
      abstainVotes: 1,
      voteStart: now - 1800,
      voteEnd: now + 86400,
      proposalThreshold: 1,
      quorumVotes: 10,
      executed: false,
      canceled: false,
      vetoed: false,
    },
    state: 1,
  };
};

export const getProposals = async ({ address }: { address: `0x${string}` }) => {
  const client = new GraphQLClient(SUBGRAPH_ENDPOINT);
  const response = await client.request<{
    daos: { proposals: SubgraphProposal[] }[];
  }>(proposalsQuery, { governorAddress: address.toLowerCase() });

  const proposals = (response.daos[0]?.proposals || []).map((item) => {
    const proposal = {
      proposer: item.proposer,
      timeCreated: Number(item.timeCreated || 0),
      againstVotes: Number(item.againstVotes || 0),
      forVotes: Number(item.forVotes || 0),
      abstainVotes: Number(item.abstainVotes || 0),
      voteStart: Number(item.voteStart || 0),
      voteEnd: Number(item.voteEnd || 0),
      proposalThreshold: Number(item.proposalThreshold || 0),
      quorumVotes: Number(item.quorumVotes || 0),
      executed: item.executed,
      canceled: item.canceled,
      vetoed: item.vetoed,
    };

    return {
      proposalId: item.proposalId,
      targets: item.targets,
      values: toArray(item.values),
      calldatas: toArray(item.calldatas),
      description: normalizeProposalDescription(item),
      descriptionHash: item.descriptionHash,
      proposal,
      state: getSubgraphProposalState(item),
    } as Proposal;
  });

  if (process.env.VERCEL_ENV !== "production") {
    return [getPreviewProposal(), ...proposals];
  }

  return proposals;
};
