import WalletIdentityLink from "@/components/WalletIdentityLink";
import { useDAOAddresses, useGetAllProposals } from "hooks/fetch";
import { TOKEN_CONTRACT } from "constants/addresses";
import Image from "next/image";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import { getProposalName } from "@/utils/getProposalName";
import ProposalStatus from "@/components/ProposalStatus";
import Link from "next/link";
import { ArrowLeftIcon } from "@heroicons/react/20/solid";
import { getProposalDescription } from "@/utils/getProposalDescription";
import ModalWrapper from "@/components/ModalWrapper";
import VoteModal from "@/components/VoteModal";
import ProposalTabs from "@/components/ProposalTabs";
import ProposalTransactions from "@/components/ProposalTransactions";
import ProposalPropdates from "@/components/ProposalPropdates";
import ProposalVoteList, { ProposalVote } from "@/components/ProposalVoteList";
import ProposalVoteSummary from "@/components/ProposalVoteSummary";
import ProposalLifecycleAction from "@/components/ProposalLifecycleAction";
import { Fragment, useEffect, useState } from "react";
import {
  PREVIEW_PROPOSAL_ID,
  Proposal,
} from "@/services/nouns-builder/governor";
import useSWR from "swr";
import { useUserVotes } from "@/hooks/fetch/useUserVotes";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { findProposalByRouteParam } from "@/utils/proposal-routing";

const proposalMarkdownClassName =
  "prose prose-skin mt-4 max-w-[90vw] break-words prose-img:w-auto prose-headings:font-heading prose-h2:text-3xl prose-h2:leading-tight prose-h3:text-2xl prose-h3:leading-tight prose-h4:text-xl prose-h4:leading-snug prose-h5:text-lg prose-h5:leading-snug prose-h6:text-base prose-h6:leading-snug sm:max-w-[1000px]";

export default function ProposalComponent() {
  const [onchainState, setOnchainState] = useState<number>();
  const { data: addresses } = useDAOAddresses({
    tokenContract: TOKEN_CONTRACT,
  });
  const { data: proposals } = useGetAllProposals({
    governorContract: addresses?.governor,
  });

  const router = useRouter();
  const { proposalid } = router.query;

  const proposal = findProposalByRouteParam(proposals, proposalid);
  const proposalNumber = proposal?.proposalNumber || 0;

  useEffect(() => {
    setOnchainState(undefined);
  }, [proposal?.proposalId]);

  useEffect(() => {
    if (
      !proposal ||
      router.pathname !== "/proposals/[proposalid]" ||
      typeof proposalid !== "string" ||
      /^\d+$/.test(proposalid)
    ) {
      return;
    }

    void router.replace(`/proposals/${proposal.proposalNumber}`, undefined, {
      shallow: true,
    });
  }, [proposal, proposalid, router]);

  const { data: proposalVotes, isLoading: proposalVotesLoading } = useSWR<
    ProposalVote[]
  >(
    addresses?.governor && proposal?.proposalId
      ? `/api/governor/${addresses.governor}/proposals/${proposal.proposalId}/votes`
      : undefined
  );

  if (!proposal)
    return (
      <Layout>
        <div className="flex items-center justify-around mt-8">
          <Image src={"/spinner.svg"} alt="spinner" width={30} height={30} />
        </div>
      </Layout>
    );

  const displayedProposal =
    onchainState === undefined ? proposal : { ...proposal, state: onchainState };
  const { forVotes, againstVotes, abstainVotes, voteEnd, voteStart } =
    displayedProposal.proposal;

  const getVotePercentage = (votes: number) => {
    if (!proposal || !votes) return 0;
    const total = forVotes + againstVotes + abstainVotes;

    const value = Math.round((votes / total) * 100);
    if (value > 100) return 100;
    return value;
  };

  const getDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);

    const month = date.toLocaleString("default", { month: "long" });
    return `${month} ${date.getDate()}, ${date.getFullYear()}`;
  };

  const getTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);

    const hours = date.getHours() % 12;
    const minutes = date.getMinutes().toString().padStart(2, "0");

    return `${hours}:${minutes} ${date.getHours() >= 12 ? "PM" : "AM"}`;
  };

  return (
    <Layout>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start">
          <Link
            href="/proposals"
            className="yc-dark-yellow-button mr-3 flex h-11 min-h-[2.75rem] w-11 min-w-[2.75rem] flex-none items-center justify-center rounded-full border border-skin-stroke bg-white shadow-[0px_4.02px_0px_0px_rgb(var(--color-shadow-neutral))] transition hover:-translate-y-0.5 hover:bg-[#fff7bf] hover:shadow-[0px_6px_0px_0px_rgb(var(--color-shadow-neutral))] active:translate-y-1 active:shadow-none sm:mr-4"
          >
            <ArrowLeftIcon className="h-4 text-skin-base" />
          </Link>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="mr-0 font-heading text-lg text-skin-base sm:mr-2 sm:text-2xl">
                Proposal {proposalNumber}
              </div>
              <ProposalStatus
                proposal={displayedProposal}
                className="w-auto shrink-0 px-2 py-1 text-xs sm:w-24 sm:text-base"
              />
            </div>
            <div className="mt-2 break-words font-heading text-[34px] font-semibold leading-[0.95] text-skin-base sm:text-5xl">
              {getProposalName(proposal.description)}
            </div>
            <div className="mt-3 text-lg font-heading text-skin-muted sm:mt-4 sm:text-2xl">
              Proposed by{" "}
              <WalletIdentityLink
                address={proposal.proposal.proposer}
                className="text-skin-highlighted underline"
              />
            </div>
          </div>
        </div>

        <div className="w-full sm:w-auto">
          <VoteButton
            proposal={displayedProposal}
            proposalNumber={proposalNumber}
          />
          <ProposalLifecycleAction
            proposal={proposal}
            governorAddress={addresses?.governor}
            onStateChange={setOnchainState}
          />
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
        metrics={[
          {
            label: "Threshold",
            value: `${displayedProposal.proposal.quorumVotes || 1} Quorum`,
          },
          {
            label: "Ends",
            eyebrow: getTime(voteEnd),
            value: getDate(voteEnd),
          },
          {
            label: "Snapshot",
            eyebrow: getTime(voteStart),
            value: getDate(voteStart),
          },
        ]}
      />

      <div>
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
                      className={proposalMarkdownClassName}
                      rehypePlugins={[rehypeRaw, rehypeSanitize]}
                      remarkPlugins={[remarkGfm]}
                    >
                      {getProposalDescription(proposal.description)}
                    </ReactMarkdown>
                  </section>

                  <ProposalTransactions
                    className="mt-6"
                    transactions={proposal.targets.map((target, index) => ({
                      target,
                      value: proposal.values[index],
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
            {
              id: "propdates",
              label: "Propdates",
              content: <ProposalPropdates proposalId={proposal.proposalId} />,
            },
          ]}
        />
      </div>
    </Layout>
  );
}

const VoteButton = ({
  proposal,
  proposalNumber,
  className = "",
}: {
  proposal: Proposal;
  proposalNumber: number;
  className?: string;
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const isPreviewProposal = proposal.proposalId === PREVIEW_PROPOSAL_ID;
  const { data: userVotes } = useUserVotes({
    timestamp: proposal.proposal.timeCreated,
  });

  if (
    proposal.state !== 1 ||
    (!isPreviewProposal && (!userVotes || userVotes < 1))
  )
    return <Fragment />;

  return (
    <Fragment>
      <ModalWrapper
        className="w-full max-w-lg border border-skin-stroke bg-skin-backdrop"
        open={modalOpen}
        setOpen={setModalOpen}
      >
        <VoteModal
          proposal={proposal}
          proposalNumber={proposalNumber}
          setOpen={setModalOpen}
        />
      </ModalWrapper>
      <button
        className={`yc-dark-submit-blue w-full rounded-[18px] bg-[#1d9bf0] px-4 py-3 font-heading text-base text-white shadow-[0px_4.02px_0px_0px_#0f5f99] transition hover:-translate-y-0.5 hover:bg-[#45adf5] hover:shadow-[0px_6px_0px_0px_#0f5f99] active:translate-y-1 active:shadow-none sm:w-auto ${className}`}
        onClick={() => setModalOpen(true)}
      >
        Submit vote
      </button>
    </Fragment>
  );
};
