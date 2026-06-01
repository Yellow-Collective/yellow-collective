import WalletIdentityLink from "@/components/WalletIdentityLink";
import Layout from "@/components/Layout";
import MetagovStatusCard from "@/components/MetagovStatusCard";
import NounsSnapshotVoteCard from "@/components/NounsSnapshotVoteCard";
import ProposalTabs from "@/components/ProposalTabs";
import ProposalTransactions from "@/components/ProposalTransactions";
import ProposalVoteList, { ProposalVote } from "@/components/ProposalVoteList";
import ProposalVoteSummary from "@/components/ProposalVoteSummary";
import { isAdminAddress } from "@/utils/admin";
import { getNounsMetagovEnabled } from "data/nouns-metagov";
import {
  getNounsDaoProposalByNumber,
  getNounsDaoProposals,
  type NounsDaoProposal,
} from "data/nouns-dao/proposals";
import ArrowLeftIcon from "@heroicons/react/20/solid/ArrowLeftIcon";
import type {
  GetStaticPaths,
  GetStaticPropsResult,
  InferGetStaticPropsType,
} from "next";
import Head from "next/head";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import useSWR from "swr";
import { useAccount } from "wagmi";

type NounsProposalDetailProps = {
  proposal: NounsDaoProposal;
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

const getStatus = (state: number) => {
  switch (state) {
    case 0:
      return { label: "Upcoming", className: "bg-skin-proposal-highlighted" };
    case 9:
      return { label: "Upcoming", className: "bg-skin-proposal-highlighted" };
    case 10:
      return { label: "Upcoming", className: "bg-skin-proposal-highlighted" };
    case 1:
      return { label: "Active", className: "bg-skin-proposal-highlighted" };
    case 2:
      return { label: "Canceled", className: "bg-skin-proposal-muted" };
    case 3:
      return { label: "Defeated", className: "bg-skin-proposal-danger" };
    case 4:
      return { label: "Succeeded", className: "bg-skin-proposal-success" };
    case 5:
      return { label: "Queued", className: "bg-[#ffcc00] text-skin-base" };
    case 6:
      return { label: "Expired", className: "bg-skin-proposal-muted" };
    case 7:
      return { label: "Executed", className: "bg-skin-proposal-success" };
    case 8:
      return { label: "Vetoed", className: "bg-skin-proposal-danger" };
    default:
      return { label: "Unknown", className: "bg-skin-proposal-muted" };
  }
};

export const getStaticPaths: GetStaticPaths = async () => {
  try {
    const proposals = await getNounsDaoProposals();

    return {
      paths: proposals.map((proposal) => ({
        params: { proposalNumber: String(proposal.proposalNumber) },
      })),
      fallback: "blocking",
    };
  } catch {
    return {
      paths: [],
      fallback: "blocking",
    };
  }
};

export const getStaticProps = async ({
  params,
}: {
  params?: { proposalNumber?: string };
}): Promise<GetStaticPropsResult<NounsProposalDetailProps>> => {
  try {
    const proposalNumber = Number(params?.proposalNumber);
    const proposal = Number.isFinite(proposalNumber)
      ? await getNounsDaoProposalByNumber(proposalNumber)
      : undefined;

    if (!proposal) return { notFound: true, revalidate: 60 };

    return {
      props: {
        proposal,
        nounsMetagovEnabled: await getNounsMetagovEnabled(),
      },
      revalidate: 60,
    };
  } catch (error) {
    console.warn(
      `Unable to load Nouns DAO proposal detail ${params?.proposalNumber}`,
      error
    );
    return { notFound: true, revalidate: 60 };
  }
};

export default function NounsProposalDetailPage({
  proposal,
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
  const isAdmin = isAdminAddress(address);
  const canAccessNouns = currentNounsMetagovEnabled || isAdmin;
  const status = getStatus(proposal.state);
  const description = getDescriptionWithoutTitle(proposal);
  const forVotes = Number(proposal.forVotes || 0);
  const againstVotes = Number(proposal.againstVotes || 0);
  const abstainVotes = Number(proposal.abstainVotes || 0);
  const proposalVotesUrl = canAccessNouns
    ? `/api/nouns/proposals/${proposal.proposalNumber}/votes${
        !currentNounsMetagovEnabled && address ? `?viewer=${address}` : ""
      }`
    : null;
  const { data: proposalVotes, isLoading: proposalVotesLoading } =
    useSWR<ProposalVote[]>(proposalVotesUrl);

  const getVotePercentage = (votes: number) => {
    const total = forVotes + againstVotes + abstainVotes;
    if (!votes || !total) return 0;

    const value = Math.round((votes / total) * 100);
    if (value > 100) return 100;
    return value;
  };

  return (
    <Layout>
      <Head>
        <title>
          Nouns Proposal {proposal.proposalNumber} | Yellow Collective
        </title>
      </Head>

      <div className="flex w-full flex-col gap-6 pb-12">
        {!canAccessNouns ? (
          <NounsAccessGate isConnected={isConnected} />
        ) : (
          <>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-start">
                <Link
                  href="/proposals/nouns"
                  className="yc-dark-yellow-button mr-3 flex h-11 min-h-[2.75rem] w-11 min-w-[2.75rem] flex-none items-center justify-center rounded-full border border-skin-stroke bg-white shadow-[0px_4.02px_0px_0px_rgb(var(--color-shadow-neutral))] transition hover:-translate-y-0.5 hover:bg-[#fff7bf] hover:shadow-[0px_6px_0px_0px_rgb(var(--color-shadow-neutral))] active:translate-y-1 active:shadow-none sm:mr-4"
                  aria-label="Back to Nouns DAO proposals"
                >
                  <ArrowLeftIcon className="h-4 text-skin-base" />
                </Link>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="mr-0 font-heading text-lg text-skin-base sm:mr-2 sm:text-2xl">
                      Nouns Proposal {proposal.proposalNumber}
                    </div>
                    <div
                      className={`${status.className} w-auto shrink-0 rounded-md px-2 py-1 text-center text-xs sm:w-24 sm:text-base ${status.className.includes("text-") ? "" : "text-white"}`}
                    >
                      {status.label}
                    </div>
                  </div>
                  <h1 className="mt-2 break-words font-heading text-[34px] font-semibold leading-[0.95] text-skin-base sm:text-5xl">
                    {proposal.title}
                  </h1>
                  <div className="mt-3 text-lg font-heading text-skin-muted sm:mt-4 sm:text-2xl">
                    Proposed by{" "}
                    <WalletIdentityLink
                      address={proposal.proposer}
                      className="text-skin-highlighted underline"
                    />
                  </div>
                </div>
              </div>
            </div>

            <ProposalVoteSummary
              votes={[
                {
                  label: "For",
                  type: "success",
                  value: forVotes,
                  percentage: getVotePercentage(forVotes),
                },
                {
                  label: "Against",
                  type: "danger",
                  value: againstVotes,
                  percentage: getVotePercentage(againstVotes),
                },
                {
                  label: "Abstain",
                  type: "muted",
                  value: abstainVotes,
                  percentage: getVotePercentage(abstainVotes),
                },
              ]}
            />

            {isAdmin && (
              <MetagovStatusCard proposalNumber={proposal.proposalNumber} />
            )}

            <NounsSnapshotVoteCard proposalNumber={proposal.proposalNumber} />

            <ProposalTabs
              items={[
                {
                  id: "description",
                  label: "Description",
                  content: (
                    <>
                      <section className="yc-dark-surface rounded-b-2xl border border-skin-stroke bg-white p-6 shadow-sm sm:rounded-t-2xl md:p-8">
                        <div className="text-2xl font-heading text-skin-base font-bold">
                          Description
                        </div>

                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          className="prose prose-skin mt-4 max-w-[90vw] break-words prose-headings:font-heading prose-p:text-base prose-p:leading-snug prose-a:text-accent-blue prose-a:underline sm:max-w-[1000px] md:prose-p:text-lg"
                          components={{
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

                      <ProposalTransactions
                        className="mt-6"
                        transactions={proposal.targets.map((target, index) => ({
                          target,
                          value: proposal.values[index],
                          signature: proposal.signatures[index],
                          calldata: proposal.calldatas[index],
                        }))}
                      />
                    </>
                  ),
                },
                {
                  id: "votes",
                  label: "Votes",
                  content: (
                    <section className="yc-dark-surface rounded-b-2xl border border-skin-stroke bg-white p-6 shadow-sm sm:rounded-t-2xl md:p-8">
                      <div className="text-2xl font-heading text-skin-base font-bold">
                        Votes
                      </div>
                      <div className="mt-4">
                        <ProposalVoteList
                          votes={proposalVotes}
                          isLoading={proposalVotesLoading}
                        />
                      </div>
                    </section>
                  ),
                },
              ]}
            />
          </>
        )}
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
        ? "Only connected admin wallets can access this proposal."
        : "Connect an admin wallet to access this proposal."}
    </p>
    <Link
      href="/proposals"
      className="mt-6 inline-flex rounded-[18px] bg-accent px-6 py-3 font-heading text-lg leading-none text-skin-base shadow-[0px_4.02px_0px_0px_#b89400] transition hover:-translate-y-0.5 hover:bg-[#ffd84d] hover:shadow-[0px_6px_0px_0px_#b89400] active:translate-y-1 active:shadow-none"
    >
      Back to Yellow proposals
    </Link>
  </section>
);

const normalizeHeading = (value: string) =>
  value
    .replace(/^#+\s*/, "")
    .replace(/\*\*/g, "")
    .trim()
    .toLowerCase();

const getDescriptionWithoutTitle = (proposal: NounsDaoProposal) => {
  const lines = proposal.description.split("\n");
  let firstContentIndex = lines.findIndex((line) => line.trim());

  if (firstContentIndex === -1) return proposal.description;

  while (
    firstContentIndex !== -1 &&
    normalizeHeading(lines[firstContentIndex].trim()) ===
      normalizeHeading(proposal.title)
  ) {
    lines.splice(firstContentIndex, 1);
    firstContentIndex = lines.findIndex((line) => line.trim());
  }

  return lines.join("\n").trim();
};
