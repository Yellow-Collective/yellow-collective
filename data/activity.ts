import { GraphQLClient, gql } from "graphql-request";
import { formatEther, isAddress } from "viem";
import { TOKEN_CONTRACT } from "constants/addresses";
import { SUBGRAPH_ENDPOINT } from "constants/urls";
import { listApprovedNoundrySubmissions } from "data/noundry/submissions";
import { listPublicRoundActivity } from "data/rounds";
import { YELLOW_COLLECTIVE_CONTRACTS } from "data/contracts";
import { getProposalName } from "@/utils/getProposalName";
import {
  paginateActivity,
  sanitizeActivityText,
  type ActivityFeedResponse,
  type ActivityItem,
  type ActivityQuery,
  type ActivitySource,
} from "@/utils/activity";

const SOURCE_WINDOW_LIMIT = 100;

type AuctionBidRow = {
  id: string;
  bidder: string;
  amount: string;
  comment?: string | null;
  bidTime?: string | number | null;
};

type AuctionRow = {
  id: string;
  bids?: AuctionBidRow[];
};

type GovernanceProposalRow = {
  proposalId: string;
  proposalNumber: string | number;
  title?: string | null;
  proposer?: string | null;
  timeCreated?: string | number | null;
  transactionHash?: string | null;
  queuedAt?: string | number | null;
  queuedTransactionHash?: string | null;
  executedAt?: string | number | null;
  executionTransactionHash?: string | null;
  canceledAt?: string | number | null;
  cancelTransactionHash?: string | null;
  vetoedAt?: string | number | null;
  vetoTransactionHash?: string | null;
};

type GovernanceVoteRow = {
  id: string;
  transactionHash?: string | null;
  timestamp?: string | number | null;
  voter?: string | null;
  support: string | number;
  weight: string | number;
  reason?: string | null;
  proposal?: GovernanceProposalRow | null;
};

const activityAuctionQuery = gql`
  query activityAuctionBids($tokenAddress: String!) {
    daos(first: 1, where: { tokenAddress: $tokenAddress }) {
      auctions(first: 50, orderBy: endTime, orderDirection: desc) {
        id
        bids(first: 100, orderBy: bidTime, orderDirection: desc) {
          id
          bidder
          amount
          comment
          bidTime
        }
      }
    }
  }
`;

const activityGovernanceQuery = gql`
  query activityGovernance($governorAddress: String!) {
    daos(first: 1, where: { governorAddress: $governorAddress }) {
      proposals(first: 100, orderBy: proposalNumber, orderDirection: desc) {
        proposalId
        proposalNumber
        title
        proposer
        timeCreated
        transactionHash
        queuedAt
        queuedTransactionHash
        executedAt
        executionTransactionHash
        canceledAt
        cancelTransactionHash
        vetoedAt
        vetoTransactionHash
      }
    }
  }
`;

const activityGovernanceVotesQuery = gql`
  query activityGovernanceVotes($proposalIds: [String!]!) {
    proposalVotes(
      first: 1000
      where: { proposal_in: $proposalIds }
      orderBy: timestamp
      orderDirection: desc
    ) {
      id
      transactionHash
      timestamp
      voter
      support
      weight
      reason
      proposal {
        proposalId
        proposalNumber
        title
      }
    }
  }
`;

const toIsoFromSeconds = (value: string | number | null | undefined) => {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return undefined;
  return new Date(seconds * 1000).toISOString();
};

const getTokenId = (auctionId: string) => auctionId.split(":").pop() || auctionId;
const getTransactionHash = (bidId: string) => {
  const hash = bidId.split(":")[0] || bidId;
  return /^0x[0-9a-f]{64}$/i.test(hash) ? hash : undefined;
};

const validTransactionHash = (value?: string | null) =>
  value && /^0x[0-9a-f]{64}$/i.test(value) ? value : undefined;

const formatBidAmount = (amount: string) => {
  try {
    return `${formatEther(BigInt(amount))} ETH`;
  } catch {
    return amount;
  }
};

const loadAuctionActivity = async (): Promise<ActivityItem[]> => {
  const client = new GraphQLClient(SUBGRAPH_ENDPOINT);
  const data = await client.request<{ daos?: { auctions?: AuctionRow[] }[] }>(
    activityAuctionQuery,
    { tokenAddress: TOKEN_CONTRACT.toLowerCase() }
  );

  return (data.daos?.[0]?.auctions || [])
    .flatMap((auction) => {
      const tokenId = getTokenId(auction.id);
      return (auction.bids || []).map((bid): ActivityItem | null => {
        const timestamp = toIsoFromSeconds(bid.bidTime);
        if (!timestamp) return null;
        const transactionHash = getTransactionHash(bid.id);
        const amount = formatBidAmount(bid.amount);

        return {
          id: `auction-bid:${bid.id}`,
          category: "auctions",
          type: "auction-bid",
          timestamp,
          actor: isAddress(bid.bidder) ? { address: bid.bidder } : undefined,
          title: `Placed a bid on Collective Nouns #${tokenId}`,
          description: sanitizeActivityText(bid.comment, Number.MAX_SAFE_INTEGER),
          href: `/?tokenid=${encodeURIComponent(tokenId)}`,
          ...(transactionHash ? { transactionHash } : {}),
          metadata: { amount, tokenId },
        };
      });
    })
    .filter((item): item is ActivityItem => Boolean(item));
};

const getGovernanceTitle = (proposal: GovernanceProposalRow) =>
  sanitizeActivityText(
    getProposalName(proposal.title || ""),
    100
  ) || "Untitled proposal";

const getGovernanceHref = (proposal: GovernanceProposalRow) =>
  `/proposals/${encodeURIComponent(String(proposal.proposalNumber))}`;

const lifecycleActivity = (
  proposal: GovernanceProposalRow,
  event: {
    type: "proposal-queued" | "proposal-executed" | "proposal-canceled" | "proposal-vetoed";
    verb: string;
    timestamp?: string | number | null;
    transactionHash?: string | null;
  }
): ActivityItem | null => {
  const timestamp = toIsoFromSeconds(event.timestamp);
  if (!timestamp) return null;

  return {
    id: `${event.type}:${proposal.proposalId}`,
    category: "proposals",
    type: event.type,
    timestamp,
    title: `${event.verb} proposal ${proposal.proposalNumber}: ${getGovernanceTitle(proposal)}`,
    href: getGovernanceHref(proposal),
    ...(validTransactionHash(event.transactionHash)
      ? { transactionHash: validTransactionHash(event.transactionHash) }
      : {}),
    metadata: { proposalNumber: Number(proposal.proposalNumber) },
  };
};

const normalizeSupport = (support: string | number) => {
  const value = Number(support);
  if (value === 0) return "against";
  if (value === 1) return "for";
  if (value === 2) return "abstain";

  switch (String(support).toLowerCase()) {
    case "against":
      return "against";
    case "for":
      return "for";
    default:
      return "abstain";
  }
};

const formatVoteWeight = (weight: string | number) => {
  const value = Number(weight);
  if (!Number.isFinite(value)) return String(weight);
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
};

const loadProposalActivity = async (): Promise<ActivityItem[]> => {
  const client = new GraphQLClient(SUBGRAPH_ENDPOINT);
  const governance = await client.request<{
    daos?: { proposals?: GovernanceProposalRow[] }[];
  }>(activityGovernanceQuery, {
    governorAddress: YELLOW_COLLECTIVE_CONTRACTS.governor.address.toLowerCase(),
  });
  const proposals = governance.daos?.[0]?.proposals || [];
  const proposalIds = proposals.map((proposal) => proposal.proposalId.toLowerCase());
  const voteData = proposalIds.length
    ? await client.request<{ proposalVotes?: GovernanceVoteRow[] }>(
        activityGovernanceVotesQuery,
        { proposalIds }
      )
    : { proposalVotes: [] };

  const proposalItems = proposals.flatMap((proposal) => {
    const createdAt = toIsoFromSeconds(proposal.timeCreated);
    const created: ActivityItem[] = createdAt
      ? [{
          id: `proposal-created:${proposal.proposalId}`,
          category: "proposals",
          type: "proposal-created",
          timestamp: createdAt,
          actor:
            proposal.proposer && isAddress(proposal.proposer)
              ? { address: proposal.proposer }
              : undefined,
          title: `Created proposal ${proposal.proposalNumber}: ${getGovernanceTitle(proposal)}`,
          href: getGovernanceHref(proposal),
          ...(validTransactionHash(proposal.transactionHash)
            ? { transactionHash: validTransactionHash(proposal.transactionHash) }
            : {}),
          metadata: { proposalNumber: Number(proposal.proposalNumber) },
        }]
      : [];

    return [
      ...created,
      lifecycleActivity(proposal, {
        type: "proposal-queued",
        verb: "Queued",
        timestamp: proposal.queuedAt,
        transactionHash: proposal.queuedTransactionHash,
      }),
      lifecycleActivity(proposal, {
        type: "proposal-executed",
        verb: "Executed",
        timestamp: proposal.executedAt,
        transactionHash: proposal.executionTransactionHash,
      }),
      lifecycleActivity(proposal, {
        type: "proposal-canceled",
        verb: "Canceled",
        timestamp: proposal.canceledAt,
        transactionHash: proposal.cancelTransactionHash,
      }),
      lifecycleActivity(proposal, {
        type: "proposal-vetoed",
        verb: "Vetoed",
        timestamp: proposal.vetoedAt,
        transactionHash: proposal.vetoTransactionHash,
      }),
    ].filter((item): item is ActivityItem => Boolean(item));
  });

  const voteItems = (voteData.proposalVotes || [])
    .map((vote): ActivityItem | null => {
      const proposal = vote.proposal;
      const timestamp = toIsoFromSeconds(vote.timestamp);
      if (!proposal || !timestamp) return null;
      const weight = formatVoteWeight(vote.weight);

      return {
        id: `proposal-vote:${vote.id}`,
        category: "proposals",
        type: "proposal-vote",
        timestamp,
        actor: vote.voter && isAddress(vote.voter) ? { address: vote.voter } : undefined,
        title: `Voted ${normalizeSupport(vote.support)} on proposal ${proposal.proposalNumber}: ${getGovernanceTitle(proposal)}`,
        description: sanitizeActivityText(vote.reason, Number.MAX_SAFE_INTEGER),
        href: getGovernanceHref(proposal),
        ...(validTransactionHash(vote.transactionHash)
          ? { transactionHash: validTransactionHash(vote.transactionHash) }
          : {}),
        metadata: {
          proposalNumber: Number(proposal.proposalNumber),
          voteWeight: `${weight} vote${weight === "1" ? "" : "s"}`,
        },
      };
    })
    .filter((item): item is ActivityItem => Boolean(item));

  return [...proposalItems, ...voteItems];
};

const loadRoundActivity = async (): Promise<ActivityItem[]> => {
  const { submissions, votes } = await listPublicRoundActivity(
    SOURCE_WINDOW_LIMIT
  );

  return [
    ...submissions.map(
      (submission): ActivityItem => ({
        id: `round-submission:${submission.id}`,
        category: "rounds",
        type: "round-submission",
        timestamp: submission.createdAt,
        actor: submission.walletAddress
          ? { address: submission.walletAddress }
          : undefined,
        title: `Submitted "${sanitizeActivityText(submission.title, 90) || "Untitled submission"}"`,
        href: `/rounds/${encodeURIComponent(submission.roundSlug)}`,
        metadata: {
          roundTitle: sanitizeActivityText(submission.roundTitle, 100) || submission.roundTitle,
          submissionTitle:
            sanitizeActivityText(submission.title, 100) || submission.title,
        },
      })
    ),
    ...votes.map(
      (vote): ActivityItem => ({
        id: `round-vote:${vote.id}`,
        category: "rounds",
        type: "round-vote",
        timestamp: vote.updatedAt || vote.createdAt,
        actor: vote.walletAddress ? { address: vote.walletAddress } : undefined,
        title: `Cast ${vote.voteCount} vote${vote.voteCount === 1 ? "" : "s"} for "${
          sanitizeActivityText(vote.submissionTitle, 90) || "Untitled submission"
        }"`,
        href: `/rounds/${encodeURIComponent(vote.roundSlug)}`,
        metadata: {
          roundTitle: sanitizeActivityText(vote.roundTitle, 100) || vote.roundTitle,
          submissionTitle:
            sanitizeActivityText(vote.submissionTitle, 100) || vote.submissionTitle,
          voteCount: vote.voteCount,
        },
      })
    ),
  ];
};

const loadNoundryActivity = async (): Promise<ActivityItem[]> =>
  (await listApprovedNoundrySubmissions()).map((submission) => ({
    id: `noundry-submission:${submission.id}`,
    category: "noundry",
    type: "noundry-submission",
    timestamp: submission.createdAt,
    actor: isAddress(submission.artist)
      ? { address: submission.artist }
      : { label: sanitizeActivityText(submission.artist, 80) || "Noundry artist" },
    title: `Submitted "${sanitizeActivityText(submission.title, 90) || "Untitled trait"}" to Noundry`,
    href: `/noundry/traits/${encodeURIComponent(submission.id)}`,
    metadata: {
      traitType: sanitizeActivityText(submission.traitType, 80) || submission.traitType,
    },
  }));

const sourceMessage: Record<ActivitySource, string> = {
  auctions: "Auction activity is temporarily unavailable.",
  rounds: "Round activity is temporarily unavailable.",
  proposals: "Proposal activity is temporarily unavailable.",
  noundry: "Noundry activity is temporarily unavailable.",
};

export const getActivityFeed = async (
  query: ActivityQuery
): Promise<ActivityFeedResponse> => {
  const loaders: Array<[ActivitySource, () => Promise<ActivityItem[]>]> = [
    ["auctions", loadAuctionActivity],
    ["rounds", loadRoundActivity],
    ["proposals", loadProposalActivity],
    ["noundry", loadNoundryActivity],
  ].filter(([source]) => query.category === "all" || query.category === source) as Array<
    [ActivitySource, () => Promise<ActivityItem[]>]
  >;

  const results = await Promise.allSettled(loaders.map(([, loader]) => loader()));
  const items: ActivityItem[] = [];
  const sourceErrors: Partial<Record<ActivitySource, string>> = {};

  results.forEach((result, index) => {
    const source = loaders[index][0];
    if (result.status === "fulfilled") {
      items.push(...result.value);
    } else {
      console.error(`Unable to load ${source} activity`, result.reason);
      sourceErrors[source] = sourceMessage[source];
    }
  });

  const page = paginateActivity({ ...query, items });
  return {
    ...page,
    ...(Object.keys(sourceErrors).length > 0 ? { sourceErrors } : {}),
  };
};
