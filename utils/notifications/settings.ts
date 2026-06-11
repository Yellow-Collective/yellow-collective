import { SITE_DOMAIN } from "@/utils/site";

export const NOTIFICATIONS_SETTINGS_KEY = "notifications_settings_v1";
export const NOTIFICATION_TITLE_LIMIT = 32;
export const NOTIFICATION_BODY_LIMIT = 128;
export const NOTIFICATION_POLL_INTERVAL_HOUR_OPTIONS = [1, 2, 4, 12, 24];

export const NOTIFICATION_ALERT_KEYS = [
  "round_published",
  "round_submissions_open",
  "round_voting_open",
  "round_voting_ending_24h",
  "round_results_finalized",
  "auction_started",
  "auction_ending_soon_1h",
  "auction_ended",
  "auction_settled",
  "yellow_proposal_created",
  "yellow_proposal_active",
  "yellow_proposal_ending_24h",
  "yellow_proposal_final",
  "nouns_snapshot_created",
  "nouns_snapshot_closed",
  "nouns_snapshot_cancelled",
  "nouns_vote_executed",
] as const;

export type NotificationAlertKey = (typeof NOTIFICATION_ALERT_KEYS)[number];

export type NotificationAlertSettings = {
  enabled: boolean;
  titleTemplate: string;
  bodyTemplate: string;
};

export type NotificationSettings = {
  enabled: boolean;
  dryRun: boolean;
  pollIntervalHours: number;
  alerts: Record<NotificationAlertKey, NotificationAlertSettings>;
};

export type NotificationTemplateVariables = Record<
  string,
  string | number | null | undefined
>;

export const NOTIFICATION_ALERT_GROUPS: Array<{
  id: string;
  label: string;
  variables: string[];
  alerts: NotificationAlertKey[];
}> = [
  {
    id: "rounds",
    label: "Rounds",
    variables: ["roundTitle", "roundSlug"],
    alerts: [
      "round_published",
      "round_submissions_open",
      "round_voting_open",
      "round_voting_ending_24h",
      "round_results_finalized",
    ],
  },
  {
    id: "auctions",
    label: "Auctions",
    variables: ["tokenId"],
    alerts: [
      "auction_started",
      "auction_ending_soon_1h",
      "auction_ended",
      "auction_settled",
    ],
  },
  {
    id: "yellow_proposals",
    label: "Yellow Proposals",
    variables: ["proposalTitle", "proposalId"],
    alerts: [
      "yellow_proposal_created",
      "yellow_proposal_active",
      "yellow_proposal_ending_24h",
      "yellow_proposal_final",
    ],
  },
  {
    id: "nouns_metagov",
    label: "Nouns Metagov",
    variables: ["proposalTitle", "proposalNumber", "winningChoice"],
    alerts: [
      "nouns_snapshot_created",
      "nouns_snapshot_closed",
      "nouns_snapshot_cancelled",
      "nouns_vote_executed",
    ],
  },
];

const defaultAlerts: Record<NotificationAlertKey, NotificationAlertSettings> = {
  round_published: {
    enabled: true,
    titleTemplate: "Round is live",
    bodyTemplate: "{roundTitle} is now published.",
  },
  round_submissions_open: {
    enabled: true,
    titleTemplate: "Submissions open",
    bodyTemplate: "Submit to {roundTitle}.",
  },
  round_voting_open: {
    enabled: true,
    titleTemplate: "Voting is open",
    bodyTemplate: "Vote in {roundTitle}.",
  },
  round_voting_ending_24h: {
    enabled: true,
    titleTemplate: "Voting ends soon",
    bodyTemplate: "{roundTitle} voting ends in about 24 hours.",
  },
  round_results_finalized: {
    enabled: true,
    titleTemplate: "Round results",
    bodyTemplate: "Results are in for {roundTitle}.",
  },
  auction_started: {
    enabled: true,
    titleTemplate: "New auction",
    bodyTemplate: "Collective Noun #{tokenId} is live.",
  },
  auction_ending_soon_1h: {
    enabled: true,
    titleTemplate: "Auction ending",
    bodyTemplate: "Collective Noun #{tokenId} ends in about 1 hour.",
  },
  auction_ended: {
    enabled: true,
    titleTemplate: "Auction ended",
    bodyTemplate: "Collective Noun #{tokenId} auction ended.",
  },
  auction_settled: {
    enabled: true,
    titleTemplate: "Auction settled",
    bodyTemplate: "Collective Noun #{tokenId} auction settled.",
  },
  yellow_proposal_created: {
    enabled: true,
    titleTemplate: "New proposal",
    bodyTemplate: "{proposalTitle}",
  },
  yellow_proposal_active: {
    enabled: true,
    titleTemplate: "Proposal vote open",
    bodyTemplate: "Vote on {proposalTitle}.",
  },
  yellow_proposal_ending_24h: {
    enabled: true,
    titleTemplate: "Proposal ending",
    bodyTemplate: "{proposalTitle} ends in about 24 hours.",
  },
  yellow_proposal_final: {
    enabled: true,
    titleTemplate: "Proposal final",
    bodyTemplate: "{proposalTitle} has a final result.",
  },
  nouns_snapshot_created: {
    enabled: true,
    titleTemplate: "Nouns vote open",
    bodyTemplate: "Vote on Nouns #{proposalNumber}: {proposalTitle}.",
  },
  nouns_snapshot_closed: {
    enabled: true,
    titleTemplate: "Snapshot closed",
    bodyTemplate: "Yellow voted {winningChoice} on Nouns #{proposalNumber}.",
  },
  nouns_snapshot_cancelled: {
    enabled: true,
    titleTemplate: "Proposal cancelled",
    bodyTemplate: "Nouns #{proposalNumber} was cancelled.",
  },
  nouns_vote_executed: {
    enabled: true,
    titleTemplate: "Vote executed",
    bodyTemplate: "Yellow cast its Nouns #{proposalNumber} vote.",
  },
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: true,
  dryRun: false,
  pollIntervalHours: 1,
  alerts: defaultAlerts,
};

export const isNotificationAlertKey = (
  value: unknown
): value is NotificationAlertKey =>
  typeof value === "string" &&
  (NOTIFICATION_ALERT_KEYS as readonly string[]).includes(value);

const normalizeTemplate = (value: unknown, fallback: string) => {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
};

const normalizePollIntervalHours = (value: unknown) => {
  const interval = Number(value);
  return NOTIFICATION_POLL_INTERVAL_HOUR_OPTIONS.includes(interval)
    ? interval
    : DEFAULT_NOTIFICATION_SETTINGS.pollIntervalHours;
};

export const normalizeNotificationSettings = (
  value: unknown
): NotificationSettings => {
  const input =
    value && typeof value === "object"
      ? (value as Partial<NotificationSettings>)
      : {};
  const inputAlerts =
    input.alerts && typeof input.alerts === "object" ? input.alerts : {};

  const alerts = NOTIFICATION_ALERT_KEYS.reduce(
    (acc, key) => {
      const fallback = DEFAULT_NOTIFICATION_SETTINGS.alerts[key];
      const item = (inputAlerts as Record<string, unknown>)[key];
      const alert = item && typeof item === "object" ? item : {};

      acc[key] = {
        enabled:
          typeof (alert as Partial<NotificationAlertSettings>).enabled ===
          "boolean"
            ? Boolean((alert as Partial<NotificationAlertSettings>).enabled)
            : fallback.enabled,
        titleTemplate: normalizeTemplate(
          (alert as Partial<NotificationAlertSettings>).titleTemplate,
          fallback.titleTemplate
        ),
        bodyTemplate: normalizeTemplate(
          (alert as Partial<NotificationAlertSettings>).bodyTemplate,
          fallback.bodyTemplate
        ),
      };
      return acc;
    },
    {} as Record<NotificationAlertKey, NotificationAlertSettings>
  );

  return {
    enabled:
      typeof input.enabled === "boolean"
        ? input.enabled
        : DEFAULT_NOTIFICATION_SETTINGS.enabled,
    dryRun:
      typeof input.dryRun === "boolean"
        ? input.dryRun
        : DEFAULT_NOTIFICATION_SETTINGS.dryRun,
    pollIntervalHours: normalizePollIntervalHours(input.pollIntervalHours),
    alerts,
  };
};

export const renderNotificationTemplate = (
  template: string,
  variables: NotificationTemplateVariables
) =>
  template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) =>
    String(variables[key] ?? "")
  );

export const buildNotificationCopy = ({
  alert,
  variables,
}: {
  alert: NotificationAlertSettings;
  variables: NotificationTemplateVariables;
}) => ({
  title: renderNotificationTemplate(alert.titleTemplate, variables).trim(),
  body: renderNotificationTemplate(alert.bodyTemplate, variables).trim(),
});

const sampleVariablesByAlert: Record<
  NotificationAlertKey,
  NotificationTemplateVariables
> = {
  round_published: { roundTitle: "Test Round", roundSlug: "test-round" },
  round_submissions_open: {
    roundTitle: "Test Round",
    roundSlug: "test-round",
  },
  round_voting_open: { roundTitle: "Test Round", roundSlug: "test-round" },
  round_voting_ending_24h: {
    roundTitle: "Test Round",
    roundSlug: "test-round",
  },
  round_results_finalized: {
    roundTitle: "Test Round",
    roundSlug: "test-round",
  },
  auction_started: { tokenId: 1 },
  auction_ending_soon_1h: { tokenId: 1 },
  auction_ended: { tokenId: 1 },
  auction_settled: { tokenId: 1 },
  yellow_proposal_created: {
    proposalTitle: "Test Proposal",
    proposalId: "0x123",
  },
  yellow_proposal_active: {
    proposalTitle: "Test Proposal",
    proposalId: "0x123",
  },
  yellow_proposal_ending_24h: {
    proposalTitle: "Test Proposal",
    proposalId: "0x123",
  },
  yellow_proposal_final: {
    proposalTitle: "Test Proposal",
    proposalId: "0x123",
  },
  nouns_snapshot_created: {
    proposalTitle: "Test Proposal",
    proposalNumber: 1,
    winningChoice: "FOR",
  },
  nouns_snapshot_closed: {
    proposalTitle: "Test Proposal",
    proposalNumber: 1,
    winningChoice: "FOR",
  },
  nouns_snapshot_cancelled: {
    proposalTitle: "Test Proposal",
    proposalNumber: 1,
    winningChoice: "FOR",
  },
  nouns_vote_executed: {
    proposalTitle: "Test Proposal",
    proposalNumber: 1,
    winningChoice: "FOR",
  },
};

export const truncateNotificationText = (value: string, limit: number) =>
  value.length > limit ? value.slice(0, Math.max(0, limit - 1)).trimEnd() : value;

export const clampNotificationCopy = ({
  title,
  body,
}: {
  title: string;
  body: string;
}) => ({
  title: truncateNotificationText(title, NOTIFICATION_TITLE_LIMIT),
  body: truncateNotificationText(body, NOTIFICATION_BODY_LIMIT),
});

export const validateNotificationCopy = ({
  title,
  body,
  targetUrl,
}: {
  title: string;
  body: string;
  targetUrl: string;
}) => {
  const errors: string[] = [];
  if (!title.trim()) errors.push("Notification title is required.");
  if (!body.trim()) errors.push("Notification body is required.");
  if (title.length > NOTIFICATION_TITLE_LIMIT) {
    errors.push("Notification title must be 32 characters or fewer.");
  }
  if (body.length > NOTIFICATION_BODY_LIMIT) {
    errors.push("Notification body must be 128 characters or fewer.");
  }

  try {
    const parsed = new URL(targetUrl);
    if (parsed.protocol !== "https:" || parsed.hostname !== SITE_DOMAIN) {
      errors.push(`Notification target URL must use ${SITE_DOMAIN}.`);
    }
  } catch {
    errors.push("Notification target URL is invalid.");
  }

  return errors;
};

export const validateNotificationSettings = (
  settings: NotificationSettings
) => {
  const errors: string[] = [];

  for (const key of NOTIFICATION_ALERT_KEYS) {
    const alert = settings.alerts[key];
    const copy = buildNotificationCopy({
      alert,
      variables: sampleVariablesByAlert[key],
    });
    const copyErrors = validateNotificationCopy({
      ...copy,
      targetUrl: `https://${SITE_DOMAIN}/`,
    });

    copyErrors.forEach((error) => {
      errors.push(`${key}: ${error}`);
    });
  }

  return errors;
};
