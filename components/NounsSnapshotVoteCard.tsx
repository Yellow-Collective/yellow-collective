import ModalWrapper from "@/components/ModalWrapper";
import { submitSnapshotVote } from "@/utils/snapshot-vote";
import { SNAPSHOT_SPACE_ID, SNAPSHOT_SPACE_URL } from "constants/metagov";
import { ethers } from "ethers";
import CheckIcon from "@heroicons/react/20/solid/CheckIcon";
import MinusIcon from "@heroicons/react/20/solid/MinusIcon";
import XMarkIcon from "@heroicons/react/20/solid/XMarkIcon";
import Image from "next/image";
import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { useAccount, useSigner } from "wagmi";

type SnapshotProposalState = "pending" | "active" | "closed" | "cancelled";

type SnapshotProposal = {
  id: string;
  title: string;
  choices: string[];
  start: number;
  end: number;
  snapshot: string;
  state: SnapshotProposalState;
  scores: number[];
  scoresTotal: number;
  link: string;
};

type SnapshotVote = {
  id: string;
  voter: string;
  choice: number;
  reason: string;
  vp: number;
  created: number;
};

type SnapshotStatusResponse = {
  space: string;
  spaceUrl: string;
  safeAddress: string;
  proposal: SnapshotProposal | null;
  userVote: SnapshotVote | null;
  userVotingPower: number | null;
};

type VoteChoice = {
  snapshotChoice: 1 | 2 | 3;
  label: "For" | "Against" | "Abstain";
  description: string;
  buttonClassName: string;
  barClassName: string;
  shadowColor: string;
  selectedIcon: JSX.Element;
  selectedIconClassName: string;
};

export default function NounsSnapshotVoteCard({
  proposalNumber,
}: {
  proposalNumber: number;
}) {
  const { address, isConnected } = useAccount();
  const { data: signer } = useSigner();
  const [modalOpen, setModalOpen] = useState(false);
  const [choice, setChoice] = useState<VoteChoice | null>(null);
  const [reason, setReason] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const {
    data,
    error,
    mutate: refreshSnapshot,
  } = useSWR<SnapshotStatusResponse>(
    `/api/metagov/snapshot/nouns/${proposalNumber}${
      address ? `?voter=${address}` : ""
    }`
  );
  const proposal = data?.proposal;
  const isActive = proposal?.state === "active";
  const alreadyVoted = Boolean(data?.userVote);
  const hasCollectiveNoun = Number(data?.userVotingPower || 0) > 0;
  const canSubmitVote = Boolean(
    isConnected && isActive && !alreadyVoted && hasCollectiveNoun
  );
  const selectedChoice = voteChoices.find(
    (option) => option.snapshotChoice === data?.userVote?.choice
  );
  const scoreTotal = proposal?.scoresTotal || 0;

  useEffect(() => {
    if (!isActive) return;

    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 30000);

    return () => window.clearInterval(interval);
  }, [isActive]);

  const statusLabel = useMemo(() => {
    if (!proposal) return "Not created";
    if (proposal.state === "active") {
      return `Active for ${formatSnapshotTimeRemaining(proposal.end, now)}`;
    }
    if (proposal.state === "closed") return "Closed";
    if (proposal.state === "cancelled") return "Cancelled";
    return "Pending";
  }, [now, proposal]);

  const submitVote = async () => {
    if (!proposal || !choice || !signer || !address) return;

    setSubmitting(true);
    setSubmitError("");

    try {
      await submitSnapshotVote({
        signer: signer as ethers.providers.JsonRpcSigner,
        address,
        space: data?.space || SNAPSHOT_SPACE_ID,
        proposal: proposal.id,
        nounsProposalNumber: proposalNumber,
        choice: choice.snapshotChoice,
        reason,
      });
      setModalOpen(false);
      setReason("");
      setChoice(null);
      await refreshSnapshot();
    } catch (error) {
      console.error("Snapshot vote failed", error);
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Unable to submit Snapshot vote."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="yc-dark-yellow-surface mt-2 rounded-2xl border border-skin-stroke bg-white p-6 shadow-[0px_4.02px_0px_0px_rgb(var(--color-shadow-accent))] md:p-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-2xl font-heading text-skin-base font-bold">
            Yellow Collective Snapshot Vote
          </div>
          <div className="mt-2 text-base text-secondary md:text-lg">
            Community voting for Yellow Collective metagovernance on this Nouns
            proposal.
          </div>
        </div>
        <div className="w-fit rounded-md bg-skin-proposal-highlighted px-3 py-1 text-center font-heading text-sm text-white">
          {statusLabel}
        </div>
      </div>

      {error ? (
        <div className="mt-5 rounded-xl border border-skin-proposal-danger bg-white p-4 text-skin-proposal-danger">
          Unable to load Snapshot vote status.
        </div>
      ) : !data ? (
        <div className="mt-5 flex items-center gap-3 text-secondary">
          <Image src="/spinner.svg" alt="spinner" width={20} height={20} />
          Loading Snapshot vote...
        </div>
      ) : !proposal ? (
        <div className="mt-5 rounded-xl border border-skin-stroke bg-skin-muted p-4">
          <div className="font-heading text-lg text-skin-base">
            Snapshot proposal not found.
          </div>
          <div className="mt-2 text-base text-secondary">
            Create or publish a Snapshot proposal in {data.space} with a title
            like &quot;{proposalNumber}: Proposal title&quot; before users can
            vote here.
          </div>
          <Link
            href={data.spaceUrl || SNAPSHOT_SPACE_URL}
            target="_blank"
            rel="noreferrer"
            className="yc-dark-force-white mt-4 inline-flex rounded-[18px] bg-skin-button-accent px-4 py-3 font-heading text-base text-skin-inverted shadow-[0px_4.02px_0px_0px_#3f3f3f] transition hover:-translate-y-0.5 hover:bg-skin-button-accent-hover hover:shadow-[0px_6px_0px_0px_#3f3f3f] active:translate-y-1 active:shadow-none"
          >
            Open Snapshot space
          </Link>
        </div>
      ) : (
        <Fragment>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {voteChoices.map((option, index) => {
              const score = proposal.scores[index] || 0;
              const percentage = scoreTotal
                ? Math.round((score / scoreTotal) * 100)
                : 0;

              return (
                <div
                  key={option.snapshotChoice}
                  className="rounded-xl border border-skin-stroke bg-skin-muted p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-heading text-xl text-skin-base">
                      {option.label}
                    </div>
                    <div className="font-heading text-base text-secondary">
                      {percentage}%
                    </div>
                  </div>
                  <div className="mt-3 h-3 overflow-hidden rounded-full bg-[#fff]">
                    <div
                      className={option.barClassName}
                      style={{ width: `${percentage}%`, height: "100%" }}
                    />
                  </div>
                  <div className="mt-2 text-base text-secondary">
                    {score.toLocaleString()} votes
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-base text-secondary">
              {alreadyVoted
                ? selectedChoice
                  ? `You voted ${selectedChoice.label}.`
                  : "You already submitted a Snapshot vote."
                : canSubmitVote
                  ? "Vote by signing a gasless Snapshot message."
                  : isActive && isConnected
                    ? "Only wallets with Collective Noun voting power at this proposal's Snapshot block can vote."
                    : isActive
                      ? "Connect a wallet holding a Collective Noun to vote."
                  : "Voting is not active for this Snapshot proposal."}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href={proposal.link}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-12 items-center justify-center rounded-[18px] border border-[#a90f0c] bg-skin-proposal-danger px-4 font-heading text-base font-bold text-white shadow-[0px_4.02px_0px_0px_#a90f0c] transition hover:-translate-y-0.5 hover:bg-[#f43a35] hover:shadow-[0px_6px_0px_0px_#a90f0c] active:translate-y-1 active:shadow-none"
              >
                View on Snapshot
              </Link>
              <button
                type="button"
                disabled={!canSubmitVote}
                onClick={() => setModalOpen(true)}
                className={`h-12 rounded-[18px] px-4 font-heading text-base font-bold shadow-[0px_4.02px_0px_0px_#3f3f3f] transition enabled:hover:-translate-y-0.5 enabled:hover:shadow-[0px_6px_0px_0px_#3f3f3f] enabled:active:translate-y-1 enabled:active:shadow-none disabled:shadow-none ${
                  canSubmitVote
                    ? "bg-[#1d9bf0] text-white hover:bg-[#45adf5] enabled:shadow-[0px_4.02px_0px_0px_#0f5f99] enabled:hover:shadow-[0px_6px_0px_0px_#0f5f99]"
                    : "border border-skin-stroke bg-[#fff] text-skin-base"
                }`}
              >
                {!isConnected
                  ? "Connect wallet to vote"
                  : alreadyVoted
                    ? "Vote submitted"
                  : !hasCollectiveNoun
                    ? "Collective Noun required"
                    : "Submit vote"}
              </button>
            </div>
          </div>

          <ModalWrapper
            className="w-full max-w-lg border border-skin-stroke bg-skin-backdrop"
            open={modalOpen}
            setOpen={setModalOpen}
          >
            <div className="relative rounded-2xl bg-skin-backdrop p-1 text-skin-base">
              <div className="absolute top-0 right-0">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-full p-1 transition hover:bg-[#fff7bf]"
                  aria-label="Close vote modal"
                >
                  <XMarkIcon className="h-5" />
                </button>
              </div>

              <div className="pr-8">
                <div className="font-heading text-2xl font-bold leading-none">
                  Submit vote
                </div>
                <div className="mt-2 font-heading text-sm font-bold text-secondary">
                  Nouns Proposal {proposalNumber}
                </div>
              </div>

              <div className="yc-vote-options-panel mt-6 rounded-xl border border-skin-stroke bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3">
                  {voteChoices.map((option) => (
                    <button
                      key={option.snapshotChoice}
                      type="button"
                      onClick={() => setChoice(option)}
                      className={`rounded-[22px] border-0 px-5 py-5 text-left font-heading font-bold shadow-[0px_6px_0px_0px_var(--vote-shadow)] transition hover:-translate-y-0.5 hover:shadow-[0px_8px_0px_0px_var(--vote-shadow)] active:translate-y-1 active:shadow-[0px_2px_0px_0px_var(--vote-shadow)] ${option.buttonClassName}`}
                      style={
                        {
                          "--vote-shadow": option.shadowColor,
                        } as React.CSSProperties
                      }
                    >
                      <div className="flex items-center justify-between gap-4">
                        <span className="font-heading text-2xl font-bold leading-none text-white">
                          {option.label}
                        </span>
                        <span
                          className={`flex h-8 w-8 items-center justify-center rounded-full border-2 bg-white font-heading text-xl leading-none shadow-sm ${
                            choice?.snapshotChoice === option.snapshotChoice
                              ? `border-white ${option.selectedIconClassName}`
                              : "border-skin-stroke bg-white"
                          }`}
                        >
                          {choice?.snapshotChoice === option.snapshotChoice
                            ? option.selectedIcon
                            : ""}
                        </span>
                      </div>
                      <div className="mt-3 font-heading text-base font-bold leading-snug text-white/90">
                        {option.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <label className="mt-5 block font-heading text-sm font-bold text-skin-base">
                Reason
              </label>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Optional reason for your vote"
                rows={4}
                className="yc-vote-reason-textarea mt-2 w-full resize-none rounded-xl border border-skin-stroke bg-white px-4 py-3 text-base text-[#212529] shadow-sm placeholder:text-[#454a4e] focus:outline-none focus:ring-2 focus:ring-skin-highlighted"
              />

              {submitError && (
                <div className="mt-4 rounded-xl border border-skin-proposal-danger bg-white p-3 text-sm text-skin-proposal-danger">
                  {submitError}
                </div>
              )}

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="yc-force-white-yellow-hover h-12 flex-1 rounded-xl border border-skin-stroke bg-white font-heading text-base font-bold text-[#212529] transition hover:bg-[#fff7bf]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitVote}
                  disabled={!choice || !signer || submitting}
                  className={`h-12 flex-1 rounded-[18px] px-4 font-heading text-base font-bold shadow-[0px_4.02px_0px_0px_#3f3f3f] transition enabled:hover:-translate-y-0.5 enabled:hover:shadow-[0px_6px_0px_0px_#3f3f3f] enabled:active:translate-y-1 enabled:active:shadow-none disabled:shadow-none ${
                    choice && signer && !submitting
                      ? "yc-dark-submit-blue bg-[#1d9bf0] text-white shadow-[0px_4.02px_0px_0px_#0f5f99] hover:bg-[#45adf5] enabled:hover:shadow-[0px_6px_0px_0px_#0f5f99]"
                      : "bg-skin-button-muted text-[#212529]"
                  }`}
                >
                  {submitting ? (
                    <span className="flex justify-center">
                      <Image
                        src="/spinner.svg"
                        alt="spinner"
                        width={20}
                        height={20}
                      />
                    </span>
                  ) : choice ? (
                    `Submit ${choice.label}`
                  ) : (
                    "Select vote"
                  )}
                </button>
              </div>
            </div>
          </ModalWrapper>
        </Fragment>
      )}
    </section>
  );
}

const voteChoices: VoteChoice[] = [
  {
    snapshotChoice: 1,
    label: "For",
    description: "Support this proposal.",
    buttonClassName: "bg-skin-proposal-success hover:bg-[#13bf62]",
    barClassName: "bg-[#16a34a]",
    shadowColor: "#087a3f",
    selectedIcon: <CheckIcon className="h-5 w-5" />,
    selectedIconClassName: "text-skin-proposal-success",
  },
  {
    snapshotChoice: 2,
    label: "Against",
    description: "Vote against this proposal.",
    buttonClassName: "bg-skin-proposal-danger hover:bg-[#f43a35]",
    barClassName: "bg-[#dc2626]",
    shadowColor: "#a90f0c",
    selectedIcon: <XMarkIcon className="h-5 w-5" />,
    selectedIconClassName: "text-skin-proposal-danger",
  },
  {
    snapshotChoice: 3,
    label: "Abstain",
    description: "Participate without voting for or against.",
    buttonClassName: "bg-skin-proposal-muted hover:bg-[#8a8a8a]",
    barClassName: "bg-[#737373]",
    shadowColor: "#4f4f4f",
    selectedIcon: <MinusIcon className="h-5 w-5" />,
    selectedIconClassName: "text-skin-proposal-muted",
  },
];

const formatSnapshotTimeRemaining = (endTimestamp: number, now: number) => {
  const remainingSeconds = Math.max(
    0,
    Math.floor(endTimestamp - now / 1000)
  );
  const days = Math.floor(remainingSeconds / 86400);
  const hours = Math.floor((remainingSeconds % 86400) / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);

  return `${days}D ${String(hours).padStart(2, "0")}HR ${String(
    minutes
  ).padStart(2, "0")}M`;
};
