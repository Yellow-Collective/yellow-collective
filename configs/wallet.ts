import "@rainbow-me/rainbowkit/styles.css";
import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  braveWallet,
  coinbaseWallet,
  injectedWallet,
  metaMaskWallet,
  phantomWallet,
  rabbyWallet,
  rainbowWallet,
  safeWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { mainnet, goerli, configureChains, createClient } from "wagmi";
import type { Chain } from "wagmi";
import { jsonRpcProvider } from "wagmi/providers/jsonRpc";
import { publicProvider } from "wagmi/providers/public";
import { zoraTestnet, zora, base, baseGoerli } from "@wagmi/chains";

import { createPublicClient, fallback, http } from "viem";
import { TOKEN_NETWORK } from "constants/addresses";

const mainnetViem = mainnet as any;
const baseSepolia = {
  id: 84532,
  name: "Base Sepolia",
  network: "base-sepolia",
  nativeCurrency: {
    name: "Sepolia Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://sepolia.base.org"],
    },
    public: {
      http: ["https://sepolia.base.org"],
    },
  },
  blockExplorers: {
    default: {
      name: "Basescan",
      url: "https://sepolia.basescan.org",
    },
  },
  testnet: true,
} as const;

const selectedChain = {
  "1": mainnet,
  "5": goerli,
  "999": zoraTestnet,
  "7777777": zora,
  "8453": base,
  "84531": baseGoerli,
  "84532": baseSepolia,
}[TOKEN_NETWORK]!;

const ALCHEMY_KEY = process.env.NEXT_PUBLIC_ALCHEMY_KEY;
const CONFIGURED_MAINNET_RPC_URL =
  process.env.MAINNET_RPC_URL || process.env.NEXT_PUBLIC_MAINNET_RPC_URL;
const PUBLIC_RPC_AGGREGATOR_BASE_URL = "https://evm.stupidtech.net/v1";
const getPublicRpcAggregatorUrl = (chainId: string) =>
  `${PUBLIC_RPC_AGGREGATOR_BASE_URL}/${chainId}`;
const getAlchemyUrl = (baseUrl: string, fallbackUrl: string) =>
  ALCHEMY_KEY ? `${baseUrl}/${ALCHEMY_KEY}` : fallbackUrl;

export type ChainId =
  | "1"
  | "5"
  | "999"
  | "7777777"
  | "8453"
  | "84531"
  | "84532";

const CURRENT_RPC_URLS: { [chainId in ChainId]: string } = {
  "1":
    CONFIGURED_MAINNET_RPC_URL ||
    (ALCHEMY_KEY
      ? `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`
      : "https://eth.llamarpc.com"),
  "5": getAlchemyUrl(
    "https://eth-goerli.g.alchemy.com/v2",
    "https://ethereum-goerli.publicnode.com"
  ),
  "999": "https://testnet.rpc.zora.energy",
  "7777777": "https://rpc.zora.energy",
  "8453": getAlchemyUrl(
    "https://base-mainnet.g.alchemy.com/v2",
    "https://mainnet.base.org"
  ),
  "84531": getAlchemyUrl(
    "https://base-goerli.g.alchemy.com/v2",
    "https://goerli.base.org"
  ),
  "84532": getAlchemyUrl(
    "https://base-sepolia.g.alchemy.com/v2",
    "https://sepolia.base.org"
  ),
};

const MAINNET_FALLBACK_RPC_URLS = Array.from(
  new Set(
    [
      CONFIGURED_MAINNET_RPC_URL,
      ALCHEMY_KEY ? `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}` : "",
      "https://eth.llamarpc.com",
      "https://ethereum.publicnode.com",
      "https://cloudflare-eth.com",
    ].filter((url): url is string => Boolean(url))
  )
);

export const MAINNET_RPC_URLS = Array.from(
  new Set([getPublicRpcAggregatorUrl("1"), ...MAINNET_FALLBACK_RPC_URLS])
);

export const RPC_URLS: { [chainId in ChainId]: string } = {
  "1": MAINNET_RPC_URLS[0],
  "5": getPublicRpcAggregatorUrl("5"),
  "999": getPublicRpcAggregatorUrl("999"),
  "7777777": getPublicRpcAggregatorUrl("7777777"),
  "8453": getPublicRpcAggregatorUrl("8453"),
  "84531": getPublicRpcAggregatorUrl("84531"),
  "84532": getPublicRpcAggregatorUrl("84532"),
};

export const RPC_URL_LISTS: { [chainId in ChainId]: string[] } = {
  "1": MAINNET_RPC_URLS,
  "5": Array.from(new Set([RPC_URLS["5"], CURRENT_RPC_URLS["5"]])),
  "999": Array.from(new Set([RPC_URLS["999"], CURRENT_RPC_URLS["999"]])),
  "7777777": Array.from(
    new Set([RPC_URLS["7777777"], CURRENT_RPC_URLS["7777777"]])
  ),
  "8453": Array.from(new Set([RPC_URLS["8453"], CURRENT_RPC_URLS["8453"]])),
  "84531": Array.from(new Set([RPC_URLS["84531"], CURRENT_RPC_URLS["84531"]])),
  "84532": Array.from(new Set([RPC_URLS["84532"], CURRENT_RPC_URLS["84532"]])),
};

export const MAINNET_RPC_URL = RPC_URLS["1"];
export const RPC_URL = RPC_URLS[TOKEN_NETWORK]!;
export const RPC_URL_LIST = RPC_URL_LISTS[TOKEN_NETWORK]!;
export const RPC_CHAIN_ID = Number(TOKEN_NETWORK);

const rpcProviders = RPC_URL_LIST.map((rpcUrl) =>
  jsonRpcProvider({
    rpc: (_) => {
      return { http: rpcUrl };
    },
    stallTimeout: 1000,
  })
);

const { chains, provider } = configureChains(
  [selectedChain as Chain],
  [...rpcProviders, publicProvider()]
);

const appName = "Yellow Collective";
const projectId = "afb449b5b1ea52d11db1ec72bc452500";

const connectors = connectorsForWallets([
  {
    groupName: "Popular",
    wallets: [
      injectedWallet({ chains }),
      safeWallet({ chains }),
      rainbowWallet({ chains, projectId }),
      coinbaseWallet({ appName, chains }),
      metaMaskWallet({ chains, projectId }),
      rabbyWallet({ chains }),
      phantomWallet({ chains }),
      walletConnectWallet({ chains, projectId }),
      braveWallet({ chains }),
    ],
  },
]);

const wagmiClient = createClient({
  autoConnect: true,
  connectors,
  provider,
});

const viemMainnetClient = createPublicClient({
  chain: mainnetViem,
  transport: fallback(
    MAINNET_RPC_URLS.map((url) =>
      http(url, {
        timeout: 4000,
      })
    ),
    {
      retryCount: 1,
    }
  ),
});

export { wagmiClient, chains, viemMainnetClient };
