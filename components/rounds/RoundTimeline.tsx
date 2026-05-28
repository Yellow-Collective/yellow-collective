import type { Round } from "data/rounds";
import { getRoundState } from "@/utils/rounds/state";
import { CheckIcon } from "@heroicons/react/20/solid";

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("en", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));

export const RoundTimeline = ({ round }: { round: Round }) => {
  const state = getRoundState(round);
  const steps = [
    {
      label: "Round Started",
      date: round.startsAt,
      complete: state !== "draft" && state !== "upcoming",
    },
    {
      label: "Voting Started",
      date: round.votingStartsAt,
      complete:
        state === "voting_open" || state === "ended" || state === "archived",
    },
    {
      label: "Round Ended",
      date: round.votingEndsAt,
      complete: state === "ended" || state === "archived",
    },
  ];

  return (
    <section className="yc-dark-yellow-form-surface rounded-2xl border border-skin-stroke bg-white p-4 text-skin-base shadow-sm md:px-5 md:py-4">
      <div className="relative grid gap-5 md:grid-cols-3 md:gap-0">
        <div className="absolute left-5 right-5 top-[52px] hidden h-1 bg-[#d7d7d7] md:block" />
        <div
          className="absolute left-5 top-[52px] hidden h-1 bg-[#4bd27c] md:block"
          style={{
            width:
              state === "ended" || state === "archived"
                ? "calc(100% - 2.5rem)"
                : state === "voting_open"
                  ? "calc(50% - 1.25rem)"
                  : state === "submissions_open"
                    ? "0"
                    : "0",
          }}
        />
        {steps.map((step, index) => (
          <div
            key={step.label}
            className={`relative z-10 flex flex-col gap-4 ${
              index === 1
                ? "md:items-center md:text-center"
                : index === 2
                  ? "md:items-end md:text-right"
                  : ""
            }`}
          >
            <div className="font-heading text-xl leading-none text-skin-base">
              {step.label}
            </div>
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-full border transition ${
                step.complete
                  ? "border-[#249a4c] bg-[#4bd27c] shadow-[0px_4px_0px_0px_#249a4c]"
                  : "border-[#b8b8b8] bg-[#d7d7d7] shadow-[0px_4px_0px_0px_#a9a9a9]"
              }`}
            >
              <CheckIcon className="h-5 w-5 text-white" />
            </div>
            <div className="text-sm text-secondary">
              {formatDateTime(step.date)}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
