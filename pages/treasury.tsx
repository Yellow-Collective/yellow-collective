import { ClipboardDocumentIcon } from "@heroicons/react/24/outline";
import AddressLink from "@/components/AddressLink";
import Layout from "@/components/Layout";
import DefaultProvider from "@/utils/DefaultProvider";
import TokenLogo from "components/treasury/TokenLogo";
import TreasuryDonut, {
  type TreasuryDonutItem,
} from "components/treasury/TreasuryDonut";
import TreasuryTransactions, {
  type TreasuryTransaction,
} from "components/treasury/TreasuryTransactions";
import { TOKEN_CONTRACT } from "constants/addresses";
import { ETHERSCAN_BASEURL, SUBGRAPH_ENDPOINT } from "constants/urls";
import { YELLOW_COLLECTIVE_CONTRACTS } from "data/contracts";
import { BigNumber, Contract, utils } from "@/utils/ethers-compat";
import { GraphQLClient, gql } from "graphql-request";
import type { GetStaticPropsResult, InferGetStaticPropsType } from "next";
import Head from "next/head";

type TreasuryToken = {
  address: string;
  name: string;
  symbol: string;
  balance: string;
  balanceRaw: string;
  decimals: number;
  balanceLabel: string;
  valueUsd: number;
  logoUrl?: string;
};

type TreasuryPageProps = {
  treasuryAddress: string;
  totalAuctionSales: string;
  ethBalance: string;
  ethPriceUsd: number | null;
  tokens: TreasuryToken[];
};

type AssetRow = {
  id: string;
  address: string;
  name: string;
  symbol: string;
  subLabel: string;
  balanceLabel: string;
  valueUsd: number | null;
  allocationPercent: number;
  logoUrl?: string;
};

const ZORA_TOKEN_ADDRESS = "0x1111111111166b7fe7bd91427724b487980afc69";
const ZORA_LOGO_URL =
  "https://assets.coingecko.com/coins/images/32273/standard/zora.png?1696991892";
const erc20Abi = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
];

const treasuryQuery = gql`
  query yellowCollectiveTreasury($tokenAddress: String!) {
    daos(first: 1, where: { tokenAddress: $tokenAddress }) {
      treasuryAddress
      totalAuctionSales
    }
  }
`;

const fetchJson = async <T,>(
  url: string,
  timeoutMs = 5000
): Promise<T | null> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch (error) {
    console.warn(`Unable to fetch ${url}`, error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

const formatUsd = (value: number | null) => {
  if (value === null || !Number.isFinite(value) || value <= 0) return "$--";

  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  });
};

const formatNumber = (value: number, digits = 4) =>
  value.toLocaleString("en-US", {
    maximumFractionDigits: digits,
  });

const formatEth = (value: string, digits = 5) => {
  try {
    return formatNumber(Number(utils.formatEther(BigNumber.from(value))), digits);
  } catch {
    return "0";
  }
};

const formatTokenBalance = (value: number) => {
  if (value >= 1_000_000) {
    return `${formatNumber(value / 1_000_000, 2)}m`;
  }

  if (value >= 1000) {
    return `${formatNumber(value / 1000, 2)}k`;
  }

  return formatNumber(value, 4);
};

const getTokenPrices = async () => {
  const prices = await fetchJson<{
    ethereum?: { usd?: number };
    zora?: { usd?: number };
  }>(
    "https://api.coingecko.com/api/v3/simple/price?ids=ethereum,zora&vs_currencies=usd"
  );

  return {
    eth: prices?.ethereum?.usd || null,
    zora: prices?.zora?.usd || null,
  };
};

const getEthBalance = async (treasuryAddress: string) => {
  try {
    const balance = await DefaultProvider.getBalance(treasuryAddress);
    return balance.toString();
  } catch (error) {
    console.warn("Unable to load treasury ETH balance", error);
    return "0";
  }
};

const getTrackedTokens = async (
  treasuryAddress: string,
  zoraPriceUsd: number | null
) => {
  try {
    const zora = new Contract(ZORA_TOKEN_ADDRESS, erc20Abi, DefaultProvider);
    const [rawBalance, decimals, name, symbol] = await Promise.all([
      zora.balanceOf(treasuryAddress),
      zora.decimals(),
      zora.name(),
      zora.symbol(),
    ]);
    const balance = Number(utils.formatUnits(rawBalance, decimals));

    if (balance <= 0) return [];

    return [
      {
        address: ZORA_TOKEN_ADDRESS,
        name,
        symbol,
        balance: balance.toString(),
        balanceRaw: rawBalance.toString(),
        decimals,
        balanceLabel: `${formatTokenBalance(balance)} ${symbol}`,
        valueUsd: zoraPriceUsd ? balance * zoraPriceUsd : 0,
        logoUrl: ZORA_LOGO_URL,
      },
    ] as TreasuryToken[];
  } catch (error) {
    console.warn("Unable to load tracked treasury tokens", error);
    return [];
  }
};

const getExplorerAddressUrl = (address: string) => {
  const explorerBaseUrl = (ETHERSCAN_BASEURL || "https://basescan.org").replace(
    /\/$/,
    ""
  );
  return `${explorerBaseUrl}/address/${address}`;
};

export const getStaticProps = async (): Promise<
  GetStaticPropsResult<TreasuryPageProps>
> => {
  let treasuryAddress: string = YELLOW_COLLECTIVE_CONTRACTS.treasury.address;
  let totalAuctionSales = "0";

  try {
    const client = new GraphQLClient(SUBGRAPH_ENDPOINT);
    const response = await client.request<{
      daos: { treasuryAddress: string; totalAuctionSales: string }[];
    }>(treasuryQuery, {
      tokenAddress: TOKEN_CONTRACT.toLowerCase(),
    });
    treasuryAddress = response.daos[0]?.treasuryAddress || treasuryAddress;
    totalAuctionSales =
      response.daos[0]?.totalAuctionSales || totalAuctionSales;
  } catch (error) {
    console.warn("Unable to load treasury subgraph data", error);
  }

  const [{ eth, zora }, ethBalance] = await Promise.all([
    getTokenPrices(),
    getEthBalance(treasuryAddress),
  ]);
  const tokens = await getTrackedTokens(treasuryAddress, zora);

  return {
    props: {
      treasuryAddress,
      totalAuctionSales,
      ethBalance,
      ethPriceUsd: eth,
      tokens,
    },
    revalidate: 60,
  };
};

const buildAssetRows = ({
  ethBalanceValue,
  ethBalanceUsd,
  tokens,
  portfolioUsd,
}: {
  ethBalanceValue: number;
  ethBalanceUsd: number | null;
  tokens: TreasuryToken[];
  portfolioUsd: number;
}): AssetRow[] => {
  const rows: AssetRow[] = [
    {
      id: "eth",
      address: "native",
      name: "Ethereum",
      symbol: "ETH",
      subLabel: "Native treasury balance",
      balanceLabel: `${formatNumber(ethBalanceValue, 5)} ETH`,
      valueUsd: ethBalanceUsd,
      allocationPercent:
        portfolioUsd > 0 && ethBalanceUsd ? (ethBalanceUsd / portfolioUsd) * 100 : 0,
    },
  ];

  tokens.forEach((token) => {
    rows.push({
      id: token.address,
      address: token.address,
      name: token.name,
      symbol: token.symbol,
      subLabel: "Tracked ERC-20 holding",
      balanceLabel: token.balanceLabel,
      valueUsd: token.valueUsd > 0 ? token.valueUsd : null,
      allocationPercent:
        portfolioUsd > 0 && token.valueUsd > 0
          ? (token.valueUsd / portfolioUsd) * 100
          : 0,
      logoUrl: token.logoUrl,
    });
  });

  return rows;
};

export default function TreasuryPage({
  treasuryAddress,
  totalAuctionSales,
  ethBalance,
  ethPriceUsd,
  tokens,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  const ethBalanceValue = Number(utils.formatEther(BigNumber.from(ethBalance)));
  const ethBalanceUsd = ethPriceUsd ? ethBalanceValue * ethPriceUsd : null;
  const tokenTotalUsd = tokens.reduce((sum, token) => sum + token.valueUsd, 0);
  const portfolioUsd = (ethBalanceUsd || 0) + tokenTotalUsd;
  const hasUsdData = portfolioUsd > 0;
  const explorerAddressUrl = getExplorerAddressUrl(treasuryAddress);
  const recentTransactions: TreasuryTransaction[] = [];

  const allocationItems: TreasuryDonutItem[] = [
    ethBalanceUsd && ethBalanceUsd > 0
      ? {
          id: "eth",
          name: "Ethereum",
          valueUsd: ethBalanceUsd,
          color: "rgb(var(--color-accent))",
        }
      : null,
    ...tokens
      .filter((token) => token.valueUsd > 0)
      .map((token, index) => ({
        id: token.address,
        name: token.symbol,
        valueUsd: token.valueUsd,
        color:
          index % 2 === 0
            ? "rgb(var(--color-action))"
            : "rgb(var(--color-text-muted))",
      })),
  ].filter(Boolean) as TreasuryDonutItem[];

  const assetRows = buildAssetRows({
    ethBalanceValue,
    ethBalanceUsd,
    tokens,
    portfolioUsd,
  });

  const copyTreasuryAddress = () => {
    navigator.clipboard?.writeText(treasuryAddress);
  };

  return (
    <Layout>
      <Head>
        <title>Treasury | Yellow Collective</title>
      </Head>

      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-8 pb-12">
        <header className="flex flex-col gap-5 rounded-2xl border border-skin-stroke bg-skin-muted p-5 shadow-sm md:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <h1 className="text-[42px] leading-none md:text-[58px]">
                Treasury
              </h1>
              <p className="mt-4 text-base leading-snug text-secondary md:text-lg">
                {hasUsdData
                  ? `Estimated live value: ${formatUsd(
                      portfolioUsd
                    )} across ETH and tracked ERC-20s.`
                  : "Live balances are shown now. USD composition appears when Coingecko pricing is available."}
              </p>
            </div>

            <div className="yc-force-white flex w-full min-w-0 items-center justify-between gap-3 rounded-2xl border border-skin-stroke bg-white px-4 py-3 text-sm shadow-sm sm:w-auto sm:justify-start md:px-5 md:py-4 md:text-lg">
              <AddressLink
                address={treasuryAddress}
                fallbackAmount={8}
                link={false}
              />
              <button
                type="button"
                onClick={copyTreasuryAddress}
                aria-label="Copy treasury address"
                className="text-secondary transition hover:text-skin-base"
              >
                <ClipboardDocumentIcon className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <TreasuryStat
              label="Total auction sales"
              value={`${formatEth(totalAuctionSales)} ETH`}
            />
            <TreasuryStat
              label="ETH balance"
              value={`${formatEth(ethBalance)} ETH`}
            />
            <TreasuryStat label="Portfolio value" value={formatUsd(portfolioUsd)} />
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
          <aside className="flex flex-col gap-6">
            <TreasuryDonut
              items={allocationItems}
              totalLabel={formatUsd(portfolioUsd)}
            />
          </aside>

          <main className="flex min-w-0 flex-col gap-6">
            <section className="rounded-2xl border border-skin-stroke bg-skin-muted p-5 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="font-heading text-3xl leading-none">
                    Assets
                  </h2>
                  <p className="mt-2 text-sm leading-snug text-secondary">
                    ETH first, then tracked ERC-20 treasury holdings.
                  </p>
                </div>
                <div className="font-heading text-3xl leading-none">
                  {formatUsd(portfolioUsd)}
                </div>
              </div>

              <div className="yc-force-white mt-5 overflow-hidden rounded-xl border border-skin-stroke bg-white">
                {assetRows.map((asset) => (
                  <div
                    key={asset.id}
                    className="grid gap-4 border-b border-skin-stroke p-4 last:border-b-0 md:grid-cols-[minmax(0,1.4fr)_minmax(120px,0.7fr)_minmax(120px,0.7fr)] md:items-center"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <TokenLogo
                        address={asset.address}
                        symbol={asset.symbol}
                        name={asset.name}
                        logoUrl={asset.logoUrl}
                      />
                      <div className="min-w-0">
                        <div className="truncate font-heading text-xl leading-none">
                          {asset.name}
                        </div>
                        <div className="mt-1 truncate text-sm text-secondary">
                          {asset.subLabel}
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="font-heading text-lg leading-none">
                        {asset.balanceLabel}
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-skin-muted">
                        <div
                          className="h-full rounded-full bg-accent"
                          style={{ width: `${asset.allocationPercent}%` }}
                        />
                      </div>
                    </div>

                    <div className="font-heading text-xl leading-none md:text-right">
                      {formatUsd(asset.valueUsd)}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <TreasuryTransactions
              transactions={recentTransactions}
              explorerUrl={explorerAddressUrl}
            />
          </main>
        </div>
      </div>
    </Layout>
  );
}

function TreasuryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="yc-force-white rounded-xl border border-skin-stroke bg-white p-4">
      <div className="font-heading text-2xl leading-none">{value}</div>
      <div className="mt-2 text-sm leading-snug text-secondary">{label}</div>
    </div>
  );
}
