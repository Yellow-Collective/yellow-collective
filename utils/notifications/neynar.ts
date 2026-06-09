import { createHash } from "crypto";
import {
  clampNotificationCopy,
  validateNotificationCopy,
} from "@/utils/notifications/settings";
import { SITE_DOMAIN } from "@/utils/site";

const NEYNAR_NOTIFICATIONS_URL =
  "https://api.neynar.com/v2/farcaster/frame/notifications/";
const NEYNAR_NOTIFICATION_TOKENS_URL =
  "https://api.neynar.com/v2/farcaster/frame/notification_tokens/";

export type NeynarNotificationResponse = {
  campaign_id: string;
  failure_count: number;
  not_attempted_count: number;
  success_count: number;
  retryable_fids: number[];
};

export type PublishNeynarNotificationInput = {
  title: string;
  body: string;
  targetUrl: string;
  uuid: string;
  targetFids?: number[];
  dryRun?: boolean;
};

export type NeynarNotificationToken = {
  fid: number;
  url: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type FetchNeynarNotificationTokensInput = {
  fids?: number[];
  limit?: number;
  fetchImpl?: typeof fetch;
};

const getNotificationOrigin = () => {
  const origin =
    process.env.NOTIFICATIONS_TARGET_ORIGIN || `https://${SITE_DOMAIN}`;
  const parsed = new URL(origin);
  if (parsed.protocol !== "https:" || parsed.hostname !== SITE_DOMAIN) {
    throw new Error(`Notifications origin must be https://${SITE_DOMAIN}.`);
  }
  return parsed.origin;
};

export const normalizeNotificationTargetUrl = (targetPathOrUrl: string) => {
  const target = targetPathOrUrl.startsWith("/")
    ? new URL(targetPathOrUrl, getNotificationOrigin())
    : new URL(targetPathOrUrl);

  if (target.protocol !== "https:" || target.hostname !== SITE_DOMAIN) {
    throw new Error(`Notification target URL must use ${SITE_DOMAIN}.`);
  }

  return target.href;
};

export const createNotificationUuid = (...parts: Array<string | number>) => {
  const hash = createHash("sha256").update(parts.join(":")).digest("hex");
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    `5${hash.slice(13, 16)}`,
    ((parseInt(hash.slice(16, 18), 16) & 0x3f) | 0x80).toString(16) +
      hash.slice(18, 20),
    hash.slice(20, 32),
  ].join("-");
};

export const fetchNeynarNotificationTokens = async ({
  fids,
  limit = 100,
  fetchImpl = fetch,
}: FetchNeynarNotificationTokensInput = {}): Promise<
  NeynarNotificationToken[]
> => {
  const apiKey = process.env.NEYNAR_API_KEY;
  if (!apiKey) throw new Error("NEYNAR_API_KEY is required.");

  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 100);
  const tokens: NeynarNotificationToken[] = [];
  let cursor: string | null = null;

  do {
    const url = new URL(NEYNAR_NOTIFICATION_TOKENS_URL);
    url.searchParams.set("limit", String(safeLimit));
    if (cursor) url.searchParams.set("cursor", cursor);
    if (fids?.length) {
      url.searchParams.set(
        "fids",
        fids
          .map((fid) => Number(fid))
          .filter((fid) => Number.isInteger(fid) && fid > 0)
          .slice(0, 100)
          .join(",")
      );
    }

    const response = await fetchImpl(url.href, {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
      },
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        `Neynar notification token request failed: ${
          response.status
        } ${JSON.stringify(payload)}`
      );
    }

    const pageTokens = Array.isArray(payload.notification_tokens)
      ? payload.notification_tokens
      : [];
    for (const token of pageTokens) {
      const fid = Number(token?.fid);
      if (!Number.isInteger(fid) || fid <= 0) continue;

      tokens.push({
        fid,
        url: typeof token.url === "string" ? token.url : null,
        createdAt:
          typeof token.created_at === "string" ? token.created_at : null,
        updatedAt:
          typeof token.updated_at === "string" ? token.updated_at : null,
      });
    }

    cursor =
      typeof payload.next?.cursor === "string" && payload.next.cursor
        ? payload.next.cursor
        : null;
  } while (cursor);

  return tokens;
};

export const publishNeynarNotification = async ({
  title,
  body,
  targetUrl,
  uuid,
  targetFids = [],
  dryRun = false,
}: PublishNeynarNotificationInput): Promise<NeynarNotificationResponse> => {
  const normalizedTargetUrl = normalizeNotificationTargetUrl(targetUrl);
  const copy = clampNotificationCopy({ title, body });
  const errors = validateNotificationCopy({
    ...copy,
    targetUrl: normalizedTargetUrl,
  });
  if (errors.length) throw new Error(errors.join(" "));

  if (dryRun) {
    return {
      campaign_id: uuid,
      failure_count: 0,
      not_attempted_count: 0,
      success_count: 0,
      retryable_fids: [],
    };
  }

  const apiKey = process.env.NEYNAR_API_KEY;
  if (!apiKey) throw new Error("NEYNAR_API_KEY is required.");

  const response = await fetch(NEYNAR_NOTIFICATIONS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      notification: {
        title: copy.title,
        body: copy.body,
        target_url: normalizedTargetUrl,
        uuid,
      },
      target_fids: targetFids,
    }),
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      `Neynar notification request failed: ${response.status} ${JSON.stringify(
        payload
      )}`
    );
  }

  return payload as NeynarNotificationResponse;
};
