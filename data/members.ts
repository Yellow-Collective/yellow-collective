import { shortenWalletAddress } from "@/utils/profile/identity";
import DefaultProvider from "@/utils/DefaultProvider";
import { Contract } from "@/utils/ethers-compat";
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

const votingPowerAbi = [
  "function getVotes(address account) view returns (uint256)",
];

const getVotingPowerByAddress = async (addresses: string[]) => {
  const contract = new Contract(TOKEN_CONTRACT, votingPowerAbi, DefaultProvider);
  const entries: (readonly [string, number] | null)[] = [];

  for (const addressBatch of chunk(addresses, 25)) {
    entries.push(
      ...(await Promise.all(
        addressBatch.map(async (address) => {
          try {
            const normalizedAddress = getAddress(address);
            const votes = await contract.getVotes(normalizedAddress);

            return [
              normalizedAddress.toLowerCase(),
              Number(votes.toString()),
            ] as const;
          } catch (error) {
            console.warn(`Unable to load voting power for ${address}`, error);
            return null;
          }
        })
      ))
    );
  }

  return new Map(
    entries.filter(
      (entry): entry is readonly [string, number] => Boolean(entry)
    )
  );
};

const getFallbackVotingPowerByAddress = async () => {
  const membersListUrl = `https://nouns.build/api/membersList/${TOKEN_CONTRACT}?chainId=${TOKEN_NETWORK}`;

  try {
    const response = await fetch(membersListUrl);
    if (!response.ok) return new Map<string, number>();

    const payload = (await response.json()) as {
      membersList?: { voter?: string; tokenCount?: number }[];
    };

    return new Map(
      (payload.membersList || [])
        .map((member) => {
          if (!member.voter || !isAddress(member.voter)) return null;
          return [
            getAddress(member.voter).toLowerCase(),
            Number(member.tokenCount || 0),
          ] as const;
        })
        .filter(
          (entry): entry is readonly [string, number] => Boolean(entry)
        )
    );
  } catch (error) {
    console.warn("Unable to load fallback member voting power", error);
    return new Map<string, number>();
  }
};

const getMemberVotingPowerByAddress = async (addresses: string[]) => {
  const [contractVotingPower, fallbackVotingPower] = await Promise.all([
    getVotingPowerByAddress(addresses),
    getFallbackVotingPowerByAddress(),
  ]);

  return new Map(
    addresses.map((address) => {
      try {
        const normalizedAddress = getAddress(address);
        const key = normalizedAddress.toLowerCase();

        return [
          key,
          contractVotingPower.get(key) ?? fallbackVotingPower.get(key) ?? 0,
        ] as const;
      } catch (error) {
        console.warn(`Unable to normalize member voting power for ${address}`, error);
        return [address.toLowerCase(), 0] as const;
      }
    })
  );
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
    getMemberVotingPowerByAddress(addresses),
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
        votingPower: votingPowerByAddress.get(address) ?? 0,
      };
    })
  );
};
