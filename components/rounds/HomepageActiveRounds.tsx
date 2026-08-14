import { RoundStatusPill } from "@/components/rounds/RoundCard";
import type {
  HomepageActiveRound,
  HomepageUpcomingRound,
} from "@/utils/rounds/homepage";
import Link from "next/link";

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));

type HomepageRound = HomepageActiveRound | HomepageUpcomingRound;

const HomepageRoundCard = ({ round }: { round: HomepageRound }) => {
  const isSubmissionsOpen = round.state === "submissions_open";
  const isUpcoming = round.state === "upcoming";
  const statusLabel = isSubmissionsOpen
    ? "Submissions open"
    : isUpcoming
      ? "Upcoming"
      : "Voting open";
  const dateLabel = isSubmissionsOpen
    ? "Voting starts"
    : isUpcoming
      ? "Submissions open"
      : "Voting ends";
  return (
    <Link
      href={`/rounds/${round.slug}`}
      className="yc-dark-yellow-surface group flex min-w-0 overflow-hidden rounded-2xl border border-skin-stroke bg-white shadow-[0px_4.02px_0px_0px_rgb(var(--color-shadow-neutral))] transition hover:-translate-y-0.5 hover:shadow-[0px_6px_0px_0px_rgb(var(--color-shadow-neutral))] active:translate-y-1 active:shadow-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1d9bf0] focus-visible:ring-offset-4 focus-visible:ring-offset-transparent motion-reduce:transform-none motion-reduce:transition-none"
    >
      <div className="h-auto w-28 shrink-0 overflow-hidden bg-[#fff7bf] sm:w-32">
        {round.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={round.image}
            alt={`${round.title} round`}
            className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.03] motion-reduce:transform-none motion-reduce:transition-none"
          />
        ) : (
          <div className="flex h-full min-h-40 items-center justify-center px-3 text-center font-heading text-xl leading-none text-skin-base">
            {round.title}
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col items-start gap-3 p-4">
        <RoundStatusPill status={statusLabel} state={round.state} />
        <h3 className="break-words font-heading text-2xl leading-none text-skin-base">
          {round.title}
        </h3>
        <p className="text-sm font-semibold text-secondary">
          {dateLabel} {formatDate(round.deadline)}
        </p>
      </div>
    </Link>
  );
};

export const HomepageActiveRounds = ({
  rounds,
  upcomingRounds,
}: {
  rounds: HomepageActiveRound[];
  upcomingRounds: HomepageUpcomingRound[];
}) => {
  if (rounds.length === 0 && upcomingRounds.length === 0) return null;

  return (
    <div className="w-full">
      {rounds.length > 0 && (
        <section
          aria-labelledby="active-rounds-heading"
          className="mx-auto w-full max-w-[1180px] px-4 pb-12 md:px-8 md:pb-16"
        >
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2
                id="active-rounds-heading"
                className="font-heading text-[36px] leading-none text-skin-base md:text-[44px]"
              >
                Active rounds
              </h2>
              <p className="mt-2 max-w-2xl text-base leading-snug text-secondary md:text-lg">
                Submit your work or help choose what the Collective supports next.
              </p>
            </div>
            <Link
              href="/rounds"
              className="w-fit rounded-lg font-heading text-lg text-skin-base underline decoration-2 underline-offset-4 transition hover:text-accent-blue focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1d9bf0] focus-visible:ring-offset-4 focus-visible:ring-offset-transparent"
            >
              View all rounds
            </Link>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {rounds.map((round) => (
              <HomepageRoundCard key={round.slug} round={round} />
            ))}
          </div>
        </section>
      )}

      {upcomingRounds.length > 0 && (
        <section
          aria-labelledby="upcoming-rounds-heading"
          className="mx-auto w-full max-w-[1180px] px-4 pb-12 md:px-8 md:pb-16"
        >
          <div className="mb-5">
            <h2
              id="upcoming-rounds-heading"
              className="font-heading text-[36px] leading-none text-skin-base md:text-[44px]"
            >
              Next up
            </h2>
            <p className="mt-2 max-w-2xl text-base leading-snug text-secondary md:text-lg">
              A preview of the next rounds opening for submissions.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {upcomingRounds.map((round) => (
              <HomepageRoundCard key={round.slug} round={round} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
