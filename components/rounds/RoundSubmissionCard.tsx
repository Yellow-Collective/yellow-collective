import type { RoundSubmission } from "data/rounds";
import type { PlaygroundArtwork } from "data/nouns-builder/artwork";
import type { ReactNode } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import useSWR from "swr";
import WalletIdentityLink from "@/components/WalletIdentityLink";
import { useIsMounted } from "@/hooks/useIsMounted";
import {
  NounPreviewTile,
  getSubmissionPreviewTraits,
  type NoundrySubmission,
} from "@/components/noundry/NoundryPreview";
import { isRoundTraitAutoDescription } from "@/utils/noundry/round-trait-submission";

type ProfileIdentityResponse = { profile?: { username?: string } | null };
const fetcher = async (url: string) => {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Unable to load data.");
  return data;
};

export const DeferredInlineImage = ({
  src,
  alt,
  className,
  fallback,
}: {
  src: string;
  alt: string;
  className: string;
  fallback: ReactNode;
}) => {
  const isMounted = useIsMounted();

  if (!src || (src.startsWith("data:image/") && !isMounted)) {
    return <>{fallback}</>;
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} />;
};

export const SubmissionCard = ({
  submission,
  editHref,
  ownerAction,
  rank,
  isWinner,
  isRoundEnded,
  isVotingOpen,
  isOwnSubmission,
  canVote,
  allocation,
  lockedVotes,
  remainingVotes,
  maxVotesPerEntry,
  onChange,
  onOpen,
  artwork,
  showRank,
  showVoteCount,
}: {
  submission: RoundSubmission;
  editHref?: string;
  ownerAction?: ReactNode;
  rank: number;
  isWinner: boolean;
  isRoundEnded: boolean;
  isVotingOpen: boolean;
  isOwnSubmission: boolean;
  canVote: boolean;
  allocation: number;
  lockedVotes: number;
  remainingVotes: number;
  maxVotesPerEntry: number | null;
  onChange: (value: number) => void;
  onOpen: () => void;
  artwork?: PlaygroundArtwork;
  showRank: boolean;
  showVoteCount: boolean;
}) => {
  const winnerStyle = isWinner ? getWinnerCardStyle(rank) : null;
  const noundrySubmission = getRoundNoundrySubmission(submission);
  const maxAllocation =
    maxVotesPerEntry === null
      ? allocation + remainingVotes
      : Math.min(
          allocation + remainingVotes,
          Math.max(maxVotesPerEntry - lockedVotes, 0)
        );
  const hasReachedEntryVoteLimit =
    maxVotesPerEntry !== null && lockedVotes >= maxVotesPerEntry;
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
            />
          </div>
        ) : (
          <div className="relative">
            <DeferredInlineImage
              src={submission.image}
              alt={submission.title}
              className={`aspect-square w-full object-cover ${imageClass}`}
              fallback={
                <div
                  className={`flex aspect-square w-full items-center justify-center p-6 text-center font-heading text-2xl ${imageClass}`}
                >
                  {submission.title}
                </div>
              }
            />
            {submission.video && (
              <span className="absolute left-3 top-3 rounded-full bg-black/75 px-3 py-1 text-xs text-white">
                Video
              </span>
            )}
            {submission.images.length > 1 && (
              <span className="absolute bottom-3 right-3 rounded-full bg-black/75 px-3 py-1 font-heading text-sm text-white">
                {submission.images.length} images
              </span>
            )}
          </div>
        )}
      </button>
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            {submission.submissionType === "trait" && (
              <div
                className={`yc-round-trait-tag mb-2 w-fit rounded-full px-2 py-0.5 font-heading text-xs ${
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
            <div className="whitespace-nowrap rounded-full bg-[#1d9bf0] px-3 py-1 font-heading text-sm text-white shadow-[0px_3px_0px_0px_#0f5f99]">
              {submission.voteCount} votes
            </div>
          )}
        </div>
        <SubmissionDescription
          submission={submission}
          className={secondaryTextClass}
          compact
        />
        <div className="mt-auto flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <WalletIdentityLink
              address={submission.walletAddress}
              className={`font-heading text-base underline ${primaryTextClass}`}
            />
            {lockedVotes > 0 && (
              <div className="yc-round-locked-vote-pill rounded-full bg-white/95 px-3 py-1 font-heading text-sm !text-[#212529] shadow-[0px_3px_0px_0px_rgba(0,0,0,0.28)]">
                {lockedVotes} locked
              </div>
            )}
          </div>
          {ownerAction}
          {editHref && (
            <Link
              href={editHref}
              className="w-fit rounded-xl border border-skin-stroke bg-[#fff7bf] px-4 py-2 font-heading text-base text-[#212529] shadow-[0px_4.02px_0px_0px_rgb(var(--color-shadow-accent))] transition hover:bg-[#ffd84d] motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-1 active:!shadow-none"
            >
              Edit
            </Link>
          )}
          {isVotingOpen && isOwnSubmission && (
            <p
              role="status"
              className="yc-round-self-vote-notice rounded-xl border border-amber-200 bg-amber-100 px-3 py-2 text-sm font-semibold text-[#212529] !text-[#212529]"
            >
              You cannot vote for your own entry.
            </p>
          )}
          {isVotingOpen && !isOwnSubmission && hasReachedEntryVoteLimit && (
            <p
              role="status"
              className="rounded-xl border border-white/20 bg-black/20 px-3 py-2 text-sm font-semibold text-white"
            >
              Maximum {maxVotesPerEntry} votes used for this entry.
            </p>
          )}
          {!isOwnSubmission && canVote && !hasReachedEntryVoteLimit && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/20 bg-black/20 p-2">
              <span className="font-heading text-sm text-white">New votes</span>
              <div className="yc-round-vote-controls flex items-center gap-2 rounded-xl border border-skin-stroke bg-[#f1f1f1] p-1">
                <button
                  type="button"
                  onClick={() => onChange(allocation - 1)}
                  disabled={allocation <= 0}
                  className="yc-round-vote-remove h-9 w-9 rounded-lg font-heading text-xl disabled:opacity-40"
                  aria-label={`Remove draft vote from ${submission.title}`}
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
                  aria-label={`New votes for ${submission.title}`}
                  className="h-9 w-16 rounded-lg border border-skin-stroke bg-white text-center font-heading text-lg text-skin-base focus:outline-none focus:ring-2 focus:ring-skin-highlighted"
                />
                <button
                  type="button"
                  onClick={() => onChange(allocation + 1)}
                  disabled={allocation >= maxAllocation}
                  className="yc-round-vote-add h-9 w-9 rounded-lg font-heading text-xl disabled:opacity-40"
                  aria-label={`Add draft vote to ${submission.title}`}
                >
                  +
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  );
};

export const SubmissionDescription = ({
  submission,
  className = "",
  compact = false,
}: {
  submission: RoundSubmission;
  className?: string;
  compact?: boolean;
}) => {
  const isAutoTraitDescription = isRoundTraitAutoDescription(submission);
  const storedIdentityLabel =
    typeof submission.sourcePayload?.roundSubmissionIdentityLabel === "string"
      ? submission.sourcePayload.roundSubmissionIdentityLabel
      : undefined;
  const { data: submitterProfile } = useSWR<ProfileIdentityResponse>(
    isAutoTraitDescription ? `/api/profile/${submission.walletAddress}` : null,
    fetcher
  );

  if (isAutoTraitDescription) {
    return (
      <p className={`break-words text-base leading-snug ${className}`}>
        Noundry {submission.traitType} trait submitted by{" "}
        <WalletIdentityLink
          address={submission.walletAddress}
          profileName={
            submitterProfile?.profile?.username || storedIdentityLabel
          }
          fallback="full"
          className="font-semibold underline"
        />
        .
      </p>
    );
  }

  const { description } = submission;
  const blocks = description
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  const visibleBlocks = compact
    ? blocks.filter((block) => !block.startsWith("#")).slice(0, 1)
    : blocks;

  return (
    <ReactMarkdown
      className={`prose prose-skin max-w-none break-words text-base leading-snug prose-headings:font-heading prose-headings:leading-none prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-p:my-0 prose-ul:my-0 prose-ol:my-0 ${className}`}
      remarkPlugins={[remarkGfm]}
    >
      {visibleBlocks.join("\n\n")}
    </ReactMarkdown>
  );
};

export const WinnerGlimmer = ({
  withBorder = true,
}: {
  withBorder?: boolean;
}) => (
  <>
    {withBorder && (
      <div className="pointer-events-none absolute inset-0 z-10 rounded-2xl border-2 border-white/35" />
    )}
    <div className="pointer-events-none absolute inset-0 z-10 rounded-2xl bg-[linear-gradient(120deg,transparent_0%,rgba(255,255,255,0.28)_22%,transparent_44%)] opacity-70" />
  </>
);

export const WinnerBadge = ({ rank }: { rank: number }) => {
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

export const getRoundNoundrySubmission = (
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

const getWinnerBadge = (rank: number) => {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return "🎗️";
};

export const getWinnerCardStyle = (rank: number) => {
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
