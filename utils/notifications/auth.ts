import type { NextApiRequest } from "next";

export const hasNotificationCronAuth = (req: NextApiRequest) => {
  const secret = process.env.NOTIFICATIONS_CRON_SECRET;
  if (!secret) return false;

  const header = req.headers.authorization || "";
  return header === `Bearer ${secret}`;
};
