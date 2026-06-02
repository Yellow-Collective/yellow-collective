import Layout from "@/components/Layout";
import { isAdminAddress } from "@/utils/admin";
import { getNounsMetagovEnabled } from "data/nouns-metagov";
import {
  getNounsDaoProposals,
  type NounsDaoProposal,
} from "data/nouns-dao/proposals";
import type { GetStaticPropsResult, InferGetStaticPropsType } from "next";
import Head from "next/head";
import Link from "next/link";
import useSWR from "swr";
import { useAccount } from "wagmi";

type NounsProposalsPageProps = {
  proposals: Omit<NounsDaoProposal, "description">[];
  latestBlock: number;
  nounsMetagovEnabled: boolean;
};

const nounsSettingsFetcher = async (url: string) => {
  const response = await fetch(url, { cache: "no-store" });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Unable to load Nouns metagov settings.");
  }

  return data as { nounsMetagovEnabled: boolean };
};

const getTimestamp = (value: string) => Number(value || 0);

const formatDate = (timestamp: string) => {
  const value = getTimestamp(timestamp);
  if (!value) return "";

  return new Date(value * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
};

const getDaysFromTimestamp = (timestamp: string) => {
  const value = getTimestamp(timestamp);
  if (!value) return "";

  const diff = Date.now() - value * 1000;
  const days = Math.max(1, Math.round(diff / 86400000));
  return days === 1 ? "1 day ago" : `${days} days ago`;
};

const getStatus = (state: number) => {
  switch (state) {
    case 0:
      return {
        label: "Upcoming",
        className: "bg-skin-proposal-highlighted text-white",
      };
    case 9:
      return {
        label: "Upcoming",
        className: "bg-skin-proposal-highlighted text-white",
      };
    case 10:
      return {
        label: "Upcoming",
        className: "bg-skin-proposal-highlighted text-white",
      };
    case 1:
      return {
        label: "Active",
        className: "bg-skin-proposal-highlighted text-white",
      };
    case 2:
      return {
        label: "Canceled",
        className: "bg-skin-proposal-muted text-white",
      };
    case 3:
      return {
        label: "Defeated",
        className: "bg-skin-proposal-danger text-white",
      };
    case 4:
      return {
        label: "Succeeded",
        className: "bg-skin-proposal-success text-white",
      };
    case 5:
      return {
        label: "Queued",
        className: "bg-[#ffcc00] text-[#212529]",
      };
    case 6:
      return {
        label: "Expired",
        className: "bg-skin-proposal-muted text-white",
      };
    case 7:
      return {
        label: "Executed",
        className: "bg-skin-proposal-success text-white",
      };
    case 8:
      return {
        label: "Vetoed",
        className: "bg-skin-proposal-danger text-white",
      };
    default:
      return {
        label: "Unknown",
        className: "bg-skin-proposal-muted text-white",
      };
  }
};

export const getStaticProps = async (): Promise<
  GetStaticPropsResult<NounsProposalsPageProps>
> => {
  try {
    const proposals = await getNounsDaoProposals();

    return {
      props: {
        proposals: proposals.map(({ description, ...proposal }) => proposal),
        latestBlock: 0,
        nounsMetagovEnabled: await getNounsMetagovEnabled(),
      },
      revalidate: 60,
    };
  } catch (error) {
    console.warn("Unable to load Nouns DAO proposals", error);

    return {
      props: {
        proposals: [],
        latestBlock: 0,
        nounsMetagovEnabled: true,
      },
      revalidate: 60,
    };
  }
};

export default function NounsProposalsPage({
  proposals,
  nounsMetagovEnabled,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  const { address, isConnected } = useAccount();
  const { data: nounsSettings } = useSWR(
    "/api/nouns/settings",
    nounsSettingsFetcher,
    {
      fallbackData: { nounsMetagovEnabled },
    }
  );
  const currentNounsMetagovEnabled =
    nounsSettings?.nounsMetagovEnabled ?? nounsMetagovEnabled;
  const canAccessNouns = currentNounsMetagovEnabled || isAdminAddress(address);

  return (
    <Layout>
      <Head>
        <title>Nouns DAO Proposals | Yellow Collective</title>
      </Head>

      <div className="yc-mobile-dark-page -m-6 min-h-screen bg-skin-backdrop p-6 sm:m-0 sm:min-h-0 sm:bg-transparent sm:p-0">
        <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-8 pb-12">
          {!canAccessNouns ? (
            <NounsAccessGate isConnected={isConnected} />
          ) : (
            <>
              <div className="flex flex-col items-center gap-5 text-center lg:flex-row lg:items-center lg:justify-between lg:text-left">
                <div className="flex w-full flex-col items-center gap-3 lg:w-auto lg:flex-row lg:items-center lg:gap-5">
                  <h1 className="text-[36px] leading-none md:text-[44px]">
                    Proposals
                  </h1>
                  <div className="flex w-full max-w-[248px] gap-1 rounded-xl border border-[rgb(var(--color-selector-stroke))] bg-[#f1f1f1] p-1 shadow-[0px_3px_0px_0px_rgb(var(--color-selector-stroke))] lg:w-fit lg:max-w-none lg:gap-1.5 lg:shadow-[0px_4px_0px_0px_rgb(var(--color-selector-stroke))]">
                    <Link
                      href="/proposals"
                      className="proposal-tab-button flex min-h-11 flex-1 items-center justify-center rounded-lg px-3 py-2 text-center font-heading text-sm leading-tight transition hover:bg-[#fff7bf] lg:flex-none lg:px-5 lg:py-3 lg:text-base"
                    >
                      Yellow Collective
                    </Link>
                    <Link
                      href="/proposals/nouns"
                      className="proposal-tab-button flex min-h-11 flex-1 translate-y-[-1px] items-center justify-center rounded-lg bg-accent px-3 py-2 text-center font-heading text-sm leading-tight shadow-[0px_2px_0px_0px_#b89400] transition lg:flex-none lg:px-5 lg:py-3 lg:text-base lg:shadow-[0px_3px_0px_0px_#b89400]"
                    >
                      Nouns DAO
                    </Link>
                  </div>
                </div>

                <p className="max-w-[520px] text-base leading-snug text-secondary">
                  Nouns DAO proposals for Yellow Collective meta-governance.
                </p>
              </div>

              <div className="flex flex-col gap-5">
                {proposals.length > 0 ? (
                  proposals.map((proposal) => (
                    <ProposalRow
                      key={proposal.proposalId}
                      proposal={proposal}
                    />
                  ))
                ) : (
                  <div className="rounded-2xl border border-skin-stroke bg-skin-muted p-8 text-base text-secondary md:text-lg">
                    No Nouns DAO proposals found.
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}

const NounsAccessGate = ({ isConnected }: { isConnected: boolean }) => (
  <section className="rounded-2xl border border-skin-stroke bg-skin-muted p-8 text-center shadow-sm">
    <h1 className="font-heading text-[36px] leading-none text-skin-base md:text-[44px]">
      Nouns proposals are turned off
    </h1>
    <p className="mx-auto mt-4 max-w-2xl text-base leading-snug text-secondary md:text-lg">
      Nouns proposals and Yellow metagov are currently disabled.{" "}
      {isConnected
        ? "Only connected admin wallets can access this area."
        : "Connect an admin wallet to access this area."}
    </p>
    <Link
      href="/proposals"
      className="mt-6 inline-flex rounded-[18px] bg-accent px-6 py-3 font-heading text-lg leading-none text-skin-base shadow-[0px_4.02px_0px_0px_#b89400] transition hover:-translate-y-0.5 hover:bg-[#ffd84d] hover:shadow-[0px_6px_0px_0px_#b89400] active:translate-y-1 active:shadow-none"
    >
      Back to Yellow proposals
    </Link>
  </section>
);

const ProposalRow = ({
  proposal,
}: {
  proposal: Omit<NounsDaoProposal, "description">;
}) => {
  const status = getStatus(proposal.state);

  return (
    <Link
      href={`/proposals/nouns/${proposal.proposalNumber}`}
      className="proposal-hover-row grid min-h-[96px] grid-cols-[34px_1fr] items-start gap-4 rounded-2xl border border-skin-stroke bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:bg-white hover:shadow-[0px_6px_0px_0px_rgb(var(--color-shadow-neutral))] md:grid-cols-[44px_1fr_auto] md:items-center"
    >
      <div className="font-heading text-xl text-skin-base">
        {proposal.proposalNumber}
      </div>

      <div className="min-w-0">
        <h2 className="text-center font-heading text-xl leading-tight text-skin-base md:truncate md:text-left md:text-2xl md:leading-none">
          {proposal.title}
        </h2>
        <div className="mt-3 flex items-center justify-between gap-3 text-base text-secondary md:block md:text-lg">
          <span>{formatDate(proposal.timeCreated)}</span>
          <div
            className={`${status.className} w-auto shrink-0 rounded-md p-1 px-2 text-center font-heading text-xs md:hidden`}
          >
            {status.label}
          </div>
        </div>
      </div>

      <div className="hidden items-center justify-start gap-5 md:col-span-1 md:flex md:justify-end">
        <div className="hidden text-base text-secondary sm:block md:text-lg">
          {getDaysFromTimestamp(proposal.timeCreated)}
        </div>
        <div
          className={`${status.className} w-24 rounded-md p-1 px-2 text-center font-heading text-sm md:text-base`}
        >
          {status.label}
        </div>
      </div>
    </Link>
  );
};
