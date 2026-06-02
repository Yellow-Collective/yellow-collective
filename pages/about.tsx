import Layout from "@/components/Layout";
import {
  getAddresses,
  type DAOAddresses,
} from "@/services/nouns-builder/manager";
import DefaultProvider from "@/utils/DefaultProvider";
import { formatTreasuryBalance } from "@/utils/formatTreasuryBalance";
import { shortenAddress } from "@/utils/shortenAddress";
import {
  ContractInfo,
  Founder,
  getContractInfo,
  getFounders,
} from "data/nouns-builder/token";
import { getEnsName } from "data/ens";
import { TOKEN_CONTRACT, TOKEN_NETWORK } from "constants/addresses";
import { YELLOW_COLLECTIVE_CONTRACTS } from "data/contracts";
import { BigNumber } from "@/utils/ethers-compat";
import type { GetStaticPropsResult, InferGetStaticPropsType } from "next";
import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getProfilePath } from "@/utils/profile/identity";
import { useMemo } from "react";
import { isAddress } from "viem";

type Delegate = {
  address: string;
  displayName: string | null;
  votes: number;
  votePercent: number;
  joined?: string;
};

type FounderWithDisplayName = Founder & {
  displayName: string | null;
};

type AboutPageProps = {
  contract: ContractInfo;
  addresses: DAOAddresses;
  founders: FounderWithDisplayName[];
  delegates: Delegate[];
  treasuryBalance: string | null;
};

const membersListUrl = `https://nouns.build/api/membersList/${TOKEN_CONTRACT}?chainId=${TOKEN_NETWORK}`;

const getFallbackAddresses = (): DAOAddresses => ({
  metadata: YELLOW_COLLECTIVE_CONTRACTS.metadata.address,
  auction: YELLOW_COLLECTIVE_CONTRACTS.auctionHouse.address,
  treasury: YELLOW_COLLECTIVE_CONTRACTS.treasury.address,
  governor: YELLOW_COLLECTIVE_CONTRACTS.governor.address,
});

const getFallbackContract = (): ContractInfo => ({
  name: "Yellow Collective",
  description:
    "The Yellow Collective is an onchain club on the Base Ethereum L2 network, designed to support and empower artists and creatives in the Nouns and Superchain ecosystems.",
  image: "",
  external_url: "https://yellowcollective.art",
  total_supply: "0",
  auction: YELLOW_COLLECTIVE_CONTRACTS.auctionHouse.address,
});

const getNumber = (value: unknown): number => {
  if (Array.isArray(value)) return value.length;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const getJoinedDate = (value: unknown) => {
  if (!value) return "";

  const timestamp = getNumber(value);
  const date =
    timestamp > 0
      ? new Date(timestamp < 10000000000 ? timestamp * 1000 : timestamp)
      : new Date(String(value));

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const normalizeMembers = (
  payload: unknown,
  totalSupply: number
): Delegate[] => {
  const data = payload as {
    members?: unknown[];
    membersList?: unknown[];
    delegates?: unknown[];
  };
  const members = Array.isArray(payload)
    ? payload
    : data.membersList || data.members || data.delegates || [];

  return members
    .map((member) => {
      const item = member as Record<string, unknown>;
      const address = String(
        item.address ||
          item.delegate ||
          item.voter ||
          item.wallet ||
          item.owner ||
          item.id ||
          ""
      );
      const votes = getNumber(
        item.votes ||
          item.tokenCount ||
          item.tokens ||
          item.votingPower ||
          item.balance
      );
      const explicitVotePercent = getNumber(
        item.votePercent || item.votePct || item.percent
      );
      const displayName = [
        item.displayName,
        item.ensName,
        item.ens,
        item.name,
        item.username,
        item.handle,
      ].find((value) => typeof value === "string" && value.trim());

      return {
        address,
        displayName:
          typeof displayName === "string" ? displayName.trim() : null,
        votes,
        votePercent:
          explicitVotePercent ||
          (totalSupply > 0 ? (votes / totalSupply) * 100 : 0),
        joined: getJoinedDate(item.joined || item.joinedAt || item.createdAt),
      };
    })
    .filter((delegate) => isAddress(delegate.address))
    .sort((a, b) => b.votes - a.votes);
};

const fetchDelegates = async (totalSupply: number) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(membersListUrl, { signal: controller.signal });
    if (!response.ok) return [];

    return normalizeMembers(await response.json(), totalSupply);
  } catch (error) {
    console.warn("Unable to load DAO members list", error);
    return [];
  } finally {
    clearTimeout(timeout);
  }
};

const getTotalSupply = (contract: ContractInfo) => {
  try {
    return Number(BigNumber.from(contract.total_supply).toString());
  } catch (error) {
    console.warn("Unable to format total supply", error);
    return 0;
  }
};

const resolveEnsNames = async (addresses: string[]) => {
  const names = new Map<string, string>();
  const uniqueAddresses = Array.from(
    new Set(
      addresses
        .filter((address) => isAddress(address))
        .map((address) => address.toLowerCase())
    )
  );

  for (let i = 0; i < uniqueAddresses.length; i += 16) {
    const batch = uniqueAddresses.slice(i, i + 16);
    const results = await Promise.allSettled(
      batch.map(async (address) => {
        const { ensName } = await getEnsName({
          address: address as `0x${string}`,
        });

        if (ensName) names.set(address, ensName);
      })
    );

    results.forEach((result) => {
      if (result.status === "rejected") {
        console.warn("Unable to resolve ENS name", result.reason);
      }
    });
  }

  return names;
};

export const getStaticProps = async (): Promise<
  GetStaticPropsResult<AboutPageProps>
> => {
  const tokenContract = TOKEN_CONTRACT as `0x${string}`;
  let contract = getFallbackContract();
  try {
    contract = await getContractInfo({ address: tokenContract });
  } catch (error) {
    console.warn("Unable to load contract info", error);
  }
  const totalSupply = getTotalSupply(contract);

  const [addressesResult, foundersResult, delegates] = await Promise.allSettled(
    [
      getAddresses({ tokenAddress: tokenContract }),
      getFounders({ address: tokenContract }),
      fetchDelegates(totalSupply),
    ]
  );

  const addresses =
    addressesResult.status === "fulfilled"
      ? addressesResult.value
      : getFallbackAddresses();
  const founders =
    foundersResult.status === "fulfilled" ? foundersResult.value : [];
  const resolvedNames = await resolveEnsNames([
    ...founders.map((founder) => founder.wallet),
    ...(delegates.status === "fulfilled"
      ? delegates.value.map((delegate) => delegate.address)
      : []),
  ]);
  const foundersWithDisplayNames = founders.map((founder) => ({
    ...founder,
    displayName: resolvedNames.get(founder.wallet.toLowerCase()) ?? null,
  }));
  const delegatesWithDisplayNames =
    delegates.status === "fulfilled"
      ? delegates.value.map((delegate) => ({
          ...delegate,
          displayName:
            delegate.displayName ||
            resolvedNames.get(delegate.address.toLowerCase()) ||
            null,
        }))
      : [];

  let treasuryBalance: string | null = null;
  try {
    const balance = await DefaultProvider.getBalance(addresses.treasury);
    treasuryBalance = BigNumber.from(balance.toString()).toHexString();
  } catch (error) {
    console.warn("Unable to load treasury balance", error);
  }

  return {
    props: {
      contract,
      addresses,
      founders: foundersWithDisplayNames,
      delegates: delegatesWithDisplayNames,
      treasuryBalance,
    },
    revalidate: 60,
  };
};

export default function AboutPage({
  contract,
  addresses,
  founders,
  delegates,
  treasuryBalance,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  const totalSupply = useMemo(() => getTotalSupply(contract), [contract]);
  const formattedTreasuryBalance = useMemo(() => {
    if (!treasuryBalance) return "--";

    try {
      return `${formatTreasuryBalance(BigNumber.from(treasuryBalance))} ETH`;
    } catch (error) {
      console.error("Unable to format treasury balance", error);
      return "--";
    }
  }, [treasuryBalance]);
  const stats = [
    { label: "Treasury", value: formattedTreasuryBalance },
    { label: "Chain", value: "Base", isChain: true },
    { label: "Total supply", value: totalSupply || "--" },
    { label: "Owners", value: delegates.length || "--" },
  ];

  const description =
    contract.description ||
    "No DAO description was found in the token metadata.";

  const exportDelegates = () => {
    const rows = [
      ["Delegate", "Votes", "Vote %", "Joined"],
      ...delegates.map((delegate) => [
        delegate.address,
        String(delegate.votes),
        delegate.votePercent.toFixed(2),
        delegate.joined || "",
      ]),
    ];
    const csv = rows
      .map((row) =>
        row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "yellow-collective-delegates.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Layout>
      <Head>
        <title>About | Yellow Collective</title>
      </Head>

      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-10 pb-12">
        <div className="flex items-center justify-between gap-6">
          <div className="flex min-w-0 items-center gap-5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-skin-stroke bg-accent">
              {contract.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={contract.image}
                  alt={contract.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="font-heading text-2xl text-skin-base">YC</span>
              )}
            </div>
            <h1 className="truncate text-[34px] leading-none md:text-[44px]">
              {contract.name || "Yellow Collective"}
            </h1>
          </div>

        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-skin-stroke bg-skin-muted p-4 shadow-sm sm:p-5"
            >
              <div className="text-base text-secondary">{stat.label}</div>
              <div className="mt-3 flex items-center gap-2 font-heading text-2xl leading-none text-skin-base sm:gap-3 sm:text-3xl">
                {stat.isChain && (
                  <Image
                    src="/chains/base.svg"
                    alt=""
                    width={32}
                    height={32}
                    aria-hidden="true"
                    className="h-8 w-8"
                  />
                )}
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        <section className="rounded-2xl border border-skin-stroke bg-skin-muted p-6 shadow-sm md:p-8">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            className="prose prose-skin max-w-none prose-headings:font-heading prose-h2:mb-4 prose-h2:text-3xl prose-p:text-base prose-p:leading-snug prose-a:text-accent-blue prose-a:underline md:prose-p:text-lg"
            components={{
              h1: ({ children }) => (
                <h2 className="mb-5 text-3xl font-bold leading-none">
                  {children}
                </h2>
              ),
              h2: ({ children }) => (
                <h2 className="mb-5 text-3xl font-bold leading-none">
                  {children}
                </h2>
              ),
              a: ({ href, children }) => (
                <a href={href} target="_blank" rel="noreferrer">
                  {children}
                </a>
              ),
            }}
          >
            {description}
          </ReactMarkdown>
        </section>

        <section className="flex flex-col gap-5">
          <h2 className="font-heading text-3xl leading-none">Founders</h2>
          {founders.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {founders.map((founder, index) => (
                <Link
                  key={founder.wallet}
                  href={getProfilePath({
                    address: founder.wallet,
                    ensName: founder.displayName,
                  })}
                  className="yc-dark-yellow-hover-black flex items-center justify-between gap-4 rounded-2xl border border-skin-stroke bg-skin-muted p-5 shadow-sm transition hover:-translate-y-0.5 hover:bg-[#fff7bf] hover:shadow-md"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <span
                      className={`h-10 w-10 shrink-0 rounded-full border border-skin-stroke ${
                        index % 2 === 0
                          ? "bg-gradient-to-br from-white via-cyan-200 to-accent-blue"
                          : "bg-gradient-to-br from-white via-pink-200 to-accent"
                      }`}
                    />
                    <span className="truncate text-base font-bold md:text-lg">
                      {founder.displayName || shortenAddress(founder.wallet, 5)}
                    </span>
                  </div>
                  <span className="font-heading text-xl">
                    {founder.ownershipPct}%
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-skin-stroke bg-skin-muted p-6 text-base text-secondary md:text-lg">
              No founders allocation found.
            </div>
          )}
        </section>

        <section className="flex flex-col gap-5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-heading text-3xl leading-none">Delegates</h2>
            <button
              type="button"
              onClick={exportDelegates}
              disabled={delegates.length === 0}
              className="yc-dark-yellow-button rounded-[18px] border border-skin-stroke bg-white px-5 py-3 font-heading text-lg shadow-[0px_4.02px_0px_0px_rgb(var(--color-shadow-neutral))] transition hover:-translate-y-0.5 hover:bg-[#fff7bf] hover:shadow-[0px_6px_0px_0px_rgb(var(--color-shadow-neutral))] active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
            >
              Export CSV
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-skin-stroke bg-skin-muted shadow-sm">
            <div className="max-h-[620px] overflow-auto">
              <div className="grid min-w-[760px] grid-cols-[1.6fr_1fr_1fr_1fr] gap-6 border-b border-skin-stroke p-5 font-heading text-xl">
                <div>Delegate</div>
                <div>Votes</div>
                <div>Vote %</div>
                <div>Joined</div>
              </div>

              {delegates.length > 0 ? (
                delegates.map((delegate, index) => (
                  <Link
                    key={delegate.address}
                    href={getProfilePath({
                      address: delegate.address,
                      ensName: delegate.displayName,
                    })}
                    className="yc-dark-yellow-hover-black grid min-w-[760px] grid-cols-[1.6fr_1fr_1fr_1fr] items-center gap-6 p-5 text-base transition hover:bg-[#fff7bf] md:text-lg"
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <span
                        className={`h-9 w-9 shrink-0 rounded-full border border-skin-stroke ${
                          index % 3 === 0
                            ? "bg-gradient-to-br from-white via-cyan-200 to-accent-blue"
                            : index % 3 === 1
                              ? "bg-gradient-to-br from-white via-pink-200 to-accent"
                              : "bg-gradient-to-br from-white via-lime-200 to-cyan-300"
                        }`}
                      />
                      <span className="truncate">
                        {delegate.displayName ||
                          shortenAddress(delegate.address, 5)}
                      </span>
                    </div>
                    <div>{delegate.votes} Tokens</div>
                    <div>{delegate.votePercent.toFixed(2)}%</div>
                    <div>{delegate.joined || "--"}</div>
                  </Link>
                ))
              ) : (
                <div className="p-6 text-base text-secondary md:text-lg">
                  Delegate data is not available from the members API yet.
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
