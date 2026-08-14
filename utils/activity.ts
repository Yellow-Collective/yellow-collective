export const ACTIVITY_CATEGORIES = [
  "all",
  "auctions",
  "rounds",
  "proposals",
  "noundry",
] as const;

export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];
export type ActivitySource = Exclude<ActivityCategory, "all">;

export type ActivityEventType =
  | "auction-created"
  | "auction-bid"
  | "auction-settled"
  | "round-submission"
  | "round-vote"
  | "proposal-created"
  | "proposal-vote"
  | "proposal-queued"
  | "proposal-executed"
  | "proposal-canceled"
  | "proposal-vetoed"
  | "noundry-submission";

export type ActivityItem = {
  id: string;
  category: ActivitySource;
  type: ActivityEventType;
  timestamp: string;
  actor?: {
    address?: string;
    label?: string;
  };
  title: string;
  description?: string;
  href: string;
  transactionHash?: string;
  metadata?: Record<string, string | number>;
};

export type ActivityFeedResponse = {
  items: ActivityItem[];
  nextCursor: string | null;
  sourceErrors?: Partial<Record<ActivitySource, string>>;
};

export type ActivityQuery = {
  category: ActivityCategory;
  limit: number;
  cursor?: string;
};

export const DEFAULT_ACTIVITY_LIMIT = 10;
export const MAX_ACTIVITY_LIMIT = 50;

const cleanQueryValue = (value: unknown) =>
  typeof value === "string" && value.length > 0 ? value : undefined;

export const parseActivityQuery = (
  query: Record<string, unknown>
): { value?: ActivityQuery; error?: string } => {
  if (Array.isArray(query.category) || Array.isArray(query.limit) || Array.isArray(query.cursor)) {
    return { error: "Activity query parameters must be singular." };
  }

  const category = cleanQueryValue(query.category) || "all";
  if (!ACTIVITY_CATEGORIES.includes(category as ActivityCategory)) {
    return { error: "Unsupported activity category." };
  }

  const rawLimit = cleanQueryValue(query.limit);
  const limit = rawLimit ? Number(rawLimit) : DEFAULT_ACTIVITY_LIMIT;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_ACTIVITY_LIMIT) {
    return {
      error: `Activity limit must be an integer from 1 to ${MAX_ACTIVITY_LIMIT}.`,
    };
  }

  const cursor = cleanQueryValue(query.cursor);
  if (cursor && !decodeActivityCursor(cursor)) {
    return { error: "Invalid activity cursor." };
  }

  return {
    value: {
      category: category as ActivityCategory,
      limit,
      ...(cursor ? { cursor } : {}),
    },
  };
};

export const sanitizeActivityText = (value: unknown, maxLength = 180) => {
  if (typeof value !== "string") return undefined;
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return undefined;
  return cleaned.length > maxLength
    ? `${cleaned.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`
    : cleaned;
};

export const sortAndDedupeActivity = (items: ActivityItem[]) => {
  const unique = new Map<string, ActivityItem>();
  for (const item of items) {
    if (!unique.has(item.id) && Number.isFinite(Date.parse(item.timestamp))) {
      unique.set(item.id, item);
    }
  }

  return Array.from(unique.values()).sort((first, second) => {
    const timeDifference = Date.parse(second.timestamp) - Date.parse(first.timestamp);
    return timeDifference || first.id.localeCompare(second.id);
  });
};

type DecodedCursor = { timestamp: string; id: string };

export const encodeActivityCursor = ({ timestamp, id }: DecodedCursor) =>
  Buffer.from(JSON.stringify([timestamp, id]), "utf8").toString("base64url");

export const decodeActivityCursor = (cursor: string): DecodedCursor | null => {
  try {
    const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (
      !Array.isArray(decoded) ||
      decoded.length !== 2 ||
      typeof decoded[0] !== "string" ||
      typeof decoded[1] !== "string" ||
      !Number.isFinite(Date.parse(decoded[0]))
    ) {
      return null;
    }
    return { timestamp: decoded[0], id: decoded[1] };
  } catch {
    return null;
  }
};

const isAfterCursor = (item: ActivityItem, cursor: DecodedCursor) => {
  const itemTime = Date.parse(item.timestamp);
  const cursorTime = Date.parse(cursor.timestamp);
  return itemTime < cursorTime || (itemTime === cursorTime && item.id > cursor.id);
};

export const paginateActivity = ({
  items,
  category,
  limit,
  cursor,
}: ActivityQuery & { items: ActivityItem[] }) => {
  const filtered = items.filter(
    (item) => category === "all" || item.category === category
  );
  const sorted = sortAndDedupeActivity(filtered);
  const decodedCursor = cursor ? decodeActivityCursor(cursor) : null;
  const remaining = decodedCursor
    ? sorted.filter((item) => isAfterCursor(item, decodedCursor))
    : sorted;
  const pageItems = remaining.slice(0, limit);
  const lastItem = pageItems.at(-1);

  return {
    items: pageItems,
    nextCursor:
      lastItem && remaining.length > pageItems.length
        ? encodeActivityCursor(lastItem)
        : null,
  };
};
