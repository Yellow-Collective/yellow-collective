import CustomConnectButton from "@/components/CustomConnectButton";
import Layout from "@/components/Layout";
import WalletIdentityLink from "@/components/WalletIdentityLink";
import { RoundStatusPill } from "@/components/rounds/RoundCard";
import { RoundTimeline } from "@/components/rounds/RoundTimeline";
import { useIsMounted } from "@/hooks/useIsMounted";
import { isAdminAddress } from "@/utils/admin";
import {
  NounPreviewTile,
  PixelPreview,
  buildRandomTraits,
  getSubmissionPreviewTraits,
  type NoundrySubmission,
} from "@/components/noundry/NoundryPreview";
import type {
  RoundSubmission,
  RoundVoteActivity,
  RoundWithSubmissions,
} from "data/rounds";
import type { PlaygroundArtwork } from "data/nouns-builder/artwork";
import { getPublicRoundBySlug } from "data/rounds";
import { getRoundsPublicEnabled } from "data/rounds";
import {
  getRoundState,
  getRoundStateLabel,
  type RoundState,
} from "@/utils/rounds/state";
import { getRoundSignedRequestAction } from "@/utils/rounds/auth";
import { createSignedRequestAuthHeader } from "@/utils/signature-auth-client";
import { TOKEN_NETWORK } from "constants/addresses";
import { ArrowLeftIcon } from "@heroicons/react/20/solid";
import type {
  GetServerSidePropsContext,
  GetServerSidePropsResult,
  InferGetServerSidePropsType,
} from "next";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { useAccount, useSignMessage } from "wagmi";

type RoundDetailProps = {
  round: RoundWithSubmissions | null;
  roundsPublicEnabled: boolean;
  error?: string;
};

const ROUND_SIGNED_REQUEST_CHAIN_ID = Number(TOKEN_NETWORK);

type VotingPowerResponse = {
  votingPower: number;
  usedVotes: number;
  remainingVotes: number;
};

type SubmissionVotesResponse = {
  votes?: RoundVoteActivity[];
  error?: string;
};

const fetcher = async (url: string) => {
  const response = await fetch(url);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Unable to load data.");
  }

  return data;
};

export const getServerSideProps = async ({
  params,
}: GetServerSidePropsContext): Promise<
  GetServerSidePropsResult<RoundDetailProps>
> => {
  const slug = typeof params?.slug === "string" ? params.slug : "";

  try {
    const [round, roundsPublicEnabled] = await Promise.all([
      getPublicRoundBySlug(slug),
      getRoundsPublicEnabled(),
    ]);
    if (!round) return { notFound: true };

    return { props: { round, roundsPublicEnabled } };
  } catch (error) {
    console.error("Unable to load round detail", error);
    return {
      props: {
        round: null,
        roundsPublicEnabled: false,
        error: "Unable to load this round.",
      },
    };
  }
};

export default function RoundDetailPage({
  round,
  roundsPublicEnabled,
  error,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const isMounted = useIsMounted();
  const isAdmin = isMounted && isAdminAddress(address);
  const { signMessageAsync, isLoading: isSigning } = useSignMessage();
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [selectedSubmission, setSelectedSubmission] =
    useState<RoundSubmission | null>(null);
  const [message, setMessage] = useState("");
  const [isVoting, setIsVoting] = useState(false);
  const state = round ? getRoundState(round) : "draft";
  const hasTraitSubmissions = Boolean(
    round?.submissions.some(
      (submission) => submission.submissionType === "trait"
    )
  );
  const { data: artwork } = useSWR<PlaygroundArtwork>(
    hasTraitSubmissions ? "/api/playground/artwork" : null,
    fetcher
  );
  const votingPowerKey =
    round && address
      ? `/api/rounds/${round.slug}/voting-power?wallet=${address}`
      : null;
  const { data: votingPowerData, mutate: mutateVotingPower } =
    useSWR<VotingPowerResponse>(votingPowerKey);

  const allocatedVotes = useMemo(
    () => Object.values(allocations).reduce((total, value) => total + value, 0),
    [allocations]
  );
  const votingPower = votingPowerData?.votingPower || 0;
  const remainingVotes = Math.max(votingPower - allocatedVotes, 0);
  const votingStrategyLabel = getVotingStrategyLabel(round);
  const winners =
    round && state === "ended"
      ? round.submissions.slice(0, round.winnerCount)
      : [];
  const isRoundEnded = state === "ended";

  if (!round) {
    return (
      <Layout>
        <div className="mx-auto max-w-[980px] rounded-2xl border border-skin-stroke bg-white p-6 shadow-sm">
          {error || "Round not found."}
        </div>
      </Layout>
    );
  }

  if (!roundsPublicEnabled && !isAdmin) {
    return (
      <Layout>
        <div className="mx-auto max-w-[980px] rounded-2xl border border-skin-stroke bg-white p-6 shadow-sm">
          Rounds are currently admin-only.
        </div>
      </Layout>
    );
  }

  const updateAllocation = (submissionId: string, nextValue: number) => {
    setMessage("");
    setAllocations((current) => {
      const usedByOtherSubmissions = Object.entries(current).reduce(
        (total, [currentSubmissionId, voteCount]) =>
          currentSubmissionId === submissionId ? total : total + voteCount,
        0
      );
      const maxForSubmission = Math.max(
        votingPower - usedByOtherSubmissions,
        0
      );
      const normalizedValue = Number.isFinite(nextValue)
        ? Math.floor(nextValue)
        : 0;

      return {
        ...current,
        [submissionId]: Math.max(
          0,
          Math.min(maxForSubmission, normalizedValue)
        ),
      };
    });
  };

  const submitVotes = async () => {
    if (!address || allocatedVotes <= 0) return;

    setIsVoting(true);
    setMessage("");

    try {
      const votes = Object.entries(allocations)
        .map(([submissionId, voteCount]) => ({
          submissionId,
          voteCount,
        }))
        .filter((vote) => vote.voteCount > 0);
      const path = `/api/rounds/${round.slug}/vote`;
      const payload = { votes };
      const authorization = await createSignedRequestAuthHeader({
        walletAddress: address,
        chainId: ROUND_SIGNED_REQUEST_CHAIN_ID,
        action: getRoundSignedRequestAction("vote"),
        method: "POST",
        path,
        payload,
        signMessageAsync,
      });
      const response = await fetch(path, {
        method: "POST",
        headers: {
          Authorization: authorization,
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to cast votes.");
      }

      setMessage("Votes submitted.");
      setAllocations({});
      await mutateVotingPower();
      await router.replace(router.asPath, undefined, { scroll: false });
    } catch (voteError) {
      setMessage(
        voteError instanceof Error ? voteError.message : "Unable to cast votes."
      );
    } finally {
      setIsVoting(false);
    }
  };

  return (
    <Layout>
      <Head>
        <title>{round.title} | Yellow Collective Rounds</title>
      </Head>

      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-7 pb-12">
        <Link
          href="/rounds"
          className="flex w-fit items-center gap-2 font-heading text-lg text-skin-base transition hover:opacity-80"
        >
          <span className="yc-dark-yellow-button flex h-10 w-10 items-center justify-center rounded-full border border-skin-stroke bg-white shadow-[0px_4.02px_0px_0px_rgb(var(--color-shadow-neutral))] transition hover:-translate-y-0.5 hover:bg-[#fff7bf] active:translate-y-1 active:shadow-none">
            <ArrowLeftIcon className="h-4 text-skin-base" />
          </span>
          Back to rounds
        </Link>

        <section className="yc-dark-yellow-form-surface rounded-2xl border border-skin-stroke bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <RoundStatusPill status={getRoundStateLabel(state)} state={state} />
            {round.featured && (
              <RoundStatusPill status="featured" state="featured" />
            )}
          </div>
          <h1 className="mt-4 font-heading text-[42px] leading-none text-skin-base md:text-[58px]">
            {round.title}
          </h1>
          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px] lg:items-stretch">
            <div className="flex min-h-[230px] flex-col justify-center rounded-2xl border border-skin-stroke bg-[#fff7bf] p-5">
              <div className="font-heading text-xl leading-none text-skin-base">
                About this round
              </div>
              <p className="mt-2 max-w-3xl text-lg leading-snug text-secondary">
                {round.description}
              </p>
              {round.content && (
                <div className="mt-4 max-w-3xl border-t border-skin-stroke/50 pt-4 text-base leading-snug text-skin-base">
                  {round.content.split("\n").map((paragraph, index) => (
                    <p key={index} className={index > 0 ? "mt-3" : ""}>
                      {paragraph}
                    </p>
                  ))}
                </div>
              )}
              {round.isTraitContest && round.traitSubmissionsEnabled && (
                <p className="mt-4 rounded-xl border border-skin-stroke bg-white px-4 py-3 text-base text-skin-base">
                  This round accepts traits from the Noundry Gallery.
                </p>
              )}
            </div>
            <div className="flex min-h-[230px] overflow-hidden rounded-2xl border border-skin-stroke bg-[#fff7bf]">
              {round.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={round.image}
                  alt={round.title}
                  className="h-full min-h-[230px] w-full object-cover"
                />
              ) : (
                <div className="flex min-h-[230px] w-full items-center justify-center p-8 text-center font-heading text-3xl">
                  {round.title}
                </div>
              )}
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            {state === "submissions_open" && (
              <Link
                href={
                  round.isTraitContest && round.traitSubmissionsEnabled
                    ? "/noundry?tab=gallery"
                    : `/rounds/${round.slug}/submit`
                }
                className="yc-dark-submit-blue rounded-[18px] bg-[#1d9bf0] px-5 py-3 font-heading text-lg text-white shadow-[0px_4.02px_0px_0px_#0f5f99] transition hover:-translate-y-0.5 hover:bg-[#45adf5] active:translate-y-1 active:shadow-none"
              >
                {round.isTraitContest && round.traitSubmissionsEnabled
                  ? "Submit Noundry trait"
                  : "Submit project"}
              </Link>
            )}
          </div>
        </section>

        <RoundTimeline round={round} />

        <RoundDetailsPanel
          round={round}
          stateLabel={getRoundStateLabel(state)}
          votingStrategyLabel={votingStrategyLabel}
        />

        <section className="grid gap-5 lg:grid-cols-2">
          <RoundAwardsPanel round={round} />
          <RoundActivityPanel round={round} state={state} />
        </section>

        {winners.length > 0 && (
          <section className="rounded-2xl border border-skin-stroke bg-accent p-6 text-[#212529] shadow-sm md:p-8">
            <h2 className="font-heading text-3xl leading-none text-[#212529]">
              Winners
            </h2>
            <div className="mt-5 flex flex-col gap-3">
              {winners.map((submission, index) => {
                const award = round.awards?.find(
                  (item) => item.position === index + 1
                );
                const winnerStyle = getWinnerCardStyle(index + 1);

                return (
                  <button
                    type="button"
                    key={submission.id}
                    onClick={() => setSelectedSubmission(submission)}
                    className="group relative overflow-hidden rounded-xl border-2 border-skin-stroke bg-accent p-4 text-left text-[#212529] shadow-[0px_4px_0px_0px_rgb(var(--color-shadow-accent))] transition hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-skin-highlighted"
                  >
                    <WinnerGlimmer withBorder={false} />
                    <div className="relative z-10 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="flex min-w-0 items-center gap-4">
                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-heading text-lg leading-none ${winnerStyle.pillClass}`}
                        >
                          <WinnerBadge rank={index + 1} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-[#212529]">
                            Winner #{index + 1}
                          </div>
                          <h3 className="mt-1 break-words font-heading text-2xl leading-none text-[#212529]">
                            {submission.title}
                          </h3>
                          <div className="mt-2 text-sm font-semibold text-[#212529]">
                            {formatSubmissionAuthor(submission.walletAddress)}
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col gap-2 md:items-end">
                        <span className="w-fit rounded-full bg-[#1d9bf0] px-3 py-1 font-heading text-sm text-white shadow-[0px_3px_0px_0px_#0f5f99]">
                          {submission.voteCount} votes
                        </span>
                        {award && (
                          <span className="text-sm leading-snug text-[#212529]">
                            Prize: {award.title}
                            {award.value ? ` (${award.value})` : ""}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {state === "voting_open" && (
          <section className="yc-dark-yellow-form-surface rounded-2xl border border-skin-stroke bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="font-heading text-3xl leading-none text-skin-base">
                  Voting
                </h2>
                <p className="mt-2 text-base text-secondary">
                  {votingStrategyLabel}. Server verification happens when votes
                  are submitted.
                </p>
              </div>
              {isConnected ? (
                <div className="rounded-xl bg-[#fff7bf] px-4 py-3 text-sm text-secondary">
                  <span className="font-heading text-lg text-skin-base">
                    {votingPower}
                  </span>{" "}
                  votes available
                </div>
              ) : (
                <CustomConnectButton className="h-11 rounded-xl border border-skin-stroke bg-skin-backdrop px-6 text-skin-base" />
              )}
            </div>
            {message && (
              <p className="mt-4 rounded-xl border border-skin-stroke bg-skin-muted p-3 text-sm text-secondary">
                {message}
              </p>
            )}
          </section>
        )}

        <section className="yc-dark-yellow-form-surface rounded-2xl border border-skin-stroke bg-accent p-5 text-[#212529] shadow-[0px_4.02px_0px_0px_rgb(var(--color-shadow-accent))] md:p-6">
          <div className="flex items-end justify-between gap-3">
            <h2 className="font-heading text-[34px] leading-none text-[#212529]">
              Submissions
            </h2>
            <span className="self-start rounded-full bg-[#c93d2f] px-3 py-1 font-heading text-sm text-white shadow-[0px_3px_0px_0px_#7f2219]">
              {round.submissions.length}
            </span>
          </div>
          {round.submissions.length > 0 ? (
            <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {round.submissions.map((submission, index) => (
                <SubmissionCard
                  key={submission.id}
                  submission={submission}
                  rank={index + 1}
                  isWinner={state === "ended" && index < round.winnerCount}
                  isRoundEnded={isRoundEnded}
                  canVote={state === "voting_open" && votingPower > 0}
                  allocation={allocations[submission.id] || 0}
                  remainingVotes={remainingVotes}
                  onChange={(value) => updateAllocation(submission.id, value)}
                  onOpen={() => setSelectedSubmission(submission)}
                  artwork={artwork}
                  showRank={state === "voting_open" || state === "ended"}
                  showVoteCount={state === "voting_open" || state === "ended"}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-skin-stroke bg-[#fff7bf] p-8 text-center text-[#212529] shadow-[0px_4.02px_0px_0px_rgb(var(--color-shadow-accent))]">
              No approved submissions yet.
            </div>
          )}
        </section>

        {state === "voting_open" && votingPower > 0 && (
          <div className="yc-dark-yellow-form-surface sticky bottom-[calc(1rem+env(safe-area-inset-bottom)+var(--miniapp-safe-area-bottom))] z-30 rounded-2xl border border-skin-stroke bg-accent p-4 shadow-[0px_4.02px_0px_0px_rgb(var(--color-shadow-accent))]">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="text-base text-secondary">
                Allocating{" "}
                <span className="font-heading text-xl text-skin-base">
                  {allocatedVotes}
                </span>{" "}
                of {votingPower} votes
              </div>
              <button
                type="button"
                onClick={submitVotes}
                disabled={
                  allocatedVotes <= 0 ||
                  allocatedVotes > votingPower ||
                  isVoting ||
                  isSigning
                }
                className="yc-dark-submit-blue rounded-[18px] bg-[#1d9bf0] px-5 py-3 font-heading text-lg text-white shadow-[0px_4.02px_0px_0px_#0f5f99] transition hover:-translate-y-0.5 hover:bg-[#45adf5] active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isVoting || isSigning ? "Submitting..." : "Submit votes"}
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedSubmission && (
        <SubmissionModal
          round={round}
          submission={selectedSubmission}
          onClose={() => setSelectedSubmission(null)}
          artwork={artwork}
        />
      )}
    </Layout>
  );
}

const SubmissionCard = ({
  submission,
  rank,
  isWinner,
  isRoundEnded,
  canVote,
  allocation,
  remainingVotes,
  onChange,
  onOpen,
  artwork,
  showRank,
  showVoteCount,
}: {
  submission: RoundSubmission;
  rank: number;
  isWinner: boolean;
  isRoundEnded: boolean;
  canVote: boolean;
  allocation: number;
  remainingVotes: number;
  onChange: (value: number) => void;
  onOpen: () => void;
  artwork?: PlaygroundArtwork;
  showRank: boolean;
  showVoteCount: boolean;
}) => {
  const winnerStyle = isWinner ? getWinnerCardStyle(rank) : null;
  const noundrySubmission = getRoundNoundrySubmission(submission);
  const maxAllocation = allocation + remainingVotes;
  const cardClass = isWinner
    ? winnerStyle?.cardClass
    : "border-[#555b60] bg-[#212529] text-white shadow-[0px_4.02px_0px_0px_#4b5563]";
  const imageClass = isWinner ? winnerStyle?.imageClass : "bg-[#2b3035]";
  const primaryTextClass = "text-white";
  const secondaryTextClass = "text-[#dce5f0]";

  return (
    <article
      className={`yc-round-submission-card relative flex h-full flex-col overflow-hidden rounded-2xl border ${cardClass}`}
    >
      {isWinner && <WinnerGlimmer />}
      {showRank && (
        <div
          className={`yc-round-rank-pill absolute left-4 top-4 z-20 flex h-14 min-w-14 items-center justify-center rounded-full px-3 font-heading text-2xl leading-none shadow-[0px_3px_0px_0px_rgba(0,0,0,0.28)] ${
            winnerStyle?.pillClass ||
            (isRoundEnded
              ? "bg-white/95 text-[#212529]"
              : "bg-white/95 text-skin-base")
          }`}
        >
          {isWinner ? <WinnerBadge rank={rank} /> : `#${rank}`}
        </div>
      )}
      <button
        type="button"
        onClick={onOpen}
        className="block text-left transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-skin-highlighted"
        aria-label={`Open ${submission.title}`}
      >
        {noundrySubmission ? (
          <div className={`aspect-square w-full ${imageClass}`}>
            <NounPreviewTile
              artwork={artwork}
              submission={noundrySubmission}
              traits={getSubmissionPreviewTraits(noundrySubmission)}
              showEditedTrait
              fullBleed
            />
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={submission.image}
            alt={submission.title}
            className={`aspect-square w-full object-cover ${imageClass}`}
          />
        )}
      </button>
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            {submission.submissionType === "trait" && (
              <div
                className={`mb-2 w-fit rounded-full px-2 py-0.5 font-heading text-xs ${
                  isRoundEnded || isWinner
                    ? "bg-white/90 text-[#212529]"
                    : "bg-[#dff3ff] text-[#0f5f99]"
                }`}
              >
                Noundry trait
                {submission.traitType ? `: ${submission.traitType}` : ""}
              </div>
            )}
            <button
              type="button"
              onClick={onOpen}
              className={`text-left font-heading text-2xl leading-none underline-offset-4 transition hover:underline focus:outline-none focus:ring-2 focus:ring-skin-highlighted ${primaryTextClass}`}
            >
              {submission.title}
            </button>
          </div>
          {showVoteCount && (
            <div className="rounded-full bg-[#1d9bf0] px-3 py-1 font-heading text-sm text-white shadow-[0px_3px_0px_0px_#0f5f99]">
              {submission.voteCount} votes
            </div>
          )}
        </div>
        <SubmissionDescription
          description={submission.description}
          className={secondaryTextClass}
          compact
        />
        <div className="mt-auto flex items-center justify-between gap-3">
          <WalletIdentityLink
            address={submission.walletAddress}
            ensName={demoAuthorNames[submission.walletAddress.toLowerCase()]}
            className={`font-heading text-base underline ${primaryTextClass}`}
          />
          {canVote && (
            <div className="yc-round-vote-controls flex items-center gap-2 rounded-xl border border-skin-stroke bg-[#f1f1f1] p-1">
              <button
                type="button"
                onClick={() => onChange(allocation - 1)}
                disabled={allocation <= 0}
                className="yc-round-vote-remove h-9 w-9 rounded-lg font-heading text-xl disabled:opacity-40"
                aria-label={`Remove vote from ${submission.title}`}
              >
                -
              </button>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={maxAllocation}
                value={allocation}
                onChange={(event) => onChange(Number(event.target.value))}
                aria-label={`Votes for ${submission.title}`}
                className="h-9 w-16 rounded-lg border border-skin-stroke bg-white text-center font-heading text-lg text-skin-base focus:outline-none focus:ring-2 focus:ring-skin-highlighted"
              />
              <button
                type="button"
                onClick={() => onChange(allocation + 1)}
                disabled={remainingVotes <= 0}
                className="yc-round-vote-add h-9 w-9 rounded-lg font-heading text-xl disabled:opacity-40"
                aria-label={`Add vote to ${submission.title}`}
              >
                +
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
};

const SubmissionDescription = ({
  description,
  className = "",
  compact = false,
}: {
  description: string;
  className?: string;
  compact?: boolean;
}) => {
  const blocks = description
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  const visibleBlocks = compact
    ? blocks.filter((block) => !block.startsWith("#")).slice(0, 1)
    : blocks;

  return (
    <div className={`space-y-3 text-base leading-snug ${className}`}>
      {visibleBlocks.map((block, index) => {
        const heading = block.match(/^#{1,3}\s+(.+)$/);

        if (heading) {
          return (
            <h3 key={index} className="font-heading text-xl leading-none">
              {heading[1]}
            </h3>
          );
        }

        return <p key={index}>{block}</p>;
      })}
    </div>
  );
};

const SubmissionModal = ({
  round,
  submission,
  onClose,
  artwork,
}: {
  round: RoundWithSubmissions;
  submission: RoundSubmission;
  onClose: () => void;
  artwork?: PlaygroundArtwork;
}) => {
  const [isVotesOpen, setIsVotesOpen] = useState(false);
  const noundrySubmission = getRoundNoundrySubmission(submission);
  const noundryPreviewTraits = useMemo(
    () =>
      noundrySubmission ? getSubmissionPreviewTraits(noundrySubmission) : {},
    [noundrySubmission]
  );
  const submittedTraitBase = useMemo(
    () =>
      noundrySubmission && noundryPreviewTraits[noundrySubmission.traitType]
        ? {
            [noundrySubmission.traitType]:
              noundryPreviewTraits[noundrySubmission.traitType],
          }
        : {},
    [noundryPreviewTraits, noundrySubmission]
  );
  const generatedTraits = useMemo(
    () =>
      artwork && noundrySubmission
        ? Array.from({ length: 16 }, (_, index) =>
            buildRandomTraits(
              artwork,
              `${noundrySubmission.id}-generated-${index}`,
              submittedTraitBase
            )
          )
        : [],
    [artwork, submittedTraitBase, noundrySubmission]
  );
  const collectionTraits = useMemo(
    () =>
      artwork && noundrySubmission
        ? Array.from({ length: 16 }, (_, index) =>
            buildRandomTraits(
              artwork,
              `${noundrySubmission.id}-collection-${index}`,
              [1, 6, 11].includes(index) ? submittedTraitBase : {}
            )
          )
        : [],
    [artwork, submittedTraitBase, noundrySubmission]
  );
  const votesKey = isVotesOpen
    ? `/api/rounds/${round.slug}/submissions/${submission.id}/votes`
    : null;
  const {
    data: submissionVotesData,
    error: submissionVotesError,
    isValidating: isVotesLoading,
  } = useSWR<SubmissionVotesResponse>(votesKey);
  const submissionVotes = submissionVotesData?.votes || [];

  return (
    <>
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="round-submission-modal-title"
        onClick={onClose}
      >
        <div
          className="yc-dark-yellow-form-surface max-h-[90vh] w-full max-w-[820px] overflow-y-auto rounded-2xl border border-skin-stroke bg-white shadow-[0px_6px_0px_0px_rgb(var(--color-shadow-neutral))]"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex flex-col p-6 md:p-8">
            <h2
              id="round-submission-modal-title"
              className="break-words font-heading text-[38px] leading-none text-skin-base md:text-[52px]"
            >
              {submission.title}
            </h2>
            <SubmissionDescription
              description={submission.description}
              className="mt-6 max-w-3xl text-secondary"
            />
            {submission.submissionType === "trait" && (
              <div className="mt-4 w-fit rounded-full bg-[#dff3ff] px-3 py-1 font-heading text-sm text-[#0f5f99]">
                Noundry trait
                {submission.traitType ? `: ${submission.traitType}` : ""}
              </div>
            )}
            {noundrySubmission && (
              <div className="mt-5 grid gap-4 md:grid-cols-[1fr_180px]">
                <div className="rounded-2xl border border-skin-stroke bg-white p-3">
                  <div className="mb-2 font-heading text-lg leading-none text-skin-base">
                    Submission description
                  </div>
                  <div className="rounded-xl bg-[#fff7bf] p-4">
                    <SubmissionDescription
                      description={submission.description}
                      className="text-secondary"
                    />
                  </div>
                </div>
                <div className="rounded-2xl border border-skin-stroke bg-white p-3">
                  <div className="mb-2 font-heading text-lg leading-none text-skin-base">
                    Submitted trait
                  </div>
                  <div className="aspect-square rounded-xl bg-[#fff7bf] p-3">
                    <PixelPreview submission={noundrySubmission} />
                  </div>
                </div>
              </div>
            )}
            <div className="mx-auto mt-6 w-full max-w-[420px] overflow-hidden rounded-2xl border border-skin-stroke bg-[#fff7bf]">
              {noundrySubmission ? (
                <NounPreviewTile
                  artwork={artwork}
                  submission={noundrySubmission}
                  traits={noundryPreviewTraits}
                  showEditedTrait
                  fullBleed
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={submission.image}
                  alt={submission.title}
                  className="max-h-[520px] w-full object-contain"
                />
              )}
            </div>
            {noundrySubmission && (
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <NoundryModalPreviewSet
                  artwork={artwork}
                  submission={noundrySubmission}
                  title="Generated with this trait"
                  traits={generatedTraits}
                  editedIndexes={generatedTraits.map((_, index) => index)}
                />
                <NoundryModalPreviewSet
                  artwork={artwork}
                  submission={noundrySubmission}
                  title="Randomized from the collection"
                  traits={collectionTraits}
                  editedIndexes={[1, 6, 11]}
                />
              </div>
            )}
            {submission.url && <SubmissionLinks submission={submission} />}
            <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setIsVotesOpen(true)}
                  className="yc-dark-submit-blue flex items-center justify-center rounded-[18px] bg-[#1d9bf0] px-5 py-3 font-heading text-lg text-white shadow-[0px_4.02px_0px_0px_#0f5f99] transition hover:-translate-y-0.5 hover:bg-[#45adf5] active:translate-y-1 active:shadow-none"
                >
                  Votes
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="yc-dark-yellow-button flex items-center justify-center rounded-[18px] border border-skin-stroke bg-white px-5 py-3 font-heading text-lg text-skin-base shadow-[0px_4.02px_0px_0px_rgb(var(--color-shadow-neutral))] transition hover:-translate-y-0.5 hover:bg-[#fff7bf] active:translate-y-1 active:shadow-none"
                >
                  Close
                </button>
              </div>
              <WalletIdentityLink
                address={submission.walletAddress}
                ensName={
                  demoAuthorNames[submission.walletAddress.toLowerCase()]
                }
                className="break-all text-right text-sm font-semibold text-black"
              />
            </div>
          </div>
        </div>
      </div>
      {isVotesOpen && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="round-submission-votes-title"
          onClick={() => setIsVotesOpen(false)}
        >
          <div
            className="yc-dark-yellow-form-surface w-full max-w-[540px] rounded-2xl border border-skin-stroke bg-white p-6 shadow-[0px_6px_0px_0px_rgb(var(--color-shadow-neutral))]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3
                  id="round-submission-votes-title"
                  className="font-heading text-3xl leading-none text-skin-base"
                >
                  Votes
                </h3>
                <p className="mt-2 text-sm text-secondary">
                  {submission.title}
                </p>
              </div>
              <span className="rounded-full bg-[#c93d2f] px-3 py-1 font-heading text-sm text-white shadow-[0px_3px_0px_0px_#7f2219]">
                {submission.voteCount}
              </span>
            </div>
            <div className="mt-5 max-h-[420px] overflow-y-auto rounded-2xl border border-skin-stroke bg-[#f7f7f7] p-3">
              {isVotesLoading && !submissionVotesData ? (
                <p className="rounded-xl bg-white p-4 text-secondary">
                  Loading votes...
                </p>
              ) : submissionVotesError || submissionVotesData?.error ? (
                <p className="rounded-xl bg-white p-4 text-[#c93d2f]">
                  {submissionVotesData?.error || "Unable to load votes."}
                </p>
              ) : submissionVotes.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {submissionVotes.map((vote) => (
                    <div
                      key={vote.id}
                      className="flex items-center justify-between gap-4 rounded-xl bg-white px-4 py-3"
                    >
                      <WalletIdentityLink
                        address={vote.walletAddress}
                        ensName={
                          demoAuthorNames[vote.walletAddress.toLowerCase()]
                        }
                        className="min-w-0 break-all font-heading text-lg leading-none text-skin-base"
                      />
                      <span className="shrink-0 rounded-full bg-[#1d9bf0] px-3 py-1 font-heading text-sm text-white shadow-[0px_3px_0px_0px_#0f5f99]">
                        {vote.voteCount} votes
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-xl bg-white p-4 text-secondary">
                  No votes recorded for this submission yet.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsVotesOpen(false)}
              className="yc-dark-yellow-button mt-5 flex items-center justify-center rounded-[18px] border border-skin-stroke bg-white px-5 py-3 font-heading text-lg text-skin-base shadow-[0px_4.02px_0px_0px_rgb(var(--color-shadow-neutral))] transition hover:-translate-y-0.5 hover:bg-[#fff7bf] active:translate-y-1 active:shadow-none"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
};

const SubmissionLinks = ({ submission }: { submission: RoundSubmission }) => (
  <section className="mt-5 rounded-2xl border border-skin-stroke bg-[#f7f7f7] p-4">
    <h3 className="font-heading text-lg leading-none text-skin-base">Links</h3>
    <div className="mt-3 flex flex-col gap-2">
      <a
        href={submission.url || "#"}
        target="_blank"
        rel="noreferrer"
        className="flex items-center justify-between gap-3 rounded-xl border border-skin-stroke bg-white px-4 py-3 font-heading text-base text-skin-base underline-offset-4 transition hover:bg-[#fff7bf] hover:underline"
      >
        <span>
          {submission.submissionType === "trait"
            ? "Noundry trait page"
            : "Project link"}
        </span>
        <span className="truncate text-sm font-sans text-secondary">
          {submission.url}
        </span>
      </a>
    </div>
  </section>
);

const NoundryModalPreviewSet = ({
  artwork,
  submission,
  title,
  traits,
  editedIndexes,
}: {
  artwork?: PlaygroundArtwork;
  submission: NoundrySubmission;
  title: string;
  traits: Record<string, string>[];
  editedIndexes: number[];
}) => {
  if (!artwork || traits.length === 0) return null;

  return (
    <section className="rounded-2xl border border-skin-stroke bg-[#f7f7f7] p-3">
      <h3 className="font-heading text-lg leading-none text-skin-base">
        {title}
      </h3>
      <div className="mt-3 grid max-h-[420px] grid-cols-2 gap-2 overflow-y-auto pr-1">
        {traits.map((traitSet, index) => (
          <div
            key={`${title}-${index}`}
            className="overflow-hidden rounded-xl border border-skin-stroke bg-white"
          >
            <NounPreviewTile
              artwork={artwork}
              submission={submission}
              traits={traitSet}
              showEditedTrait={editedIndexes.includes(index)}
              fullBleed
            />
          </div>
        ))}
      </div>
    </section>
  );
};

const WinnerGlimmer = ({ withBorder = true }: { withBorder?: boolean }) => (
  <>
    {withBorder && (
      <div className="pointer-events-none absolute inset-0 z-10 rounded-2xl border-2 border-white/35" />
    )}
    <div className="pointer-events-none absolute inset-0 z-10 rounded-2xl bg-[linear-gradient(120deg,transparent_0%,rgba(255,255,255,0.28)_22%,transparent_44%)] opacity-70" />
  </>
);

const WinnerBadge = ({ rank }: { rank: number }) => {
  if (rank <= 3) return <>{getWinnerBadge(rank)}</>;

  return (
    <span
      className="relative block h-7 w-5"
      aria-label="Blue ribbon"
      role="img"
    >
      <span className="absolute left-1/2 top-0 h-4 w-4 -translate-x-1/2 rounded-full bg-[#1d9bf0] shadow-[inset_0_0_0_3px_#7cc7ff]" />
      <span className="absolute bottom-0 left-[3px] h-4 w-2 -rotate-12 bg-[#1d9bf0] [clip-path:polygon(0_0,100%_0,100%_100%,50%_72%,0_100%)]" />
      <span className="absolute bottom-0 right-[3px] h-4 w-2 rotate-12 bg-[#0f5f99] [clip-path:polygon(0_0,100%_0,100%_100%,50%_72%,0_100%)]" />
    </span>
  );
};

const RoundDetailsPanel = ({
  round,
  stateLabel,
  votingStrategyLabel,
}: {
  round: RoundWithSubmissions;
  stateLabel: string;
  votingStrategyLabel: string;
}) => (
  <section className="yc-dark-yellow-form-surface grid gap-3 rounded-2xl border border-skin-stroke bg-white p-5 shadow-sm md:grid-cols-4">
    <RoundStat label="Status" value={stateLabel} />
    <RoundStat
      label="Winners"
      value={`${round.winnerCount} winner${round.winnerCount === 1 ? "" : "s"}`}
    />
    <RoundStat label="Voting" value={votingStrategyLabel} />
    <RoundStat
      label="Submission type"
      value={
        round.isTraitContest && round.traitSubmissionsEnabled
          ? "Noundry traits"
          : "Projects"
      }
    />
  </section>
);

const RoundStat = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-0 rounded-xl border border-skin-stroke bg-[#fff7bf] p-4">
    <div className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
      {label}
    </div>
    <div className="mt-2 overflow-hidden text-ellipsis whitespace-nowrap font-heading text-xl leading-none text-skin-base">
      {value}
    </div>
  </div>
);

const RoundAwardsPanel = ({ round }: { round: RoundWithSubmissions }) => (
  <article className="yc-dark-yellow-form-surface flex min-h-[320px] flex-col rounded-2xl border border-skin-stroke bg-white p-6 text-skin-base shadow-sm">
    <h2 className="font-heading text-3xl leading-none text-skin-base">
      AWARDS
    </h2>
    <div className="mt-7 flex max-h-[280px] flex-col gap-5 overflow-y-auto pr-2">
      {round.awards && round.awards.length > 0 ? (
        round.awards.map((award) => (
          <div key={award.id} className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-accent">
              {round.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={round.image}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="font-heading text-sm text-skin-base">YC</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="break-words font-heading text-xl leading-none text-skin-base">
                {award.value || award.title}
              </div>
              {award.description && (
                <div className="mt-1 truncate text-sm text-secondary">
                  {award.description}
                </div>
              )}
            </div>
            <span
              className={`rounded-lg px-2.5 py-1 font-heading text-sm leading-none ${getPlacePillClass(
                award.position
              )}`}
            >
              {formatPlace(award.position)}
            </span>
          </div>
        ))
      ) : (
        <p className="rounded-xl border border-dashed border-skin-stroke bg-[#fff7bf] p-4 text-secondary">
          Prize details will be announced by the round admin.
        </p>
      )}
    </div>
  </article>
);

const RoundActivityPanel = ({
  round,
  state,
}: {
  round: RoundWithSubmissions;
  state: RoundState;
}) => {
  const activityItems = getRoundActivityItems(round, state);

  return (
    <article className="yc-dark-yellow-form-surface flex min-h-[320px] flex-col rounded-2xl border border-skin-stroke bg-white p-6 text-skin-base shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-heading text-3xl leading-none text-skin-base">
          ACTIVITY
        </h2>
        <div className="flex items-center gap-2 font-heading text-2xl text-skin-base">
          <span className="text-base text-secondary">votes</span>
          {round.totalVotes || 0}
        </div>
      </div>
      <div className="mt-7 max-h-[320px] overflow-y-auto pr-2">
        {activityItems.length > 0 ? (
          <div className="flex flex-col gap-4">
            {activityItems.map((item) => (
              <RoundActivityItem key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-skin-stroke bg-[#fff7bf] p-4 text-secondary">
            No activity yet.
          </p>
        )}
      </div>
    </article>
  );
};

type RoundActivityItemType = "milestone" | "submission" | "trait" | "vote";

type RoundActivityItemData = {
  id: string;
  type: RoundActivityItemType;
  timestamp: string;
  title: string;
  description?: string;
  walletAddress?: string;
  voteCount?: number;
};

const RoundActivityItem = ({ item }: { item: RoundActivityItemData }) => (
  <div className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-start gap-3">
    <div
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-heading text-sm ${
        item.type === "vote"
          ? "bg-[#dff3ff] text-[#0f5f99]"
          : item.type === "submission" || item.type === "trait"
            ? "bg-[#fff7bf] text-skin-base"
            : "bg-[#4bd27c] text-white"
      }`}
    >
      {item.type === "vote"
        ? "+"
        : item.type === "submission"
          ? "S"
          : item.type === "trait"
            ? "T"
            : "✓"}
    </div>
    <div className="min-w-0">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="font-heading text-xl leading-none text-skin-base">
          {item.title}
        </span>
        {item.voteCount ? (
          <span className="font-heading text-xl leading-none text-[#6e95ff]">
            +{item.voteCount}
          </span>
        ) : null}
      </div>
      {item.walletAddress ? (
        <div className="mt-1 text-sm text-secondary">
          by{" "}
          <WalletIdentityLink
            address={item.walletAddress}
            ensName={demoAuthorNames[item.walletAddress.toLowerCase()]}
            className="break-words font-semibold text-skin-base"
          />
        </div>
      ) : null}
      {item.description ? (
        <div className="mt-1 truncate text-sm text-secondary">
          {item.description}
        </div>
      ) : null}
    </div>
    <div className="whitespace-nowrap text-lg text-secondary">
      {formatRelativeTime(item.timestamp)}
    </div>
  </div>
);

const getRoundActivityItems = (
  round: RoundWithSubmissions,
  state: RoundState
): RoundActivityItemData[] => {
  const now = Date.now();
  const hasHappened = (timestamp: string) => {
    const time = new Date(timestamp).getTime();
    return Number.isFinite(time) && time <= now;
  };
  const items: RoundActivityItemData[] = [];

  if (hasHappened(round.submissionsOpenAt)) {
    items.push({
      id: "submissions-open",
      type: "milestone" as const,
      timestamp: round.submissionsOpenAt,
      title: "Submissions opened",
    });
  }

  items.push(
    ...round.submissions.map((submission) => ({
      id: `submission-${submission.id}`,
      type:
        submission.submissionType === "trait"
          ? ("trait" as const)
          : ("submission" as const),
      timestamp: submission.createdAt,
      title:
        submission.submissionType === "trait"
          ? "Trait submitted"
          : "Project submitted",
      description: submission.title,
      walletAddress: submission.walletAddress,
    }))
  );

  if (
    (state === "voting_open" || state === "ended" || state === "archived") &&
    hasHappened(round.votingStartsAt)
  ) {
    items.push({
      id: "voting-started",
      type: "milestone" as const,
      timestamp: round.votingStartsAt,
      title: "Voting began",
    });
  }

  items.push(
    ...round.voteActivity.map((activity) => ({
      id: `vote-${activity.id}`,
      type: "vote" as const,
      timestamp: activity.updatedAt || activity.createdAt,
      title: "Votes placed",
      description: activity.submissionTitle,
      walletAddress: activity.walletAddress,
      voteCount: activity.voteCount,
    }))
  );

  if (hasHappened(round.votingEndsAt)) {
    items.push({
      id: "voting-ended",
      type: "milestone" as const,
      timestamp: round.votingEndsAt,
      title: "Voting ended",
    });
  }

  return items.sort((a, b) => {
    const aTime = new Date(a.timestamp).getTime();
    const bTime = new Date(b.timestamp).getTime();
    return bTime - aTime;
  });
};

const getVotingStrategyLabel = (round: RoundWithSubmissions | null) => {
  if (!round) return "the configured voting rules";

  if (round.votingStrategy === "one_per_wallet") {
    return "1 vote per wallet";
  }

  if (round.votingStrategy === "fixed_per_wallet") {
    return `${round.votesPerWallet} votes per wallet`;
  }

  return "1 vote per Collective Noun held";
};

const getRoundNoundrySubmission = (
  submission: RoundSubmission
): NoundrySubmission | null => {
  if (
    submission.submissionType !== "trait" ||
    submission.source !== "noundry"
  ) {
    return null;
  }

  const payload = submission.sourcePayload as Partial<NoundrySubmission> | null;
  if (
    !payload ||
    !payload.id ||
    !payload.title ||
    !payload.artist ||
    !payload.traitType ||
    !Array.isArray(payload.pixels)
  ) {
    return null;
  }

  return {
    id: payload.id,
    title: payload.title,
    artist: payload.artist,
    traitType: payload.traitType,
    pixels: payload.pixels,
    selectedTraits: payload.selectedTraits || {},
    previewTraits: payload.previewTraits || {},
    status: payload.status || "approved",
    createdAt: payload.createdAt || submission.createdAt,
    updatedAt: payload.updatedAt || submission.updatedAt,
    approvedAt: payload.approvedAt,
    removedAt: payload.removedAt,
  };
};

const formatPlace = (position: number) => {
  if (position === 1) return "1st";
  if (position === 2) return "2nd";
  if (position === 3) return "3rd";
  return `${position}th`;
};

const getPlacePillClass = (position: number) =>
  position === 1
    ? "bg-[#f4b83b] text-[#3d2a00]"
    : position === 2
      ? "bg-[#d7dee2] text-[#384148]"
      : position === 3
        ? "bg-[#d76524] text-[#2b1204]"
        : "bg-[#7ba1ff] text-[#0d244f]";

const getWinnerBadge = (rank: number) => {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return "🎗️";
};

const getWinnerCardStyle = (rank: number) => {
  if (rank === 1) {
    return {
      cardClass:
        "border-[#d99a14] bg-[#6f4a05] shadow-[0px_4.02px_0px_0px_#3f2a03]",
      listClass:
        "border-[#d99a14] bg-[#6f4a05] shadow-[0px_4px_0px_0px_#3f2a03]",
      imageClass: "bg-[#8a5f0a]",
      pillClass: "bg-[#f4b83b] text-[#3d2a00]",
    };
  }

  if (rank === 2) {
    return {
      cardClass:
        "border-[#bfc7cc] bg-[#62676b] shadow-[0px_4.02px_0px_0px_#3a3f42]",
      listClass:
        "border-[#cfd6da] bg-[#62676b] shadow-[0px_4px_0px_0px_#3a3f42]",
      imageClass: "bg-[#d7dee2]",
      pillClass: "bg-[#d7dee2] text-[#384148]",
    };
  }

  if (rank === 3) {
    return {
      cardClass:
        "border-[#d76524] bg-[#6b2e0b] shadow-[0px_4.02px_0px_0px_#3d1905]",
      listClass:
        "border-[#d76524] bg-[#6b2e0b] shadow-[0px_4px_0px_0px_#3d1905]",
      imageClass: "bg-[#d76524]",
      pillClass: "bg-[#d76524] text-[#2b1204]",
    };
  }

  return {
    cardClass:
      "border-[#6e95ff] bg-[#0b2f8e] shadow-[0px_4.02px_0px_0px_#081f5d]",
    listClass: "border-[#7ba1ff] bg-[#0b2f8e] shadow-[0px_4px_0px_0px_#081f5d]",
    imageClass: "bg-[#123ea5]",
    pillClass: "bg-[#7ba1ff] text-[#0d244f]",
  };
};

const demoAuthorNames: Record<string, string> = {
  "0xdcf37d8aa17142f053aaa7dc56025ab00d897a19": "yellowadmin.eth",
  "0x70abdcd7a5a8ff9cdef1cca9ea15a5d315780986": "roundbuilder.eth",
};

const formatSubmissionAuthor = (address: string) =>
  demoAuthorNames[address.toLowerCase()] || shortenAddress(address);

const shortenAddress = (address: string) =>
  address.length > 12
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : address;

const formatRelativeTime = (value: string) => {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "";

  const diffMs = Date.now() - timestamp;
  const absoluteMs = Math.abs(diffMs);
  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;
  const monthMs = 30 * dayMs;

  if (absoluteMs < hourMs) {
    return `${Math.max(1, Math.round(absoluteMs / minuteMs))}m`;
  }

  if (absoluteMs < dayMs) {
    return `${Math.round(absoluteMs / hourMs)}h`;
  }

  if (absoluteMs < monthMs) {
    return `${Math.round(absoluteMs / dayMs)}d`;
  }

  return `${Math.round(absoluteMs / monthMs)}mo`;
};
