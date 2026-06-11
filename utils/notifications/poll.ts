import { TOKEN_CONTRACT } from "constants/addresses";
import { getCurrentAuction } from "data/nouns-builder/auction";
import { getProposals, type Proposal } from "data/nouns-builder/governor";
import { getAddresses } from "data/nouns-builder/manager";
import {
  finalizeRoundWinners,
  listPublicRounds,
  type Round,
} from "data/rounds";
import {
  getAuctionNotificationCursor,
  getLastNotificationPollAt,
  getNotificationSettings,
  setAuctionNotificationCursor,
  setLastNotificationPollAt,
  type NotificationAuctionCursor,
} from "data/notifications";
import { sendConfiguredNotification } from "@/utils/notifications/service";
import type {
  NotificationAlertKey,
  NotificationSettings,
} from "@/utils/notifications/settings";
import { getProposalName } from "@/utils/getProposalName";
import { BigNumber } from "@/utils/ethers-compat";

export type NotificationPollResult = {
  status: "sent" | "skipped";
  attempted: number;
  sent: number;
  disabled: number;
  duplicate: number;
  errors: string[];
  nextRunAt?: string;
};

const RECENT_WINDOW_SECONDS = 10 * 60;
const REMINDER_WINDOW_SECONDS = 10 * 60;
const POLL_CADENCE_GRACE_SECONDS = 5 * 60;
const POLL_WINDOW_LOOKBACK_SECONDS = 10 * 60;

const emptyResult = (): NotificationPollResult => ({
  status: "sent",
  attempted: 0,
  sent: 0,
  disabled: 0,
  duplicate: 0,
  errors: [],
});

const secondsFromNow = (timestampSeconds: number, nowSeconds: number) =>
  timestampSeconds - nowSeconds;

const happenedRecently = (timestampSeconds: number, nowSeconds: number) => {
  const diff = secondsFromNow(timestampSeconds, nowSeconds);
  return diff <= 0 && Math.abs(diff) <= RECENT_WINDOW_SECONDS;
};

const getPollWindowStartSeconds = (
  lastPolledAt: Date | null | undefined,
  nowSeconds: number
) =>
  lastPolledAt
    ? Math.floor(lastPolledAt.getTime() / 1000) - POLL_WINDOW_LOOKBACK_SECONDS
    : nowSeconds - RECENT_WINDOW_SECONDS;

const happenedDuringPollWindow = (
  timestampSeconds: number,
  windowStartSeconds: number,
  nowSeconds: number
) => timestampSeconds > windowStartSeconds && timestampSeconds <= nowSeconds;

const upcomingWithin = (
  timestampSeconds: number,
  targetSeconds: number,
  nowSeconds: number
) => {
  const diff = secondsFromNow(timestampSeconds, nowSeconds);
  return diff > 0 && Math.abs(diff - targetSeconds) <= REMINDER_WINDOW_SECONDS;
};

const reminderReachedDuringPollWindow = (
  timestampSeconds: number,
  targetSeconds: number,
  windowStartSeconds: number,
  nowSeconds: number
) => {
  const reminderAtSeconds = timestampSeconds - targetSeconds;
  return (
    timestampSeconds > nowSeconds &&
    reminderAtSeconds > windowStartSeconds &&
    reminderAtSeconds <= nowSeconds
  );
};

const isEffectiveDryRun = (
  dryRun: boolean | undefined,
  settings: NotificationSettings
) =>
  dryRun ?? settings.dryRun ?? process.env.NOTIFICATIONS_DRY_RUN === "true";

const roundTimestamp = (value: string) =>
  Math.floor(new Date(value).getTime() / 1000);

const record = async (
  result: NotificationPollResult,
  input: Parameters<typeof sendConfiguredNotification>[0]
) => {
  result.attempted += 1;

  try {
    const response = await sendConfiguredNotification(input);
    result[response.status] += 1;
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : String(error));
  }
};

export const shouldRunNotificationPoll = ({
  settings,
  lastPolledAt,
  now = new Date(),
  force = false,
}: {
  settings: NotificationSettings;
  lastPolledAt: Date | null;
  now?: Date;
  force?: boolean;
}) => {
  if (force || !lastPolledAt) {
    return { shouldRun: true, nextRunAt: now.toISOString() };
  }

  const intervalMs = settings.pollIntervalHours * 60 * 60 * 1000;
  const nextRunAt = new Date(lastPolledAt.getTime() + intervalMs);
  const graceMs = POLL_CADENCE_GRACE_SECONDS * 1000;

  return {
    shouldRun: now.getTime() + graceMs >= nextRunAt.getTime(),
    nextRunAt: nextRunAt.toISOString(),
  };
};

const notifyRound = async ({
  result,
  settings,
  round,
  eventType,
  sourceSuffix,
  dryRun,
}: {
  result: NotificationPollResult;
  settings: NotificationSettings;
  round: Round;
  eventType: NotificationAlertKey;
  sourceSuffix: string;
  dryRun?: boolean;
}) =>
  record(result, {
    eventType,
    sourceId: `${round.id}:${sourceSuffix}`,
    targetPath: `/rounds/${round.slug}`,
    variables: {
      roundTitle: round.title,
      roundSlug: round.slug,
    },
    settings,
    dryRun,
  });

export const pollRoundNotifications = async ({
  settings,
  now = new Date(),
  dryRun,
}: {
  settings: NotificationSettings;
  now?: Date;
  dryRun?: boolean;
}) => {
  const result = emptyResult();
  const nowSeconds = Math.floor(now.getTime() / 1000);
  const rounds = (await listPublicRounds()).filter(
    (round) => !round.slug.startsWith("demo-")
  );

  for (const round of rounds) {
    const startsAt = roundTimestamp(round.startsAt);
    const submissionsOpenAt = roundTimestamp(round.submissionsOpenAt);
    const votingStartsAt = roundTimestamp(round.votingStartsAt);
    const votingEndsAt = roundTimestamp(round.votingEndsAt);

    if (happenedRecently(startsAt, nowSeconds)) {
      await notifyRound({
        result,
        settings,
        round,
        eventType: "round_published",
        sourceSuffix: "published",
        dryRun,
      });
    }
    if (happenedRecently(submissionsOpenAt, nowSeconds)) {
      await notifyRound({
        result,
        settings,
        round,
        eventType: "round_submissions_open",
        sourceSuffix: "submissions-open",
        dryRun,
      });
    }
    if (happenedRecently(votingStartsAt, nowSeconds)) {
      await notifyRound({
        result,
        settings,
        round,
        eventType: "round_voting_open",
        sourceSuffix: "voting-open",
        dryRun,
      });
    }
    if (upcomingWithin(votingEndsAt, 24 * 60 * 60, nowSeconds)) {
      await notifyRound({
        result,
        settings,
        round,
        eventType: "round_voting_ending_24h",
        sourceSuffix: "voting-ending-24h",
        dryRun,
      });
    }
    if (happenedRecently(votingEndsAt, nowSeconds)) {
      await finalizeRoundWinners(round);
      await notifyRound({
        result,
        settings,
        round,
        eventType: "round_results_finalized",
        sourceSuffix: "results-finalized",
        dryRun,
      });
    }
  }

  return result;
};

export const pollAuctionNotifications = async ({
  settings,
  now = new Date(),
  dryRun,
  lastPolledAt,
  lastAuctionCursor,
}: {
  settings: NotificationSettings;
  now?: Date;
  dryRun?: boolean;
  lastPolledAt?: Date | null;
  lastAuctionCursor?: NotificationAuctionCursor | null;
}) => {
  const result = emptyResult();
  const nowSeconds = Math.floor(now.getTime() / 1000);
  const windowStartSeconds = getPollWindowStartSeconds(
    lastPolledAt,
    nowSeconds
  );
  const addresses = await getAddresses({
    tokenAddress: TOKEN_CONTRACT as `0x${string}`,
  });
  const auction = await getCurrentAuction({ address: addresses.auction });
  const auctionCursor =
    lastAuctionCursor === undefined
      ? await getAuctionNotificationCursor()
      : lastAuctionCursor;
  const tokenId = BigNumber.from(auction.tokenId).toString();
  const targetPath = `/?tokenid=${tokenId}`;

  if (
    happenedDuringPollWindow(auction.startTime, windowStartSeconds, nowSeconds)
  ) {
    await record(result, {
      eventType: "auction_started",
      sourceId: `${tokenId}:started`,
      targetPath,
      variables: { tokenId },
      settings,
      dryRun,
    });
  }
  if (
    reminderReachedDuringPollWindow(
      auction.endTime,
      60 * 60,
      windowStartSeconds,
      nowSeconds
    )
  ) {
    await record(result, {
      eventType: "auction_ending_soon_1h",
      sourceId: `${tokenId}:ending-1h`,
      targetPath,
      variables: { tokenId },
      settings,
      dryRun,
    });
  }
  if (
    happenedDuringPollWindow(auction.endTime, windowStartSeconds, nowSeconds)
  ) {
    await record(result, {
      eventType: "auction_ended",
      sourceId: `${tokenId}:ended`,
      targetPath,
      variables: { tokenId },
      settings,
      dryRun,
    });
  }
  if (auctionCursor?.tokenId && auctionCursor.tokenId !== tokenId) {
    await record(result, {
      eventType: "auction_settled",
      sourceId: `${auctionCursor.tokenId}:settled`,
      targetPath: `/?tokenid=${auctionCursor.tokenId}`,
      variables: { tokenId: auctionCursor.tokenId },
      settings,
      dryRun,
    });
  } else if (
    auction.settled &&
    happenedDuringPollWindow(auction.endTime, windowStartSeconds, nowSeconds)
  ) {
    await record(result, {
      eventType: "auction_settled",
      sourceId: `${tokenId}:settled`,
      targetPath,
      variables: { tokenId },
      settings,
      dryRun,
    });
  }

  if (!isEffectiveDryRun(dryRun, settings) && result.errors.length === 0) {
    await setAuctionNotificationCursor({
      tokenId,
      startTime: auction.startTime,
      endTime: auction.endTime,
      settled: auction.settled,
    });
  }

  return result;
};

const proposalTimestamp = (value: number) => Number(value || 0);
const proposalTitle = (proposal: Proposal) =>
  getProposalName(proposal.description) || "Yellow proposal";

export const pollYellowProposalNotifications = async ({
  settings,
  now = new Date(),
  dryRun,
}: {
  settings: NotificationSettings;
  now?: Date;
  dryRun?: boolean;
}) => {
  const result = emptyResult();
  const nowSeconds = Math.floor(now.getTime() / 1000);
  const addresses = await getAddresses({
    tokenAddress: TOKEN_CONTRACT as `0x${string}`,
  });
  const proposals = await getProposals({ address: addresses.governor });

  for (const proposal of proposals) {
    const title = proposalTitle(proposal);
    const variables = {
      proposalTitle: title,
      proposalId: proposal.proposalId,
    };
    const targetPath = `/proposals/${proposal.proposalId}`;

    if (
      happenedRecently(
        proposalTimestamp(proposal.proposal.timeCreated),
        nowSeconds
      )
    ) {
      await record(result, {
        eventType: "yellow_proposal_created",
        sourceId: `${proposal.proposalId}:created`,
        targetPath,
        variables,
        settings,
        dryRun,
      });
    }
    if (
      happenedRecently(
        proposalTimestamp(proposal.proposal.voteStart),
        nowSeconds
      )
    ) {
      await record(result, {
        eventType: "yellow_proposal_active",
        sourceId: `${proposal.proposalId}:active`,
        targetPath,
        variables,
        settings,
        dryRun,
      });
    }
    if (
      upcomingWithin(
        proposalTimestamp(proposal.proposal.voteEnd),
        24 * 60 * 60,
        nowSeconds
      )
    ) {
      await record(result, {
        eventType: "yellow_proposal_ending_24h",
        sourceId: `${proposal.proposalId}:ending-24h`,
        targetPath,
        variables,
        settings,
        dryRun,
      });
    }
    if (
      proposal.state !== 0 &&
      proposal.state !== 1 &&
      happenedRecently(proposalTimestamp(proposal.proposal.voteEnd), nowSeconds)
    ) {
      await record(result, {
        eventType: "yellow_proposal_final",
        sourceId: `${proposal.proposalId}:final`,
        targetPath,
        variables,
        settings,
        dryRun,
      });
    }
  }

  return result;
};

export const pollWebNotifications = async ({
  dryRun,
  force,
  now = new Date(),
}: {
  dryRun?: boolean;
  force?: boolean;
  now?: Date;
} = {}) => {
  const settings = await getNotificationSettings();
  const effectiveDryRun = isEffectiveDryRun(dryRun, settings);
  const lastPolledAt = await getLastNotificationPollAt();
  const lastAuctionCursor = await getAuctionNotificationCursor();
  const cadence = shouldRunNotificationPoll({
    settings,
    lastPolledAt,
    force,
    now,
  });

  if (!cadence.shouldRun) {
    return {
      ...emptyResult(),
      status: "skipped" as const,
      nextRunAt: cadence.nextRunAt,
    };
  }

  const results = await Promise.all([
    pollRoundNotifications({ settings, dryRun: effectiveDryRun, now }),
    pollAuctionNotifications({
      settings,
      dryRun: effectiveDryRun,
      now,
      lastPolledAt,
      lastAuctionCursor,
    }),
    pollYellowProposalNotifications({ settings, dryRun: effectiveDryRun, now }),
  ]);

  const result = results.reduce(
    (acc, item) => ({
      status: "sent" as const,
      attempted: acc.attempted + item.attempted,
      sent: acc.sent + item.sent,
      disabled: acc.disabled + item.disabled,
      duplicate: acc.duplicate + item.duplicate,
      errors: [...acc.errors, ...item.errors],
    }),
    emptyResult()
  );

  if (!effectiveDryRun && result.errors.length === 0) {
    await setLastNotificationPollAt(now);
  }

  return result;
};
