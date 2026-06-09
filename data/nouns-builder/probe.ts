import { TOKEN_CONTRACT } from "constants/addresses";
import { IPFS_GATEWAY, SUBGRAPH_ENDPOINT } from "constants/urls";
import DefaultProvider from "@/utils/DefaultProvider";
import getNormalizedURI from "@/utils/getNormalizedURI";
import { BigNumber, ethers } from "@/utils/ethers-compat";
import { GraphQLClient, gql } from "graphql-request";

type TokenAttribute = {
  trait_type?: string;
  traitType?: string;
  value?: string | number;
};

type TokenMetadata = {
  name?: string;
  description?: string;
  image?: string;
  attributes?: TokenAttribute[];
};

export type ProbeToken = {
  id: number;
  name: string;
  image: string;
  owner?: string;
  ownerEns?: string;
  attributes: Record<string, string>;
};

export type ProbeTraitOption = {
  trait: string;
  values: string[];
};

export type ProbeTokenResponse = {
  tokens: ProbeToken[];
  traitOptions: ProbeTraitOption[];
  totalSupply: number;
};

const tokenAbi = [
  "function totalSupply() view returns (uint256)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function ownerOf(uint256 tokenId) view returns (address)",
];

const tokenContract = new ethers.Contract(
  TOKEN_CONTRACT,
  tokenAbi,
  DefaultProvider
);

type SubgraphToken = {
  id: string;
  name?: string;
  image?: string;
  owner?: string;
  ownerEns?: string;
};

const tokensQuery = gql`
  query probeTokens($tokenAddress: String!, $skip: Int!) {
    daos(first: 1, where: { tokenAddress: $tokenAddress }) {
      tokens(first: 1000, skip: $skip) {
        id
        name
        image
        owner
      }
    }
  }
`;

const BURNER_ADDRESSES = new Set([
  "0x0000000000000000000000000000000000000000",
  "0x000000000000000000000000000000000000dead",
]);

const normalizeImageUri = (uri?: string) => {
  if (!uri) return "";

  if (uri.startsWith("data:")) return uri;

  return getNormalizedURI(uri, {
    preferredIPFSGateway: IPFS_GATEWAY,
  });
};

const parseTokenUri = (tokenUri: string): TokenMetadata => {
  if (!tokenUri) return {};

  if (tokenUri.startsWith("data:application/json;base64,")) {
    const encoded = tokenUri.replace("data:application/json;base64,", "");
    return JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
  }

  if (tokenUri.startsWith("data:application/json,")) {
    return JSON.parse(
      decodeURIComponent(tokenUri.replace("data:application/json,", ""))
    );
  }

  throw new Error("Unsupported token metadata URI.");
};

const normalizeTraitName = (value: string) =>
  value.replace(/^\d+[-_ ]*/, "").replace(/[-_]+/g, " ").trim();

const filenameToDisplayName = (value: string) =>
  value
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const getAttributesFromImageUrl = (image?: string) => {
  if (!image) return {};

  try {
    const url = new URL(image);
    const imageLayers = url.searchParams.getAll("images");

    return Object.fromEntries(
      imageLayers
        .map((layer) => {
          const match = decodeURIComponent(layer).match(
            /(?:^|\/)\d+-([^/]+)\/([^/]+)$/i
          );

          if (!match) return undefined;

          return [
            normalizeTraitName(match[1]),
            filenameToDisplayName(match[2]),
          ] as const;
        })
        .filter((entry): entry is readonly [string, string] => Boolean(entry))
    );
  } catch {
    return {};
  }
};

const getTokenFromId = async (id: number): Promise<ProbeToken | null> => {
  try {
    const [tokenUri, owner] = await Promise.all([
      tokenContract.tokenURI(id),
      tokenContract.ownerOf(id).catch(() => undefined),
    ]);
    const metadata = parseTokenUri(tokenUri);
    const attributes = Object.fromEntries(
      (metadata.attributes || [])
        .map((attribute) => {
          const trait = normalizeTraitName(
            String(attribute.trait_type || attribute.traitType || "")
          );
          const value = String(attribute.value ?? "").trim();

          return trait && value ? [trait, value] : undefined;
        })
        .filter((entry): entry is [string, string] => Boolean(entry))
    );

    return {
    id,
    name: metadata.name || `Collective Noun ${id}`,
    image: normalizeImageUri(metadata.image),
    owner,
    ownerEns: undefined,
    attributes,
  };
  } catch (error) {
    console.warn(`Unable to load Collective Noun ${id}`, error);
    return null;
  }
};

const getTokenIds = async () => {
  const totalSupply = Number(
    BigNumber.from(await tokenContract.totalSupply()).toString()
  );
  const zeroIndexedIds = Array.from({ length: totalSupply }, (_, id) => id);
  const oneIndexedIds = Array.from({ length: totalSupply }, (_, id) => id + 1);

  return { totalSupply, zeroIndexedIds, oneIndexedIds };
};

const getTokenIdFromSubgraphId = (id: string) => {
  const rawId = id.split(":").pop() || id;
  const tokenId = Number(rawId);

  return Number.isFinite(tokenId) ? tokenId : 0;
};

const mapSubgraphToken = (token: SubgraphToken): ProbeToken => {
  const id = getTokenIdFromSubgraphId(token.id);

  return {
    id,
    name: token.name || `Collective Noun ${id}`,
    image: normalizeImageUri(token.image),
    owner: token.owner,
    ownerEns: undefined,
    attributes: getAttributesFromImageUrl(token.image),
  };
};

const getSubgraphTokenList = async (): Promise<ProbeToken[]> => {
  const client = new GraphQLClient(SUBGRAPH_ENDPOINT);
  const tokens: ProbeToken[] = [];
  let skip = 0;

  while (true) {
    const response = await client.request<{
      daos: { tokens: SubgraphToken[] }[];
    }>(tokensQuery, {
      tokenAddress: TOKEN_CONTRACT.toLowerCase(),
      skip,
    });
    const page = response.daos[0]?.tokens || [];
    tokens.push(...page.map(mapSubgraphToken));

    if (page.length < 1000) return tokens;
    skip += 1000;
  }
};

const getTraitOptions = (tokens: ProbeToken[]) => {
  const options = new Map<string, Set<string>>();

  tokens.forEach((token) => {
    Object.entries(token.attributes).forEach(([trait, value]) => {
      if (!options.has(trait)) options.set(trait, new Set());
      options.get(trait)?.add(value);
    });
  });

  return Array.from(options.entries())
    .map(([trait, values]) => ({
      trait,
      values: Array.from(values).sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => a.trait.localeCompare(b.trait));
};

export const getCollectiveNounTokens =
  async (): Promise<ProbeTokenResponse> => {
    const subgraphTokens = await getSubgraphTokenList();

    if (subgraphTokens.length > 0) {
      const activeTokens = subgraphTokens.filter(
        (token) => !BURNER_ADDRESSES.has(token.owner?.toLowerCase() || "")
      );

      subgraphTokens.sort((a, b) => b.id - a.id);

      return {
        tokens: subgraphTokens,
        traitOptions: getTraitOptions(subgraphTokens),
        totalSupply: activeTokens.length,
      };
    }

    const { totalSupply, zeroIndexedIds, oneIndexedIds } = await getTokenIds();
    const zeroIndexedTokens = (
      await Promise.all(zeroIndexedIds.map(getTokenFromId))
    ).filter((token): token is ProbeToken => Boolean(token));

    const tokens =
      zeroIndexedTokens.length > 0
        ? zeroIndexedTokens
        : (
            await Promise.all(oneIndexedIds.map(getTokenFromId))
          ).filter((token): token is ProbeToken => Boolean(token));

    tokens.sort((a, b) => b.id - a.id);

    return {
      tokens,
      traitOptions: getTraitOptions(tokens),
      totalSupply: tokens.filter(
        (token) => !BURNER_ADDRESSES.has(token.owner?.toLowerCase() || "")
      ).length,
    };
  };
