const MAX_SCHEDULE_EARLY_WAIT_MS = 60 * 1000;
const MAX_SCHEDULE_LATE_MS = 10 * 60 * 1000;

export const getScheduledNotificationDelay = (
  scheduledAt: Date,
  now = new Date()
) => {
  const delayMs = scheduledAt.getTime() - now.getTime();

  if (
    !Number.isFinite(delayMs) ||
    delayMs > MAX_SCHEDULE_EARLY_WAIT_MS ||
    delayMs < -MAX_SCHEDULE_LATE_MS
  ) {
    return null;
  }

  return Math.max(0, delayMs);
};
