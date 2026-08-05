import type { Round } from "data/rounds";
import { getRoundState } from "./state";

export type HomepageActiveRound = Pick<Round, "slug" | "title" | "image"> & {
  state: "submissions_open" | "voting_open";
  deadline: string;
};

export type HomepageUpcomingRound = Pick<Round, "slug" | "title" | "image"> & {
  state: "upcoming";
  deadline: string;
};

export const selectHomepageActiveRounds = (
  rounds: Round[],
  roundsPublicEnabled: boolean,
  now = new Date()
): HomepageActiveRound[] => {
  if (!roundsPublicEnabled) return [];

  const activeRounds: HomepageActiveRound[] = [];

  for (const round of rounds) {
    const state = getRoundState(round, now);
    if (state !== "submissions_open" && state !== "voting_open") continue;

    activeRounds.push({
      slug: round.slug,
      title: round.title,
      image: round.image,
      state,
      deadline:
        state === "submissions_open"
          ? round.votingStartsAt
          : round.votingEndsAt,
    });

    if (activeRounds.length === 3) break;
  }

  return activeRounds;
};

export const selectHomepageUpcomingRounds = (
  rounds: Round[],
  roundsPublicEnabled: boolean,
  now = new Date()
): HomepageUpcomingRound[] => {
  if (!roundsPublicEnabled) return [];

  return rounds
    .filter((round) => getRoundState(round, now) === "upcoming")
    .sort(
      (left, right) =>
        new Date(left.submissionsOpenAt).getTime() -
        new Date(right.submissionsOpenAt).getTime()
    )
    .slice(0, 2)
    .map((round) => ({
      slug: round.slug,
      title: round.title,
      image: round.image,
      state: "upcoming",
      deadline: round.submissionsOpenAt,
    }));
};
