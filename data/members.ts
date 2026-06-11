import { shortenWalletAddress } from "@/utils/profile/identity";
import { getEnsNamesForAddresses } from "data/ens";
import { getCollectiveNounTokens, type ProbeToken } from "data/nouns-builder/probe";
import { countApprovedNoundrySubmissionsByArtists } from "data/noundry/submissions";
import { listProfileMetadata, type ProfileMetadata } from "data/profile";
import { TOKEN_CONTRACT, TOKEN_NETWORK } from "constants/addresses";
import { SUBGRAPH_ENDPOINT } from "constants/urls";
import { GraphQLClient, gql } from "graphql-request";
import { getAddress, isAddress } from "viem";

export type DaoMemberSummary = {
  address: string;
  displayName: string;
  ensName: string | null;
  username: string | null;
  avatarUrl: string | null;
  firstTokenId: number;
  firstTokenName: string;
  firstTokenImage: string;
  tokenCount: number;
  votingPower: number;
};

export type DaoMember = DaoMemberSummary & {
  noundrySubmissionCount: number;
  proposalVoteCount: number;
};

type ProposalVoteRow = {
  voter: string;
  proposal?: {
    proposalId?: string | null;
  } | null;
};

type DaoProposalRow = {
  proposalId: string;
};

const BURNER_ADDRESSES = new Set([
  "0x0000000000000000000000000000000000000000",
  "0x000000000000000000000000000000000000dead",
]);

const membersListUrl = `https://nouns.build/api/membersList/${TOKEN_CONTRACT}?chainId=${TOKEN_NETWORK}`;

const getNumber = (value: unknown): number => {
  if (Array.isArray(value)) return value.length;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const getMemberAddress = (item: Record<string, unknown>) =>
  String(
    item.address ||
      item.delegate ||
      item.voter ||
      item.wallet ||
      item.owner ||
      item.id ||
      ""
  );

const getVotingPowerByAddress = async (addresses: string[]) => {
  const requestedAddresses = new Set(
    addresses.map((address) => address.toLowerCase())
  );
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(membersListUrl, { signal: controller.signal });
    if (!response.ok) return new Map<string, number>();

    const payload = await response.json();
    const data = payload as {
      members?: unknown[];
      membersList?: unknown[];
      delegates?: unknown[];
    };
    const members = Array.isArray(payload)
      ? payload
      : data.membersList || data.members || data.delegates || [];
    const votingPowerByAddress = new Map<string, number>();

    members.forEach((member) => {
      const item = member as Record<string, unknown>;
      const address = getMemberAddress(item);
      if (!isAddress(address)) return;

      const normalizedAddress = getAddress(address).toLowerCase();
      if (!requestedAddresses.has(normalizedAddress)) return;

      votingPowerByAddress.set(
        normalizedAddress,
        getNumber(
          item.votes ??
            item.votingPower ??
            item.tokenCount ??
            item.tokens ??
            item.balance
        )
      );
    });

    return votingPowerByAddress;
  } catch (error) {
    console.warn("Unable to load member voting power", error);
    return new Map<string, number>();
  } finally {
    clearTimeout(timeout);
  }
};

const getMetadataByAddress = async (addresses: string[]) => {
  try {
    const metadata = await listProfileMetadata(addresses);

    return new Map(
      metadata.map((profile) => [profile.walletAddress.toLowerCase(), profile])
    );
  } catch (error) {
    console.warn("Unable to load member profile metadata", error);
    return new Map<string, ProfileMetadata>();
  }
};

const getEarliestToken = (tokens: ProbeToken[]) =>
  [...tokens].sort((first, second) => first.id - second.id)[0];

const hasPrimaryEthName = (member: DaoMemberSummary) =>
  Boolean(member.ensName?.toLowerCase().endsWith(".eth"));

const sortMemberSummaries = <T extends DaoMemberSummary>(members: T[]) =>
  members.sort((first, second) => {
    const firstHasEthName = hasPrimaryEthName(first);
    const secondHasEthName = hasPrimaryEthName(second);

    if (firstHasEthName !== secondHasEthName) {
      return firstHasEthName ? -1 : 1;
    }

    if (firstHasEthName && secondHasEthName && first.ensName && second.ensName) {
      return first.ensName.localeCompare(second.ensName);
    }

    return first.displayName.localeCompare(second.displayName);
  });

const proposalVotesByVoterQuery = gql`
  query proposalVotesByVoter(
    $voters: [String!]
    $proposalIds: [String!]
    $skip: Int!
  ) {
    proposalVotes(
      first: 1000
      skip: $skip
      where: { voter_in: $voters, proposal_in: $proposalIds }
    ) {
      voter
      proposal {
        proposalId
      }
    }
  }
`;

const daoProposalIdsQuery = gql`
  query daoProposalIds($tokenAddress: String!) {
    daos(first: 1, where: { tokenAddress: $tokenAddress }) {
      proposals(first: 1000) {
        proposalId
      }
    }
  }
`;

const chunk = <T,>(items: T[], size: number) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, index * size + size)
  );

const getDaoProposalIds = async (client: GraphQLClient) => {
  const response = await client.request<{
    daos?: { proposals?: DaoProposalRow[] }[];
  }>(daoProposalIdsQuery, {
    tokenAddress: TOKEN_CONTRACT.toLowerCase(),
  });

  return (response.daos?.[0]?.proposals || [])
    .map((proposal) => proposal.proposalId)
    .filter(Boolean);
};

const getProposalVoteCountsByVoter = async (addresses: string[]) => {
  const counts = new Map<string, Set<string>>();
  const client = new GraphQLClient(SUBGRAPH_ENDPOINT);

  try {
    const proposalIds = await getDaoProposalIds(client);
    if (proposalIds.length === 0) return new Map<string, number>();

    for (const addressBatch of chunk(addresses, 100)) {
      let skip = 0;

      while (true) {
        const response = await client.request<{
          proposalVotes?: ProposalVoteRow[];
        }>(proposalVotesByVoterQuery, {
          voters: addressBatch,
          proposalIds,
          skip,
        });
        const votes = response.proposalVotes || [];

        votes.forEach((vote) => {
          if (!vote.voter || !isAddress(vote.voter)) return;

          const voter = getAddress(vote.voter).toLowerCase();
          const proposalId = vote.proposal?.proposalId || "";
          if (!proposalId) return;

          if (!counts.has(voter)) counts.set(voter, new Set());
          counts.get(voter)?.add(proposalId);
        });

        if (votes.length < 1000) break;
        skip += 1000;
      }
    }
  } catch (error) {
    console.warn("Unable to load member proposal vote counts", error);
  }

  return new Map(
    Array.from(counts.entries()).map(([address, proposalIds]) => [
      address,
      proposalIds.size,
    ])
  );
};

export const getDaoMembers = async (): Promise<DaoMember[]> => {
  const memberSummaries = await getDaoMemberSummaries();
  const addresses = memberSummaries.map((member) => member.address.toLowerCase());
  const [noundrySubmissionCounts, proposalVoteCounts] = await Promise.all([
    countApprovedNoundrySubmissionsByArtists(addresses).catch((error) => {
      console.warn("Unable to load member Noundry counts", error);
      return new Map<string, number>();
    }),
    getProposalVoteCountsByVoter(addresses),
  ]);

  return memberSummaries.map((member) => {
    const address = member.address.toLowerCase();

    return {
      ...member,
      noundrySubmissionCount: noundrySubmissionCounts.get(address) || 0,
      proposalVoteCount: proposalVoteCounts.get(address) || 0,
    };
  });
};

export const getDaoMemberSummaries = async (): Promise<DaoMemberSummary[]> => {
  const { tokens } = await getCollectiveNounTokens();
  const tokensByOwner = new Map<string, ProbeToken[]>();

  tokens.forEach((token) => {
    if (!token.owner || !isAddress(token.owner)) return;

    const owner = getAddress(token.owner);
    if (BURNER_ADDRESSES.has(owner.toLowerCase())) return;

    const key = owner.toLowerCase();
    tokensByOwner.set(key, [...(tokensByOwner.get(key) || []), token]);
  });

  const addresses = Array.from(tokensByOwner.keys());
  const [ensNames, metadataByAddress, votingPowerByAddress] = await Promise.all([
    getEnsNamesForAddresses(addresses),
    getMetadataByAddress(addresses),
    getVotingPowerByAddress(addresses),
  ]);

  return sortMemberSummaries(
    addresses.map((address) => {
      const ownerTokens = tokensByOwner.get(address) || [];
      const firstToken = getEarliestToken(ownerTokens);
      const metadata = metadataByAddress.get(address);
      const ensName = ensNames[address] || null;
      const username = metadata?.username?.trim() || undefined;
      const displayName =
        ensName || username || shortenWalletAddress(getAddress(address));

      return {
        address: getAddress(address),
        displayName,
        ensName,
        username: username || null,
        avatarUrl: metadata?.avatarUrl?.trim() || null,
        firstTokenId: firstToken?.id || 0,
        firstTokenName:
          firstToken?.name || `Collective Noun #${firstToken?.id || "0"}`,
        firstTokenImage: firstToken?.image || "",
        tokenCount: ownerTokens.length,
        votingPower: votingPowerByAddress.get(address) ?? ownerTokens.length,
      };
    })
  );
};
