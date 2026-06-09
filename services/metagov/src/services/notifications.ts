import crypto from "crypto";
import { config } from "../config";
import { StateStore } from "./state-store";

type MetagovNotificationEvent =
  | "nouns_snapshot_created"
  | "nouns_snapshot_closed"
  | "nouns_snapshot_cancelled"
  | "nouns_vote_executed";

type AlertSettings = {
  enabled: boolean;
  titleTemplate: string;
  bodyTemplate: string;
};

type NotificationSettings = {
  enabled: boolean;
  dryRun: boolean;
  alerts: Record<MetagovNotificationEvent, AlertSettings>;
};

type NotificationVariables = Record<string, string | number | undefined | null>;

const NEYNAR_NOTIFICATIONS_URL =
  "https://api.neynar.com/v2/farcaster/frame/notifications/";
const TITLE_LIMIT = 32;
const BODY_LIMIT = 128;

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: true,
  dryRun: false,
  alerts: {
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
  },
};

const createUuid = (...parts: string[]) => {
  const hash = crypto.createHash("sha256").update(parts.join(":")).digest("hex");
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    `5${hash.slice(13, 16)}`,
    ((parseInt(hash.slice(16, 18), 16) & 0x3f) | 0x80).toString(16) +
      hash.slice(18, 20),
    hash.slice(20, 32),
  ].join("-");
};

const normalizeTargetUrl = (targetPath: string) => {
  const origin = new URL(config.notificationsTargetOrigin);
  if (
    origin.protocol !== "https:" ||
    origin.hostname !== "yellowcollective.art"
  ) {
    throw new Error("Notifications target origin must be yellowcollective.art.");
  }

  const target = targetPath.startsWith("/")
    ? new URL(targetPath, origin.origin)
    : new URL(targetPath);

  if (
    target.protocol !== "https:" ||
    target.hostname !== "yellowcollective.art"
  ) {
    throw new Error("Notification target URL must use yellowcollective.art.");
  }

  return target.href;
};

const renderTemplate = (template: string, variables: NotificationVariables) =>
  template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) =>
    String(variables[key] ?? "")
  );

const truncate = (value: string, limit: number) =>
  value.length > limit
    ? value.slice(0, Math.max(0, limit - 1)).trimEnd()
    : value;

const getSettings = async (): Promise<NotificationSettings> => {
  if (!config.notificationsSettingsUrl) return DEFAULT_SETTINGS;

  const response = await fetch(config.notificationsSettingsUrl, {
    headers: config.notificationsCronSecret
      ? { Authorization: `Bearer ${config.notificationsCronSecret}` }
      : {},
  });
  if (!response.ok) return DEFAULT_SETTINGS;

  const payload = (await response.json()) as {
    settings?: Partial<NotificationSettings>;
  };
  const settings = payload.settings || {};
  return {
    enabled:
      typeof settings.enabled === "boolean"
        ? settings.enabled
        : DEFAULT_SETTINGS.enabled,
    dryRun:
      typeof settings.dryRun === "boolean"
        ? settings.dryRun
        : DEFAULT_SETTINGS.dryRun,
    alerts: {
      ...DEFAULT_SETTINGS.alerts,
      ...(settings.alerts || {}),
    },
  };
};

export const sendMetagovNotification = async ({
  store,
  eventType,
  sourceId,
  targetPath,
  variables,
}: {
  store: StateStore;
  eventType: MetagovNotificationEvent;
  sourceId: string;
  targetPath: string;
  variables: NotificationVariables;
}) => {
  if (store.hasNotification(eventType, sourceId)) return;

  const settings = await getSettings();
  const alert = settings.alerts[eventType] || DEFAULT_SETTINGS.alerts[eventType];
  if (!settings.enabled || !alert.enabled) return;

  const targetUrl = normalizeTargetUrl(targetPath);
  const title = truncate(
    renderTemplate(alert.titleTemplate, variables),
    TITLE_LIMIT
  );
  const body = truncate(renderTemplate(alert.bodyTemplate, variables), BODY_LIMIT);
  const uuid = createUuid(eventType, sourceId);
  const dryRun = settings.dryRun || config.notificationsDryRun || config.dryRun;

  if (!dryRun && !config.neynarApiKey) {
    throw new Error("NEYNAR_API_KEY is required for metagov notifications.");
  }

  const response = dryRun
    ? {
        campaign_id: uuid,
        success_count: 0,
        failure_count: 0,
        not_attempted_count: 0,
        retryable_fids: [],
      }
    : await fetch(NEYNAR_NOTIFICATIONS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": config.neynarApiKey,
        },
        body: JSON.stringify({
          notification: {
            title,
            body,
            target_url: targetUrl,
            uuid,
          },
          target_fids: [],
        }),
      }).then(async (res) => {
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            `Neynar notification request failed: ${res.status} ${JSON.stringify(
              payload
            )}`
          );
        }
        return payload;
      });

  store.markNotification({
    eventType,
    sourceId,
    targetUrl,
    response,
  });
};
