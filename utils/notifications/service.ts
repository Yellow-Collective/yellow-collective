import {
  getNotificationEvent,
  markNotificationEventSent,
  upsertNotificationEventAttempt,
} from "data/notifications";
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  buildNotificationCopy,
  clampNotificationCopy,
  type NotificationAlertKey,
  type NotificationSettings,
  type NotificationTemplateVariables,
} from "@/utils/notifications/settings";
import {
  createNotificationUuid,
  normalizeNotificationTargetUrl,
  publishNeynarNotification,
  type NeynarNotificationResponse,
} from "@/utils/notifications/neynar";

export { DEFAULT_NOTIFICATION_SETTINGS };

export type SendConfiguredNotificationInput = {
  eventType: NotificationAlertKey;
  sourceId: string;
  targetPath: string;
  variables: NotificationTemplateVariables;
  settings: NotificationSettings;
  targetFids?: number[];
  dryRun?: boolean;
  send?: typeof publishNeynarNotification;
};

export type SendConfiguredNotificationResult =
  | { status: "disabled" }
  | { status: "duplicate" }
  | { status: "sent"; response: NeynarNotificationResponse };

export const sendConfiguredNotification = async ({
  eventType,
  sourceId,
  targetPath,
  variables,
  settings,
  targetFids = [],
  dryRun,
  send = publishNeynarNotification,
}: SendConfiguredNotificationInput): Promise<SendConfiguredNotificationResult> => {
  const alert = settings.alerts[eventType];
  if (!settings.enabled || !alert?.enabled) return { status: "disabled" };

  const existing = await getNotificationEvent(eventType, sourceId);
  if (existing?.sentAt) return { status: "duplicate" };

  const targetUrl = normalizeNotificationTargetUrl(targetPath);
  const copy = clampNotificationCopy(
    buildNotificationCopy({ alert, variables })
  );
  const uuid = createNotificationUuid(eventType, sourceId);
  const shouldDryRun =
    dryRun ?? settings.dryRun ?? process.env.NOTIFICATIONS_DRY_RUN === "true";

  await upsertNotificationEventAttempt({
    id: uuid,
    eventType,
    sourceId,
    title: copy.title,
    body: copy.body,
    targetUrl,
    targetFids,
    dryRun: shouldDryRun,
  });

  const response = await send({
    ...copy,
    targetUrl,
    uuid,
    targetFids,
    dryRun: shouldDryRun,
  });

  if (!shouldDryRun) {
    await markNotificationEventSent({
      eventType,
      sourceId,
      response: response as unknown as Record<string, unknown>,
    });
  }

  return { status: "sent", response };
};
