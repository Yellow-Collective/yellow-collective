import type { PublicRoundSummary } from "@/utils/rounds/roundMediaPayload";
import {
  getRoundState,
  getRoundStateLabel,
  type RoundState,
} from "@/utils/rounds/state";
import Link from "next/link";

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));

const getStatusDotColor = (state: RoundState | "featured" | null) => {
  if (state === "submissions_open") return "bg-[#16a34a]";
  if (state === "upcoming" || state === "voting_open") return "bg-[#1d9bf0]";
  if (state === "ended" || state === "archived") return "bg-[#c93d2f]";
  return "bg-[#d7aa00]";
};

const inferRoundStatusState = (
  status: string
): RoundState | "featured" | null => {
  const normalized = status.toLowerCase().replace(/\s+/g, "_");

  if (normalized.includes("featured")) return "featured";
  if (normalized.includes("submissions_open")) return "submissions_open";
  if (normalized.includes("voting_open")) return "voting_open";
  if (normalized.includes("upcoming")) return "upcoming";
  if (normalized.includes("ended") || normalized.includes("completed")) {
    return "ended";
  }
  if (normalized.includes("archived")) return "archived";

  return null;
};

export const RoundStatusPill = ({
  status,
  state,
}: {
  status: string;
  state?: RoundState | "featured";
}) => {
  const resolvedState = state ?? inferRoundStatusState(status);
  const isFeatured = resolvedState === "featured";
  const color = isFeatured
    ? "bg-[#c93d2f] text-white"
    : resolvedState === "submissions_open"
      ? "bg-[#e7f7df] text-[#276514]"
      : resolvedState === "voting_open" || resolvedState === "upcoming"
        ? "bg-[#dff3ff] text-[#0f5f99]"
        : resolvedState === "ended" ||
            resolvedState === "archived" ||
            status === "rejected" ||
            status === "hidden"
          ? "bg-[#f8d7d7] text-[#8c1d1d]"
          : "bg-[#fff7bf] text-[#6d5600]";

  return (
    <span
      className={`inline-flex h-7 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3 py-0 text-xs font-semibold leading-none ${color}`}
    >
      {!isFeatured && (
        <span
          aria-hidden="true"
          className={`h-2.5 w-2.5 rounded-full ${getStatusDotColor(
            resolvedState
          )}`}
        />
      )}
      {status.replace(/_/g, " ")}
      {isFeatured && (
        <span aria-hidden="true" className="yc-round-featured-star">
          ★
        </span>
      )}
    </span>
  );
};

export const RoundCard = ({ round }: { round: PublicRoundSummary }) => {
  const state = getRoundState(round);
  const isOpen = state === "submissions_open";
  const isVoting = state === "voting_open";
  const isUpcoming = state === "upcoming";
  const isCompleted = state === "ended";
  const statusLabel = isUpcoming
    ? `Submissions open ${formatDate(round.submissionsOpenAt)}`
    : getRoundStateLabel(state);
  const dateDetail = isOpen
    ? {
        label: "Voting starts",
        value: formatDate(round.votingStartsAt),
      }
    : isVoting
      ? {
          label: "Voting ends",
          value: formatDate(round.votingEndsAt),
        }
      : null;
  const showStats = !isUpcoming;
  const showVotes = isVoting || isCompleted;

  return (
    <Link
      href={`/rounds/${round.slug}`}
      className="yc-dark-yellow-form-surface group flex h-full flex-col overflow-hidden rounded-2xl border border-skin-stroke bg-white shadow-[0px_4.02px_0px_0px_rgb(var(--color-shadow-neutral))] transition hover:-translate-y-0.5 hover:shadow-[0px_6px_0px_0px_rgb(var(--color-shadow-neutral))] active:translate-y-1 active:shadow-none"
    >
      <div className="aspect-[4/3] overflow-hidden bg-[#fff7bf]">
        {round.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={round.image}
            alt={round.title}
            className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center font-heading text-3xl text-skin-base">
            {round.title}
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-4 border-t border-skin-stroke p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="min-w-0 break-words font-heading text-2xl leading-none text-skin-base">
            {round.title}
          </h2>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <RoundStatusPill status={statusLabel} state={state} />
            {dateDetail && (
              <div className="whitespace-nowrap text-xs font-semibold text-secondary">
                {dateDetail.label} {dateDetail.value}
              </div>
            )}
          </div>
        </div>
        <p className="text-base leading-snug text-secondary">
          {round.description || "Round details coming soon."}
        </p>
        {showStats && (
          <div
            className={`mt-auto grid gap-3 text-sm text-secondary ${
              showVotes ? "grid-cols-2" : "grid-cols-1"
            }`}
          >
            <div>
              <div className="font-heading text-base text-skin-base">
                Submissions
              </div>
              {round.approvedSubmissionCount || 0}
            </div>
            {showVotes && (
              <div>
                <div className="font-heading text-base text-skin-base">
                  Votes
                </div>
                {round.totalVotes || 0}
              </div>
            )}
          </div>
        )}
      </div>
    </Link>
  );
};
