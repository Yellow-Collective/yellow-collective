import Layout from "@/components/Layout";
import { RoundCard } from "@/components/rounds/RoundCard";
import type { Round } from "data/rounds";
import { listPublicRounds } from "data/rounds";
import { getRoundState } from "@/utils/rounds/state";
import type {
  GetServerSidePropsResult,
  InferGetServerSidePropsType,
} from "next";
import Head from "next/head";
import Link from "next/link";

type RoundsPageProps = {
  rounds: Round[];
  error?: string;
};

export const getServerSideProps = async (): Promise<
  GetServerSidePropsResult<RoundsPageProps>
> => {
  try {
    return { props: { rounds: await listPublicRounds() } };
  } catch (error) {
    console.error("Unable to load rounds page", error);
    return {
      props: {
        rounds: [],
        error: "Rounds are not available right now.",
      },
    };
  }
};

export default function RoundsPage({
  rounds,
  error,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const openRounds = rounds.filter(
    (round) => getRoundState(round) === "submissions_open"
  );
  const votingRounds = rounds.filter(
    (round) => getRoundState(round) === "voting_open"
  );
  const upcomingRounds = rounds
    .filter((round) => getRoundState(round) === "upcoming")
    .sort(compareRoundsBySubmissionsOpenAt);
  const completedRounds = rounds.filter(
    (round) => getRoundState(round) === "ended"
  );

  return (
    <Layout>
      <Head>
        <title>Rounds | Yellow Collective</title>
      </Head>

      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-7 pb-12">
        <>
            <section className="yc-dark-yellow-form-surface rounded-2xl border border-skin-stroke bg-white p-6 shadow-sm md:p-8">
              <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                <div>
                  <h1 className="font-heading text-[42px] leading-none text-skin-base md:text-[58px]">
                    Rounds
                  </h1>
                  <p className="mt-4 max-w-3xl text-lg leading-snug text-secondary">
                    Community contests for the Yellow Collective to vote on.
                  </p>
                </div>
                <Link
                  href="/rounds/request"
                  className="yc-dark-submit-blue flex w-fit shrink-0 items-center justify-center rounded-[18px] bg-[#1d9bf0] px-5 py-3 font-heading text-lg text-white shadow-[0px_4.02px_0px_0px_#0f5f99] transition hover:-translate-y-0.5 hover:bg-[#45adf5] hover:shadow-[0px_6px_0px_0px_#0f5f99] active:translate-y-1 active:shadow-none"
                >
                  Request a round
                </Link>
              </div>
            </section>

            {error && (
              <section className="yc-dark-yellow-form-surface rounded-2xl border border-skin-proposal-danger bg-white p-5 text-skin-proposal-danger shadow-sm">
                {error}
              </section>
            )}

            <RoundSection title="Open" rounds={openRounds} />
            <RoundSection title="Voting" rounds={votingRounds} />
            <RoundSection title="Upcoming" rounds={upcomingRounds} />
            <RoundSection title="Completed" rounds={completedRounds} />
        </>
      </div>
    </Layout>
  );
}

const RoundSection = ({
  title,
  rounds,
}: {
  title: string;
  rounds: Round[];
}) => (
  <section className="flex flex-col gap-4">
    <div className="flex items-center gap-3">
      <h2 className="font-heading text-[32px] leading-none text-skin-base">
        {title}
      </h2>
      <span
        className={`rounded-full px-3 py-1 font-heading text-sm ${getRoundCountClassName(
          title
        )}`}
      >
        {rounds.length}
      </span>
    </div>
    {rounds.length > 0 ? (
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {rounds.map((round) => (
          <RoundCard key={round.id} round={round} />
        ))}
      </div>
    ) : (
      <div className="yc-dark-yellow-form-surface rounded-2xl bg-white p-6 text-base text-secondary shadow-sm">
        No {title.toLowerCase()} rounds yet.
      </div>
    )}
  </section>
);

const getRoundCountClassName = (title: string) => {
  if (title === "Open") {
    return "border border-[#15803d] bg-[#16a34a] text-white shadow-[0px_3px_0px_0px_#15803d]";
  }

  if (title === "Voting") {
    return "border border-[#0f5f99] bg-[#1d9bf0] text-white shadow-[0px_3px_0px_0px_#0f5f99]";
  }

  if (title === "Upcoming") {
    return "border border-[#b89400] bg-accent text-[#212529] shadow-[0px_3px_0px_0px_#b89400]";
  }

  return "border border-[#7f2219] bg-[#c93d2f] text-white shadow-[0px_3px_0px_0px_#7f2219]";
};

const compareRoundsBySubmissionsOpenAt = (left: Round, right: Round) =>
  new Date(left.submissionsOpenAt).getTime() -
  new Date(right.submissionsOpenAt).getTime();
