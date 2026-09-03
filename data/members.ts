import { shortenWalletAddress } from "@/utils/profile/identity";
import DefaultProvider from "@/utils/DefaultProvider";
import { Contract } from "@/utils/ethers-compat";
import { getEnsNamesForAddresses } from "data/ens";
import {
  getCollectiveNounTokensByIds,
  type ProbeToken,
} from "data/nouns-builder/probe";
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

type MemberSeed = {
  address: string;
  tokenIds: number[];
  tokenCount: number;
};

type NounsBuilderMember = {
  voter?: string;
  tokens?: number[];
  tokenCount?: number;
};

const BURNER_ADDRESSES = new Set([
  "0x0000000000000000000000000000000000000000",
  "0x000000000000000000000000000000000000dead",
]);

const votingPowerAbi = [
  "function getVotes(address account) view returns (uint256)",
];

const MEMBER_SOURCE_TIMEOUT_MS = 5_000;
const MEMBER_ENRICHMENT_TIMEOUT_MS = 6_000;

const withTimeoutFallback = async <T,>(
  label: string,
  promise: Promise<T>,
  fallback: T,
  timeoutMs = MEMBER_ENRICHMENT_TIMEOUT_MS
): Promise<T> => {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error(`${label} timed out.`)),
          timeoutMs
        );
      }),
    ]);
  } catch (error) {
    console.warn(`Unable to load ${label}`, error);
    return fallback;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
};

const getMemberSeeds = async (): Promise<MemberSeed[]> => {
  const membersListUrl = `https://nouns.build/api/membersList/${TOKEN_CONTRACT}?chainId=${TOKEN_NETWORK}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MEMBER_SOURCE_TIMEOUT_MS);

  try {
    const response = await fetch(membersListUrl, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Nouns Builder member list returned ${response.status}.`);
    }

    const payload = (await response.json()) as {
      membersList?: NounsBuilderMember[];
    };
    const seeds = (payload.membersList || [])
      .map((member): MemberSeed | null => {
        if (!member.voter || !isAddress(member.voter)) return null;

        const address = getAddress(member.voter);
        if (BURNER_ADDRESSES.has(address.toLowerCase())) return null;

        const tokenIds = (member.tokens || [])
          .map(Number)
          .filter((tokenId) => Number.isSafeInteger(tokenId) && tokenId >= 0)
          .sort((first, second) => first - second);

        return {
          address,
          tokenIds,
          tokenCount: Number(member.tokenCount ?? tokenIds.length),
        };
      })
      .filter((member): member is MemberSeed => Boolean(member));

    if (seeds.length === 0) {
      throw new Error("Nouns Builder member list returned no valid holders.");
    }

    return seeds;
  } finally {
    clearTimeout(timeout);
  }
};

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

const getMemberVotingPowerByAddress = async (
  addresses: string[],
  fallbackVotingPower: Map<string, number>
) => {
  const contractVotingPower = await getVotingPowerByAddress(addresses);

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
    withTimeoutFallback(
      "member Noundry counts",
      countApprovedNoundrySubmissionsByArtists(addresses),
      new Map<string, number>()
    ),
    withTimeoutFallback(
      "member proposal vote counts",
      getProposalVoteCountsByVoter(addresses),
      new Map<string, number>()
    ),
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
  const memberSeeds = await getMemberSeeds();
  const addresses = memberSeeds.map((member) => member.address.toLowerCase());
  // Token ownership is not voting power: holders can delegate their votes away.
  // If the contract reads time out, retain the members but leave power at zero.
  const fallbackVotingPower = new Map<string, number>();
  const firstTokenIds = memberSeeds
    .map((member) => member.tokenIds[0])
    .filter((tokenId): tokenId is number => tokenId !== undefined);
  const [ensNames, metadataByAddress, votingPowerByAddress, firstTokens] =
    await Promise.all([
      withTimeoutFallback(
        "member ENS names",
        getEnsNamesForAddresses(addresses),
        {} as Record<string, string>
      ),
      withTimeoutFallback(
        "member profile metadata",
        getMetadataByAddress(addresses),
        new Map<string, ProfileMetadata>()
      ),
      withTimeoutFallback(
        "member voting power",
        getMemberVotingPowerByAddress(addresses, fallbackVotingPower),
        fallbackVotingPower
      ),
      withTimeoutFallback(
        "member token artwork",
        getCollectiveNounTokensByIds(firstTokenIds),
        [] as ProbeToken[]
      ),
  ]);
  const firstTokensById = new Map(firstTokens.map((token) => [token.id, token]));

  return sortMemberSummaries(
    memberSeeds.map((member) => {
      const address = member.address.toLowerCase();
      const firstTokenId = member.tokenIds[0] ?? 0;
      const firstToken = firstTokensById.get(firstTokenId);
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
        firstTokenId,
        firstTokenName:
          firstToken?.name || `Collective Noun #${firstTokenId}`,
        firstTokenImage: firstToken?.image || "",
        tokenCount: member.tokenCount,
        votingPower: votingPowerByAddress.get(address) ?? 0,
      };
    })
  );
};
