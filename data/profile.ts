import { Pool } from "pg";
import { GraphQLClient, gql } from "graphql-request";
import type { Address } from "viem";
import { getAddress, isAddress } from "viem";
import { TOKEN_CONTRACT } from "constants/addresses";
import { SUBGRAPH_ENDPOINT } from "constants/urls";
import { getEnsAvatar, getEnsName } from "data/ens";
import {
  listApprovedNoundrySubmissions,
  type NoundrySubmission,
} from "data/noundry/submissions";
import { getAddresses } from "data/nouns-builder/manager";
import {
  getCollectiveNounTokens,
  type ProbeToken,
} from "data/nouns-builder/probe";
import { getProposals, type Proposal } from "data/nouns-builder/governor";
import { getProposalName } from "@/utils/getProposalName";
import {
  normalizeProfileMetadata,
  validateProfileMetadata,
  type NormalizedProfileMetadata,
  type ProfileMetadataInput,
} from "@/utils/profile/identity";
import { getCommunityProjectsForMember } from "@/utils/community-projects";
import type { CommunityProject } from "data/community";
import { listPublicGalleryCoinsByOwner, type GalleryCoin } from "data/coins";
import {
  listProfileRoundSubmissions,
  listProfileRoundVotes,
  type ProfileRoundSubmission,
  type ProfileRoundVote,
} from "data/rounds";

export type ProfileMetadata = NormalizedProfileMetadata & {
  walletAddress: string;
  createdAt: string;
  updatedAt: string;
};

export type ProfileDaoProposal = {
  proposalId: string;
  proposalNumber: number;
  title: string;
  state: number;
  timeCreated: number;
};

export type ProfileDaoVote = {
  proposalId: string;
  proposalNumber: number;
  proposalTitle: string;
  support: number;
  weight: number;
  reason: string;
  timestamp?: string;
};

export type ProfileAuctionBid = {
  id: string;
  tokenId: string;
  tokenName: string;
  tokenImage: string;
  amount: string;
  transactionHash: string;
  createdAt?: string;
  comment?: string;
};

export type ProfileAuctionWin = {
  id: string;
  tokenId: string;
  tokenName: string;
  tokenImage: string;
  amount: string;
  createdAt?: string;
};

export type ProfileActivityItem = {
  id: string;
  type:
    | "noundry-submission"
    | "round-submission"
    | "round-vote"
    | "dao-proposal"
    | "dao-vote"
    | "auction-bid"
    | "auction-win"
    | "community-project"
    | "token";
  title: string;
  href?: string;
  timestamp?: string;
  meta?: string;
  comment?: string;
};

export type PublicProfileData = {
  address: string;
  ensName?: string;
  ensAvatar?: string;
  metadata: ProfileMetadata | null;
  noundrySubmissions: NoundrySubmission[];
  contentCoins: GalleryCoin[];
  ownedTokens: ProbeToken[];
  submittedProposals: ProfileDaoProposal[];
  daoVotes: ProfileDaoVote[];
  auctionBids: ProfileAuctionBid[];
  auctionWins: ProfileAuctionWin[];
  communityProjects: CommunityProject[];
  roundSubmissions: ProfileRoundSubmission[];
  roundVotes: ProfileRoundVote[];
  activity: ProfileActivityItem[];
  errors: Partial<Record<string, string>>;
};

type ProfileVoteRow = {
  voter: string;
  support: number | string;
  weight: number | string;
  reason?: string | null;
  proposal?: {
    timeCreated?: string | number | null;
    voteStart?: string | number | null;
  } | null;
};

type ProfileAuctionBidRow = {
  id: string;
  bidder: string;
  amount: string;
  comment?: string | null;
  bidTime?: string | number | null;
};

type ProfileAuctionRow = {
  id: string;
  winningBid?: ProfileAuctionBidRow | null;
  bids?: ProfileAuctionBidRow[];
};

let pool: Pool | null = null;
let tableReady: Promise<void> | null = null;

const getConnectionString = () =>
  process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;

const getPool = () => {
  const connectionString = getConnectionString();
  if (!connectionString) {
    throw new Error("DATABASE_PUBLIC_URL or DATABASE_URL is required.");
  }

  if (!pool) {
    pool = new Pool({
      connectionString,
      connectionTimeoutMillis: 8000,
      idleTimeoutMillis: 10000,
      max: 2,
      ssl: connectionString.includes("railway.internal")
        ? undefined
        : { rejectUnauthorized: false },
    });
  }

  return pool;
};

const ensureTable = async () => {
  if (!tableReady) {
    tableReady = getPool()
      .query(
        `
          CREATE TABLE IF NOT EXISTS profile_metadata (
            wallet_address text PRIMARY KEY,
            username text NOT NULL DEFAULT '',
            website_url text NOT NULL DEFAULT '',
            farcaster text NOT NULL DEFAULT '',
            twitter text NOT NULL DEFAULT '',
            avatar_url text NOT NULL DEFAULT '',
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
          )
        `
      )
      .then(() =>
        getPool().query(`
          ALTER TABLE profile_metadata
            ADD COLUMN IF NOT EXISTS avatar_url text NOT NULL DEFAULT ''
        `)
      )
      .then(() => undefined);
  }

  return tableReady;
};

const formatDate = (value?: Date | string | null) =>
  value
    ? value instanceof Date
      ? value.toISOString()
      : new Date(value).toISOString()
    : "";

const mapMetadata = (row: Record<string, any>): ProfileMetadata => ({
  walletAddress: row.wallet_address,
  username: row.username || "",
  websiteUrl: row.website_url || "",
  farcaster: row.farcaster || "",
  twitter: row.twitter || "",
  avatarUrl: row.avatar_url || "",
  createdAt: formatDate(row.created_at),
  updatedAt: formatDate(row.updated_at),
});

export const getProfileMetadata = async (address: string) => {
  await ensureTable();

  const result = await getPool().query(
    `
      SELECT wallet_address, username, website_url, farcaster, twitter, avatar_url, created_at, updated_at
      FROM profile_metadata
      WHERE lower(wallet_address) = lower($1)
      LIMIT 1
    `,
    [getAddress(address)]
  );

  return result.rows[0] ? mapMetadata(result.rows[0]) : null;
};

export const listProfileMetadata = async (addresses: string[]) => {
  const normalizedAddresses = Array.from(
    new Set(
      addresses
        .filter((address) => isAddress(address))
        .map((address) => getAddress(address))
    )
  );

  if (normalizedAddresses.length === 0) return [];

  await ensureTable();

  const result = await getPool().query(
    `
      SELECT wallet_address, username, website_url, farcaster, twitter, avatar_url, created_at, updated_at
      FROM profile_metadata
      WHERE lower(wallet_address) = ANY($1::text[])
    `,
    [normalizedAddresses.map((address) => address.toLowerCase())]
  );

  return result.rows.map(mapMetadata);
};

export const saveProfileMetadata = async ({
  address,
  input,
}: {
  address: string;
  input: ProfileMetadataInput;
}) => {
  const validationError = validateProfileMetadata(input);
  if (validationError) throw new Error(validationError);

  await ensureTable();

  const normalizedAddress = getAddress(address);
  const normalizedInput = normalizeProfileMetadata(input);
  const result = await getPool().query(
    `
      INSERT INTO profile_metadata (
        wallet_address,
        username,
        website_url,
        farcaster,
        twitter,
        avatar_url
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (wallet_address) DO UPDATE
      SET username = EXCLUDED.username,
          website_url = EXCLUDED.website_url,
          farcaster = EXCLUDED.farcaster,
          twitter = EXCLUDED.twitter,
          avatar_url = EXCLUDED.avatar_url,
          updated_at = now()
      RETURNING wallet_address, username, website_url, farcaster, twitter, avatar_url, created_at, updated_at
    `,
    [
      normalizedAddress,
      normalizedInput.username,
      normalizedInput.websiteUrl,
      normalizedInput.farcaster,
      normalizedInput.twitter,
      normalizedInput.avatarUrl,
    ]
  );

  return mapMetadata(result.rows[0]);
};

const proposalVotesQuery = gql`
  query profileProposalVotes($proposalId: String!) {
    proposalVotes(first: 1000, where: { proposal: $proposalId }) {
      voter
      support
      weight
      reason
      proposal {
        timeCreated
        voteStart
      }
    }
  }
`;

const profileAuctionActivityQuery = gql`
  query profileAuctionActivity($tokenAddress: String!) {
    daos(first: 1, where: { tokenAddress: $tokenAddress }) {
      auctions(first: 1000, orderBy: endTime, orderDirection: desc) {
        id
        winningBid {
          id
          bidder
          amount
          bidTime
        }
        bids(orderBy: bidTime, orderDirection: desc) {
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

const normalizeSupport = (value: number | string) => {
  if (typeof value === "number") return value;

  const numericValue = Number(value);
  if (Number.isFinite(numericValue)) return numericValue;

  switch (value.toLowerCase()) {
    case "against":
      return 0;
    case "for":
      return 1;
    case "abstain":
      return 2;
    default:
      return 2;
  }
};

const getProposalVotes = async (proposalId: string) => {
  const client = new GraphQLClient(SUBGRAPH_ENDPOINT);
  const data = await client.request<{ proposalVotes?: ProfileVoteRow[] }>(
    proposalVotesQuery,
    { proposalId: proposalId.toLowerCase() }
  );

  return (data.proposalVotes || []).map((vote) => ({
    voter: vote.voter,
    support: normalizeSupport(vote.support),
    weight: Number(vote.weight || 0),
    reason: vote.reason || "",
    timestamp: getTimestampFromBidTime(
      vote.proposal?.voteStart || vote.proposal?.timeCreated
    ),
  }));
};

const settled = async <T>(
  label: string,
  task: Promise<T>,
  errors: Partial<Record<string, string>>,
  fallback: T
) => {
  try {
    return await task;
  } catch (error) {
    console.warn(`Unable to load profile ${label}`, error);
    errors[label] = `Unable to load ${label}.`;
    return fallback;
  }
};

const getNoundrySubmissionsForAddress = async (address: string) => {
  const submissions = await listApprovedNoundrySubmissions();
  return submissions.filter(
    (submission) =>
      isAddress(submission.artist) &&
      getAddress(submission.artist) === getAddress(address)
  );
};

const getOwnedTokensForAddress = async (address: string) => {
  const { tokens } = await getCollectiveNounTokens();
  const normalizedAddress = getAddress(address);

  return tokens.filter(
    (token) =>
      token.owner &&
      isAddress(token.owner) &&
      getAddress(token.owner) === normalizedAddress
  );
};

export const getFirstOwnedCollectiveNounImage = async (address: string) => {
  const ownedTokens = await getOwnedTokensForAddress(address);

  return (
    [...ownedTokens]
      .filter((token) => token.image)
      .sort((first, second) => first.id - second.id)[0]?.image || ""
  );
};

const getDaoActivityForAddress = async (address: string) => {
  const normalizedAddress = getAddress(address);
  const addresses = await getAddresses({
    tokenAddress: TOKEN_CONTRACT as Address,
  });
  const proposals = await getProposals({ address: addresses.governor });
  const submittedProposals = proposals
    .filter(
      (proposal) =>
        isAddress(proposal.proposal.proposer) &&
        getAddress(proposal.proposal.proposer) === normalizedAddress
    )
    .map(mapProposal);

  const votes = (
    await Promise.all(
      proposals.map(async (proposal) => {
        const proposalVotes = await getProposalVotes(proposal.proposalId);
        return proposalVotes
          .filter(
            (vote) =>
              isAddress(vote.voter) &&
              getAddress(vote.voter) === normalizedAddress
          )
          .map((vote) => ({
            proposalId: proposal.proposalId,
            proposalNumber: proposal.proposalNumber,
            proposalTitle: getProposalName(proposal.description),
            support: vote.support,
            weight: vote.weight,
            reason: vote.reason,
            timestamp: vote.timestamp,
          }));
      })
    )
  ).flat();

  return { submittedProposals, daoVotes: votes };
};

const getTokenIdFromAuctionId = (id: string) => {
  const rawId = id.split(":").pop() || id;
  const tokenId = Number(rawId);

  return Number.isFinite(tokenId) ? String(tokenId) : rawId;
};

const getTimestampFromBidTime = (bidTime?: string | number | null) => {
  if (bidTime === undefined || bidTime === null || bidTime === "")
    return undefined;

  const seconds = Number(bidTime);
  if (!Number.isFinite(seconds)) return undefined;

  return new Date(seconds * 1000).toISOString();
};

const getTransactionHashFromBidId = (id: string) => id.split(":")[0] || id;

const getAuctionActivityForAddress = async (address: string) => {
  const normalizedAddress = getAddress(address);
  const client = new GraphQLClient(SUBGRAPH_ENDPOINT);
  const [data, tokenData] = await Promise.all([
    client.request<{
      daos?: { auctions?: ProfileAuctionRow[] }[];
    }>(profileAuctionActivityQuery, {
      tokenAddress: TOKEN_CONTRACT.toLowerCase(),
    }),
    getCollectiveNounTokens().catch(() => ({ tokens: [] as ProbeToken[] })),
  ]);
  const auctions = data.daos?.[0]?.auctions || [];
  const tokenById = new Map(
    tokenData.tokens.map((token) => [String(token.id), token])
  );
  const getTokenMeta = (tokenId: string) => {
    const token = tokenById.get(tokenId);

    return {
      tokenName: token?.name || `Collective Nouns #${tokenId}`,
      tokenImage: token?.image || "",
    };
  };
  const auctionBids = auctions
    .flatMap((auction) =>
      (auction.bids || []).map((bid) => ({
        auction,
        bid,
      }))
    )
    .filter(
      ({ bid }) =>
        isAddress(bid.bidder) && getAddress(bid.bidder) === normalizedAddress
    )
    .map(({ auction, bid }) => {
      const tokenId = getTokenIdFromAuctionId(auction.id);

      return {
        id: `auction-bid-${bid.id}`,
        tokenId,
        ...getTokenMeta(tokenId),
        amount: bid.amount,
        transactionHash: getTransactionHashFromBidId(bid.id),
        comment: bid.comment?.trim() || undefined,
        createdAt: getTimestampFromBidTime(bid.bidTime),
      };
    });
  const auctionWins = auctions
    .filter(
      (auction) =>
        auction.winningBid?.bidder &&
        isAddress(auction.winningBid.bidder) &&
        getAddress(auction.winningBid.bidder) === normalizedAddress
    )
    .map((auction) => {
      const tokenId = getTokenIdFromAuctionId(auction.id);

      return {
        id: `auction-win-${auction.id}`,
        tokenId,
        ...getTokenMeta(tokenId),
        amount: auction.winningBid?.amount || "0",
        createdAt: getTimestampFromBidTime(auction.winningBid?.bidTime),
      };
    });

  return { auctionBids, auctionWins };
};

const mapProposal = (proposal: Proposal): ProfileDaoProposal => ({
  proposalId: proposal.proposalId,
  proposalNumber: proposal.proposalNumber,
  title: getProposalName(proposal.description),
  state: proposal.state,
  timeCreated: proposal.proposal.timeCreated,
});

const buildActivity = ({
  noundrySubmissions,
  roundSubmissions,
  roundVotes,
  submittedProposals,
  daoVotes,
  auctionBids,
  auctionWins,
  ownedTokens,
  communityProjects,
}: Pick<
  PublicProfileData,
  | "noundrySubmissions"
  | "roundSubmissions"
  | "roundVotes"
  | "submittedProposals"
  | "daoVotes"
  | "auctionBids"
  | "auctionWins"
  | "ownedTokens"
  | "communityProjects"
>) => {
  const activity: ProfileActivityItem[] = [
    ...noundrySubmissions.map((submission) => ({
      id: `noundry-${submission.id}`,
      type: "noundry-submission" as const,
      title: `Submitted ${submission.title} to Noundry`,
      href: `/noundry/traits/${submission.id}`,
      timestamp: submission.createdAt,
      meta: submission.traitType,
    })),
    ...roundSubmissions.map((submission) => ({
      id: `round-submission-${submission.id}`,
      type: "round-submission" as const,
      title: `Submitted ${submission.title}`,
      href: `/rounds/${submission.roundSlug}`,
      timestamp: submission.createdAt,
      meta: submission.roundTitle,
    })),
    ...roundVotes.map((vote) => ({
      id: `round-vote-${vote.id}`,
      type: "round-vote" as const,
      title: `Cast ${vote.voteCount} vote${vote.voteCount === 1 ? "" : "s"}`,
      href: `/rounds/${vote.roundSlug}`,
      timestamp: vote.updatedAt || vote.createdAt,
      meta: `${vote.roundTitle}: ${vote.submissionTitle}`,
    })),
    ...submittedProposals.map((proposal) => ({
      id: `dao-proposal-${proposal.proposalId}`,
      type: "dao-proposal" as const,
      title: `Created proposal: ${proposal.title}`,
      href: `/proposals/${proposal.proposalNumber}`,
      timestamp: proposal.timeCreated
        ? new Date(proposal.timeCreated * 1000).toISOString()
        : undefined,
    })),
    ...daoVotes.map((vote) => ({
      id: `dao-vote-${vote.proposalId}`,
      type: "dao-vote" as const,
      title: `Voted ${supportLabel(vote.support)}`,
      href: `/proposals/${vote.proposalNumber}`,
      timestamp: vote.timestamp,
      meta: vote.proposalTitle,
    })),
    ...auctionBids.map((bid) => ({
      id: bid.id,
      type: "auction-bid" as const,
      title: `Bid on Collective Nouns #${bid.tokenId}`,
      href: `/?tokenid=${bid.tokenId}`,
      timestamp: bid.createdAt,
      meta: bid.amount,
      comment: bid.comment,
    })),
    ...auctionWins.map((win) => ({
      id: win.id,
      type: "auction-win" as const,
      title: `Won Collective Nouns #${win.tokenId}`,
      href: `/?tokenid=${win.tokenId}`,
      timestamp: win.createdAt,
      meta: win.amount,
    })),
    ...communityProjects.map((project) => ({
      id: `community-project-${project.slug}`,
      type: "community-project" as const,
      title: `Contributed to ${project.title}`,
      href: `/projects/${project.slug}`,
      timestamp: project.date,
      meta: project.category,
    })),
    ...ownedTokens.map((token) => ({
      id: `token-${token.id}`,
      type: "token" as const,
      title: `Owns ${token.name}`,
      href: `/?tokenid=${token.id}`,
      meta: "Collective Noun",
    })),
  ];

  return activity.sort((first, second) => {
    const firstTime = first.timestamp ? new Date(first.timestamp).getTime() : 0;
    const secondTime = second.timestamp
      ? new Date(second.timestamp).getTime()
      : 0;
    return secondTime - firstTime;
  });
};

const supportLabel = (support: number) => {
  if (support === 0) return "against";
  if (support === 1) return "for";
  return "abstain";
};

export const getPublicProfileData = async (
  address: string
): Promise<PublicProfileData> => {
  const normalizedAddress = getAddress(address);
  const errors: Partial<Record<string, string>> = {};
  const identity = await Promise.all([
    settled("ENS name", getEnsName({ address: normalizedAddress }), errors, {}),
    settled(
      "ENS avatar",
      getEnsAvatar({ address: normalizedAddress }),
      errors,
      {}
    ),
  ]);

  const [
    metadata,
    noundrySubmissions,
    contentCoins,
    ownedTokens,
    roundSubmissions,
    roundVotes,
    daoActivity,
    auctionActivity,
    communityProjects,
  ] = await Promise.all([
    settled(
      "profile metadata",
      getProfileMetadata(normalizedAddress),
      errors,
      null
    ),
    settled(
      "Noundry submissions",
      getNoundrySubmissionsForAddress(normalizedAddress),
      errors,
      []
    ),
    settled(
      "content coins",
      listPublicGalleryCoinsByOwner(normalizedAddress),
      errors,
      []
    ),
    settled(
      "owned tokens",
      getOwnedTokensForAddress(normalizedAddress),
      errors,
      []
    ),
    settled(
      "round submissions",
      listProfileRoundSubmissions(normalizedAddress),
      errors,
      []
    ),
    settled(
      "round votes",
      listProfileRoundVotes(normalizedAddress),
      errors,
      []
    ),
    settled(
      "DAO activity",
      getDaoActivityForAddress(normalizedAddress),
      errors,
      { submittedProposals: [], daoVotes: [] }
    ),
    settled(
      "auction activity",
      getAuctionActivityForAddress(normalizedAddress),
      errors,
      { auctionBids: [], auctionWins: [] }
    ),
    settled(
      "community projects",
      getCommunityProjectsForMember(normalizedAddress),
      errors,
      []
    ),
  ]);

  return {
    address: normalizedAddress,
    ensName: identity[0].ensName,
    ensAvatar: identity[1].ensAvatar,
    metadata,
    noundrySubmissions,
    contentCoins,
    ownedTokens,
    submittedProposals: daoActivity.submittedProposals,
    daoVotes: daoActivity.daoVotes,
    auctionBids: auctionActivity.auctionBids,
    auctionWins: auctionActivity.auctionWins,
    communityProjects,
    roundSubmissions,
    roundVotes,
    activity: buildActivity({
      noundrySubmissions,
      roundSubmissions,
      roundVotes,
      submittedProposals: daoActivity.submittedProposals,
      daoVotes: daoActivity.daoVotes,
      auctionBids: auctionActivity.auctionBids,
      auctionWins: auctionActivity.auctionWins,
      ownedTokens,
      communityProjects,
    }),
    errors,
  };
};
