import Layout from "@/components/Layout";
import ProposalStatus from "@/components/ProposalStatus";
import { getProposalName } from "@/utils/getProposalName";
import { Proposal } from "@/services/nouns-builder/governor";
import { TOKEN_CONTRACT } from "constants/addresses";
import { getNounsMetagovEnabled } from "data/nouns-metagov";
import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import Head from "next/head";
import Link from "next/link";
import { useDAOAddresses, useGetAllProposals } from "hooks";
import { getYellowProposalPath } from "@/utils/proposal-routing";

type ProposalsPageProps = {
  nounsMetagovEnabled: boolean;
};

export const getServerSideProps: GetServerSideProps<
  ProposalsPageProps
> = async () => {
  try {
    return {
      props: {
        nounsMetagovEnabled: await getNounsMetagovEnabled(),
      },
    };
  } catch (error) {
    console.error("Unable to load Nouns metagov settings", error);
    return {
      props: {
        nounsMetagovEnabled: true,
      },
    };
  }
};

const formatDate = (timestamp: number) => {
  if (!timestamp) return "";

  return new Date(timestamp * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
};

const getDaysFromNow = (timestamp: number, futurePrefix: string) => {
  if (!timestamp) return "";

  const diff = timestamp * 1000 - Date.now();
  const days = Math.max(1, Math.round(Math.abs(diff) / 86400000));

  if (diff >= 0) {
    return days === 1
      ? `${futurePrefix} in 1 day`
      : `${futurePrefix} in ${days} days`;
  }

  return days === 1 ? "1 day ago" : `${days} days ago`;
};

const getTimingLabel = (proposal: Proposal) => {
  const now = Date.now() / 1000;

  if (now <= proposal.proposal.voteEnd) {
    return getDaysFromNow(proposal.proposal.voteEnd, "Ends");
  }
  if (proposal.state === 5) {
    return getDaysFromNow(proposal.proposal.voteEnd, "Expires");
  }
  if (proposal.state === 7) {
    return getDaysFromNow(proposal.proposal.timeCreated, "Created");
  }
  return "";
};

export default function ProposalsPage({
  nounsMetagovEnabled,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const { data: addresses } = useDAOAddresses({
    tokenContract: TOKEN_CONTRACT,
  });
  const {
    data: proposals,
    error,
    isLoading,
  } = useGetAllProposals({
    governorContract: addresses?.governor,
  });

  return (
    <Layout>
      <Head>
        <title>Proposals | Yellow Collective</title>
      </Head>

      <div className="yc-mobile-dark-page -m-6 min-h-screen bg-skin-backdrop p-6 sm:m-0 sm:min-h-0 sm:bg-transparent sm:p-0">
        <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-8 pb-12">
          <div className="flex flex-col items-center gap-4 text-center md:flex-row md:items-center md:justify-between md:text-left">
            <div className="flex w-full flex-col items-center gap-3 md:w-auto md:flex-row md:items-center md:gap-5">
              <h1 className="text-[36px] leading-none md:text-[44px]">
                Proposals
              </h1>
              {nounsMetagovEnabled && (
                <div className="flex w-full max-w-[248px] gap-1 rounded-xl border border-[rgb(var(--color-selector-stroke))] bg-[#f1f1f1] p-1 shadow-[0px_3px_0px_0px_rgb(var(--color-selector-stroke))] md:w-fit md:max-w-none md:gap-1.5 md:shadow-[0px_4px_0px_0px_rgb(var(--color-selector-stroke))]">
                  <Link
                    href="/proposals"
                    className="proposal-tab-button flex min-h-11 flex-1 translate-y-[-1px] items-center justify-center rounded-lg bg-accent px-3 py-2 text-center font-heading text-sm leading-tight shadow-[0px_2px_0px_0px_#b89400] transition md:flex-none md:px-5 md:py-3 md:text-base md:shadow-[0px_3px_0px_0px_#b89400]"
                  >
                    Yellow Collective
                  </Link>
                  <Link
                    href="/proposals/nouns"
                    className="proposal-tab-button flex min-h-11 flex-1 items-center justify-center rounded-lg px-3 py-2 text-center font-heading text-sm leading-tight transition hover:bg-[#fff7bf] md:flex-none md:px-5 md:py-3 md:text-base"
                  >
                    Nouns DAO
                  </Link>
                </div>
              )}
            </div>
            <Link
              href="/create-proposal"
              className="w-full max-w-[248px] rounded-[18px] bg-[#1d9bf0] px-6 py-3 text-center font-heading text-lg leading-none text-white shadow-[0px_4.02px_0px_0px_#0f5f99] transition hover:-translate-y-0.5 hover:bg-[#45adf5] hover:shadow-[0px_6px_0px_0px_#0f5f99] active:translate-y-1 active:shadow-none md:w-auto md:max-w-none md:text-xl"
            >
              Create proposal
            </Link>
          </div>

          <div className="flex flex-col gap-5">
            {isLoading || (!addresses?.governor && !error) ? (
              <div className="rounded-2xl border border-skin-stroke bg-skin-muted p-8 text-base text-secondary md:text-lg">
                Loading proposals...
              </div>
            ) : error ? (
              <div className="rounded-2xl border border-skin-stroke bg-skin-muted p-8 text-base text-secondary md:text-lg">
                Unable to load proposals.
              </div>
            ) : proposals && proposals.length > 0 ? (
              proposals.map((proposal) => (
                <ProposalRow
                  key={proposal.proposalId}
                  proposal={proposal}
                />
              ))
            ) : (
              <div className="rounded-2xl border border-skin-stroke bg-skin-muted p-8 text-base text-secondary md:text-lg">
                No proposals found.
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

const ProposalRow = ({
  proposal,
}: {
  proposal: Proposal;
}) => {
  const timingLabel = getTimingLabel(proposal);

  return (
    <Link
      href={getYellowProposalPath(proposal)}
      className="proposal-hover-row grid min-h-[96px] grid-cols-[34px_1fr] items-start gap-4 rounded-2xl border border-skin-stroke bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:bg-white hover:shadow-[0px_6px_0px_0px_rgb(var(--color-shadow-neutral))] md:grid-cols-[44px_1fr_auto] md:items-center"
    >
      <div className="font-heading text-xl text-skin-base">
        {proposal.proposalNumber}
      </div>

      <div className="min-w-0">
        <h2 className="text-center font-heading text-xl leading-tight text-skin-base md:truncate md:text-left md:text-2xl md:leading-none">
          {getProposalName(proposal.description)}
        </h2>
        <div className="mt-3 flex items-center justify-between gap-3 text-base text-secondary md:block md:text-lg">
          <span>{formatDate(proposal.proposal.timeCreated)}</span>
          <ProposalStatus
            proposal={proposal}
            className="w-auto shrink-0 px-2 py-1 text-xs md:hidden"
          />
        </div>
      </div>

      <div className="col-span-2 hidden items-center justify-start gap-5 md:col-span-1 md:flex md:justify-end">
        {timingLabel && (
          <div className="hidden text-base text-secondary sm:block md:text-lg">
            {timingLabel}
          </div>
        )}
        <ProposalStatus proposal={proposal} />
      </div>
    </Link>
  );
};
