import AddressLink from "@/components/AddressLink";
import Layout from "@/components/Layout";
import DefaultProvider from "@/utils/DefaultProvider";
import { TOKEN_CONTRACT } from "constants/addresses";
import { SUBGRAPH_ENDPOINT } from "constants/urls";
import { YELLOW_COLLECTIVE_CONTRACTS } from "data/contracts";
import { BigNumber, Contract, utils } from "@/utils/ethers-compat";
import { GraphQLClient, gql } from "graphql-request";
import type { GetStaticPropsResult, InferGetStaticPropsType } from "next";
import Head from "next/head";
import { ClipboardDocumentIcon } from "@heroicons/react/24/outline";

type TreasuryToken = {
  name: string;
  symbol: string;
  balance: string;
  balanceLabel: string;
  valueUsd: number;
};

type TreasuryPageProps = {
  treasuryAddress: string;
  totalAuctionSales: string;
  ethBalance: string;
  ethPriceUsd: number | null;
  tokens: TreasuryToken[];
};

const ZORA_TOKEN_ADDRESS = "0x1111111111166b7fe7bd91427724b487980afc69";
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

const formatEth = (value: string, digits = 5) => {
  try {
    return Number(utils.formatEther(BigNumber.from(value))).toLocaleString(
      "en-US",
      {
        maximumFractionDigits: digits,
      }
    );
  } catch {
    return "0";
  }
};

const formatUsd = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return "$--";

  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 1000 ? 1 : 2,
  });
};

const formatTokenBalance = (value: number) => {
  if (value >= 1000) {
    return `${(value / 1000).toLocaleString("en-US", {
      maximumFractionDigits: 2,
    })}k`;
  }

  return value.toLocaleString("en-US", {
    maximumFractionDigits: 2,
  });
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
        name,
        symbol,
        balance: balance.toString(),
        balanceLabel: `${formatTokenBalance(balance)} ${symbol}`,
        valueUsd: zoraPriceUsd ? balance * zoraPriceUsd : 0,
      },
    ] as TreasuryToken[];
  } catch (error) {
    console.warn("Unable to load tracked treasury tokens", error);
    return [];
  }
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
    DefaultProvider.getBalance(treasuryAddress).then((balance: any) =>
      balance.toString()
    ),
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

  const copyTreasuryAddress = () => {
    navigator.clipboard?.writeText(treasuryAddress);
  };

  return (
    <Layout>
      <Head>
        <title>Treasury | Yellow Collective</title>
      </Head>

      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-10 pb-12">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:justify-between sm:text-left">
          <h1 className="text-[30px] leading-none sm:text-[36px] md:text-[44px]">
            Treasury
          </h1>

          <div className="flex w-full min-w-0 items-center justify-between gap-3 rounded-2xl border border-skin-stroke bg-skin-muted px-4 py-3 text-sm shadow-sm sm:w-auto sm:justify-start md:px-5 md:py-4 md:text-lg">
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

        <section className="grid gap-6 rounded-2xl border border-skin-stroke bg-skin-muted px-6 py-12 text-center shadow-sm md:grid-cols-3">
          <div>
            <div className="font-heading text-4xl leading-none">
              {formatEth(totalAuctionSales)} ETH
            </div>
            <div className="mt-4 text-base text-secondary md:text-lg">
              Total Auction Sales
            </div>
          </div>
          <div>
            <div className="font-heading text-4xl leading-none">
              {formatEth(ethBalance)} ETH
            </div>
            <div className="mt-4 text-base text-secondary md:text-lg">
              ETH Balance
            </div>
          </div>
          <div>
            <div className="font-heading text-4xl leading-none">
              {formatUsd(ethBalanceUsd)}
            </div>
            <div className="mt-4 text-base text-secondary md:text-lg">
              ETH Balance in USD
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-6">
          <div className="flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
            <h2 className="font-heading text-4xl leading-none">Tokens</h2>
            <div className="font-heading text-4xl leading-none">
              {formatUsd(tokenTotalUsd)}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-skin-stroke bg-skin-muted shadow-sm">
            {tokens.length > 0 ? (
              <div className="min-w-[720px]">
                <div className="grid grid-cols-3 gap-6 p-8 font-heading text-xl">
                  <div>Asset</div>
                  <div>Balance</div>
                  <div>Value in USD</div>
                </div>
                {tokens.map((token) => (
                  <div
                    key={token.symbol}
                    className="grid grid-cols-3 items-center gap-6 px-8 pb-8 text-base md:text-lg"
                  >
                    <div className="flex items-center gap-4">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full border border-skin-stroke bg-skin-backdrop font-heading text-lg">
                        {token.symbol.charAt(0)}
                      </span>
                      <span>{token.name}</span>
                    </div>
                    <div>{token.balanceLabel}</div>
                    <div>{formatUsd(token.valueUsd)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center text-base text-secondary md:text-lg">
                No Tokens Found
              </div>
            )}
          </div>
        </section>

        <section className="flex flex-col gap-6">
          <h2 className="text-center font-heading text-4xl leading-none sm:text-left">
            NFTs
          </h2>
          <div className="rounded-2xl border border-skin-stroke bg-skin-muted p-12 text-center text-base text-secondary shadow-sm md:text-lg">
            No NFTs Found
          </div>
        </section>
      </div>
    </Layout>
  );
}
