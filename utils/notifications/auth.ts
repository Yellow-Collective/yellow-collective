import type { NextApiRequest } from "next";

export const hasNotificationCronAuth = (req: NextApiRequest) => {
  const secrets = [
    process.env.NOTIFICATIONS_CRON_SECRET,
    process.env.CRON_SECRET,
  ].filter((secret): secret is string => Boolean(secret));
  if (secrets.length === 0) return false;

  const header = req.headers.authorization || "";
  return secrets.some((secret) => header === `Bearer ${secret}`);
};
