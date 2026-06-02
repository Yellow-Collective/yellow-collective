import { ETHERSCAN_BASEURL } from "constants/urls";
import { ethers } from "@/utils/ethers-compat";
import { getAddress, isAddress } from "viem";

export const BASE_CHAIN_ID = 8453;
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
export const ZERO_HASH =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

export const ZORA_COIN_FACTORY_ADDRESS = getAddress(
  "0x777777751622c0d3258f214F9DF38E35BF45baF3"
);

export const BUILDER_BASE_TREASURY_ADDRESS = getAddress(
  "0xcF325a4C78912216249B818521b0798A0f904C10"
);

export const FIXED_BASE_COIN_ADDRESS =
  process.env.NEXT_PUBLIC_FIXED_BASE_COIN_ADDRESS || "";

export const FIXED_BASE_COIN_LABEL =
  process.env.NEXT_PUBLIC_FIXED_BASE_COIN_LABEL || "Fixed Base coin";

export const FIXED_BASE_COIN_PRICE_USD = Number(
  process.env.NEXT_PUBLIC_FIXED_BASE_COIN_PRICE_USD || "0"
);

export const CONTENT_COIN_TARGET_FDV_USD = Number(
  process.env.NEXT_PUBLIC_CONTENT_COIN_TARGET_FDV_USD || "0"
);

export const COIN_RECORD_SIGNED_REQUEST_ACTION = "coins:create-record";

const DEFAULT_CLANKER_TOTAL_SUPPLY = 100_000_000_000;
const DEFAULT_ZORA_TOTAL_SUPPLY = 1_000_000_000;
const DEFAULT_ZORA_TICK_SPACING = 200;
const MIN_TICK = -887272;
const MAX_TICK = 887272;
const LN_1_0001 = Math.log(1.0001);
const TICK_HALF_RANGE = 11_000;
const RANGE_FACTOR = Math.pow(1.0001, 2 * TICK_HALF_RANGE);
const RANGE_FACTOR_SQRT = Math.sqrt(RANGE_FACTOR);
const POOL_CONFIG_VERSION = 4;
const NUM_DISCOVERY_POSITIONS = [11, 11, 11];
const MAX_DISCOVERY_SUPPLY_SHARES = [
  "250000000000000000",
  "300000000000000000",
  "150000000000000000",
];

export type CoiningValues = {
  coinName: string;
  coinSymbol: string;
  contentTitle: string;
  contentDescription: string;
  mediaUrl: string;
  payoutRecipient: string;
  ownerAddress: string;
  proposalBody: string;
};

export type CoinDeployParams = {
  payoutRecipient: `0x${string}`;
  owners: `0x${string}`[];
  metadataUri: string;
  name: string;
  symbol: string;
  poolConfig: `0x${string}`;
  platformReferrer: `0x${string}`;
  postDeployHook: `0x${string}`;
  postDeployHookData: `0x${string}`;
  coinSalt: `0x${string}`;
};

export const zoraCoinFactoryAbi = [
  "function deploy(address payoutRecipient,address[] owners,string uri,string name,string symbol,bytes poolConfig,address platformReferrer,address postDeployHook,bytes postDeployHookData,bytes32 coinSalt) payable returns (address coin, bytes postDeployHookDataOut)",
  "function coinAddress(address msgSender,string name,string symbol,bytes poolConfig,address platformReferrer,bytes32 coinSalt) view returns (address)",
  "event CoinCreatedV4(address indexed caller,address indexed payoutRecipient,address indexed platformReferrer,address currency,string uri,string name,string symbol,address coin,tuple(address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) poolKey,bytes32 poolKeyHash,string version)",
] as const;

export const erc20MetadataAbi = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
] as const;

export const coinFactoryInterface = new ethers.utils.Interface(
  zoraCoinFactoryAbi
);

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const snapToTickSpacing = (tick: number, spacing: number) =>
  Math.round(tick / spacing) * spacing;

const fdvToTick = ({
  fdvUsd,
  quoteTokenUsd,
  tickSpacing,
  totalSupply,
}: {
  fdvUsd: number;
  quoteTokenUsd: number;
  tickSpacing: number;
  totalSupply: number;
}) => {
  if (fdvUsd <= 0) throw new Error("Target FDV must be positive.");
  if (quoteTokenUsd <= 0)
    throw new Error("Pair coin USD price must be positive.");
  if (totalSupply <= 0) throw new Error("Total supply must be positive.");

  const usdPerCoin = fdvUsd / totalSupply;
  const currencyPerCoin = usdPerCoin / quoteTokenUsd;
  const tick = Math.log(currencyPerCoin) / LN_1_0001;

  return snapToTickSpacing(clamp(tick, MIN_TICK, MAX_TICK), tickSpacing);
};

export const estimateContentTargetFdvUsd = (pairCoinPriceUsd: number) => {
  const creatorFdvUsd = pairCoinPriceUsd * DEFAULT_CLANKER_TOTAL_SUPPLY;
  const minFdv = 10_000;
  const maxFdv = 100_000;
  const pivotFdv = 500_000;
  const steepness = 1.2;
  const x = Math.pow(creatorFdvUsd / pivotFdv, steepness);

  return minFdv + (maxFdv - minFdv) * (x / (1 + x));
};

export const encodeContentPoolConfig = ({
  currency,
  pairCoinPriceUsd,
  targetFdvUsd,
}: {
  currency: `0x${string}`;
  pairCoinPriceUsd: number;
  targetFdvUsd?: number;
}) => {
  const resolvedTargetFdvUsd =
    targetFdvUsd && targetFdvUsd > 0
      ? targetFdvUsd
      : estimateContentTargetFdvUsd(pairCoinPriceUsd);

  const minFdvUsd = resolvedTargetFdvUsd / RANGE_FACTOR_SQRT;
  const maxFdvUsd = resolvedTargetFdvUsd * RANGE_FACTOR_SQRT;
  const minTick = fdvToTick({
    fdvUsd: minFdvUsd,
    quoteTokenUsd: pairCoinPriceUsd,
    tickSpacing: DEFAULT_ZORA_TICK_SPACING,
    totalSupply: DEFAULT_ZORA_TOTAL_SUPPLY,
  });
  const maxTick = fdvToTick({
    fdvUsd: maxFdvUsd,
    quoteTokenUsd: pairCoinPriceUsd,
    tickSpacing: DEFAULT_ZORA_TICK_SPACING,
    totalSupply: DEFAULT_ZORA_TOTAL_SUPPLY,
  });

  const tickMin = Math.min(minTick, maxTick);
  const tickMax = Math.max(minTick, maxTick);
  const tickOne = tickMin + 80 * DEFAULT_ZORA_TICK_SPACING;
  const tickTwo = tickMin + 100 * DEFAULT_ZORA_TICK_SPACING;

  if (!(tickMin < tickOne && tickOne < tickTwo && tickTwo < tickMax)) {
    throw new Error("Unable to create a valid pool configuration.");
  }

  return ethers.utils.defaultAbiCoder.encode(
    ["uint8", "address", "int24[]", "int24[]", "uint16[]", "uint256[]"],
    [
      POOL_CONFIG_VERSION,
      currency,
      [tickMin, tickOne, tickTwo],
      [tickTwo, tickMax, tickMax],
      NUM_DISCOVERY_POSITIONS,
      MAX_DISCOVERY_SUPPLY_SHARES,
    ]
  ) as `0x${string}`;
};

export const normalizeCoinSymbol = (value: string) =>
  value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 10);

export const generateCoinSymbol = (name: string) =>
  normalizeCoinSymbol(
    name
      .replace(/[aeiou\s]/gi, "")
      .slice(0, 5)
      .toUpperCase()
  ) || "COIN";

export const getFixedPairConfigError = () => {
  if (!FIXED_BASE_COIN_ADDRESS) {
    return "NEXT_PUBLIC_FIXED_BASE_COIN_ADDRESS is missing.";
  }
  if (!isAddress(FIXED_BASE_COIN_ADDRESS)) {
    return "NEXT_PUBLIC_FIXED_BASE_COIN_ADDRESS must be a valid address.";
  }
  if (!FIXED_BASE_COIN_PRICE_USD || FIXED_BASE_COIN_PRICE_USD <= 0) {
    return "NEXT_PUBLIC_FIXED_BASE_COIN_PRICE_USD must be set to a positive number.";
  }

  return "";
};

export const getFixedPairAddress = () =>
  getAddress(FIXED_BASE_COIN_ADDRESS) as `0x${string}`;

export const validateCoiningValues = (
  values: CoiningValues,
  mode: "direct" | "droposal" | "round"
) => {
  const errors: Partial<Record<keyof CoiningValues, string>> = {};

  if (!values.coinName.trim()) errors.coinName = "Post name is required.";
  if (values.coinName.trim().length > 100)
    errors.coinName = "Post name must be 100 characters or less.";

  if (!values.coinSymbol.trim()) errors.coinSymbol = "Coin symbol is required.";
  if (!/^[A-Z0-9]{1,10}$/.test(values.coinSymbol.trim())) {
    errors.coinSymbol = "Use 1-10 uppercase letters or numbers.";
  }

  if (!values.contentTitle.trim())
    errors.contentTitle = "Content title is required.";
  if (!values.contentDescription.trim())
    errors.contentDescription = "Content description is required.";
  if (values.contentDescription.trim().length > 1000) {
    errors.contentDescription =
      "Content description must be under 1000 characters.";
  }
  if (!isSafeHttpOrIpfsUrl(values.mediaUrl)) {
    errors.mediaUrl = "Upload a media file before submitting.";
  }
  if (!isAddress(values.payoutRecipient)) {
    errors.payoutRecipient = "Payout recipient must be a valid address.";
  }
  if (!isAddress(values.ownerAddress)) {
    errors.ownerAddress = "Owner address must be a valid address.";
  }
  if (mode === "droposal" && !values.proposalBody.trim()) {
    errors.proposalBody = "Proposal body is required for Droposal mode.";
  }

  return errors;
};

export const isSafeHttpOrIpfsUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("ipfs://")) return trimmed.length > "ipfs://".length;

  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
};

export const createCoinMetadataUri = (values: CoiningValues) => {
  const metadata = {
    name: values.coinName.trim(),
    symbol: values.coinSymbol.trim(),
    description: values.contentDescription.trim(),
    image: values.mediaUrl.trim(),
    content: {
      title: values.contentTitle.trim(),
      url: values.mediaUrl.trim(),
    },
    properties: {
      app: "Yellow Collective",
      contentTitle: values.contentTitle.trim(),
      pairedCoin: getFixedPairAddress(),
    },
  };

  return `data:application/json;utf8,${encodeURIComponent(
    JSON.stringify(metadata)
  )}`;
};

export const buildDeployParams = ({
  values,
  payoutRecipient,
  ownerAddress,
}: {
  values: CoiningValues;
  payoutRecipient: `0x${string}`;
  ownerAddress: `0x${string}`;
}): CoinDeployParams => {
  const poolConfig = encodeContentPoolConfig({
    currency: getFixedPairAddress(),
    pairCoinPriceUsd: FIXED_BASE_COIN_PRICE_USD,
    targetFdvUsd: CONTENT_COIN_TARGET_FDV_USD,
  });

  return {
    payoutRecipient,
    owners: [ownerAddress],
    metadataUri: createCoinMetadataUri(values),
    name: values.coinName.trim(),
    symbol: values.coinSymbol.trim(),
    poolConfig,
    platformReferrer: BUILDER_BASE_TREASURY_ADDRESS,
    postDeployHook: ZERO_ADDRESS as `0x${string}`,
    postDeployHookData: "0x",
    coinSalt: ZERO_HASH as `0x${string}`,
  };
};

export const getDeployArgs = (params: CoinDeployParams) =>
  [
    params.payoutRecipient,
    params.owners,
    params.metadataUri,
    params.name,
    params.symbol,
    params.poolConfig,
    params.platformReferrer,
    params.postDeployHook,
    params.postDeployHookData,
    params.coinSalt,
  ] as const;

export const encodeDeployCalldata = (params: CoinDeployParams) =>
  coinFactoryInterface.encodeFunctionData("deploy", getDeployArgs(params));

export const buildDroposalDescription = (values: CoiningValues) =>
  JSON.stringify({
    version: 1,
    title: `Create ${values.coinSymbol.trim()} content post`,
    description: [
      values.proposalBody.trim(),
      "",
      "Content post summary",
      `Post: ${values.coinName.trim()} (${values.coinSymbol.trim()})`,
      `Content: ${values.contentTitle.trim()}`,
      `Description: ${values.contentDescription.trim()}`,
      `Media: ${values.mediaUrl.trim()}`,
      `Fixed paired Base coin: ${getFixedPairAddress()}`,
      `Payout recipient: ${getAddress(values.payoutRecipient)}`,
      `Coin owner: ${getAddress(values.ownerAddress)}`,
    ]
      .filter(Boolean)
      .join("\n"),
  });

export const getExplorerTxUrl = (hash: string) =>
  `${ETHERSCAN_BASEURL}/tx/${hash}`;

export const getExplorerAddressUrl = (address: string) =>
  `${ETHERSCAN_BASEURL}/address/${address}`;

export const getZoraCoinUrl = (address: string) =>
  `https://zora.co/coin/base:${address}`;

export const getDexscreenerUrl = (address: string) =>
  `https://dexscreener.com/base/${address}`;

export const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Something went wrong.";
};
