import {
  buildRandomTraits,
  NounPreviewTile,
  type NoundrySubmission,
} from "@/components/noundry/NoundryPreview";
import useEnsAvatar from "@/hooks/fetch/useEnsAvatar";
import useEnsNames from "@/hooks/fetch/useEnsNames";
import { getProfilePath, shortenWalletAddress } from "@/utils/profile/identity";
import {
  ACTIVITY_CATEGORIES,
  type ActivityCategory,
  type ActivityFeedResponse,
  type ActivityItem,
} from "@/utils/activity";
import { ETHERSCAN_BASEURL } from "constants/urls";
import type { PlaygroundArtwork } from "data/nouns-builder/artwork";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Jazzicon, { jsNumberForAddress } from "react-jazzicon";
import useSWR from "swr";
import useSWRInfinite from "swr/infinite";
import { getAddress, isAddress, type Address } from "viem";

const FILTER_LABELS: Record<ActivityCategory, string> = {
  all: "All",
  auctions: "Auctions",
  rounds: "Rounds",
  proposals: "Governance",
  noundry: "Noundry",
};

const CATEGORY_LABELS = {
  auctions: "Auction",
  rounds: "Round",
  proposals: "Governance",
  noundry: "Noundry",
} as const;

const BLUE_3D_BUTTON_CLASSES =
  "yc-dark-submit-blue bg-[#1d9bf0] text-white shadow-[0px_4.02px_0px_0px_#0f5f99] transition hover:-translate-y-0.5 hover:bg-[#45adf5] active:translate-y-1 active:shadow-none motion-reduce:transform-none";

const EMPTY_NOUN_PIXELS = Array.from(
  { length: 32 * 32 },
  () => "transparent"
);

const fetchJson = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Unable to load activity data.");
  return response.json();
};

const getMeta = (item: ActivityItem) => {
  const values: string[] = [];
  if (typeof item.metadata?.amount === "string") values.push(item.metadata.amount);
  if (typeof item.metadata?.voteWeight === "string") values.push(item.metadata.voteWeight);
  if (typeof item.metadata?.roundTitle === "string") values.push(item.metadata.roundTitle);
  if (typeof item.metadata?.traitType === "string") values.push(item.metadata.traitType);
  return values;
};

type ProfileIdentityResponse = {
  profile?: { avatarUrl?: string } | null;
  fallbackAvatarUrl?: string;
};

const GovernanceIcon = () => (
  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-skin-stroke bg-[#fff7bf] text-[#6d5600]">
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        d="M5 4.5h14v15H5zM8 8h8M8 12h8M8 16h5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  </span>
);

const ActivityAvatar = ({ address }: { address?: string }) => {
  const normalizedAddress = address && isAddress(address) ? getAddress(address) : undefined;
  const { data: ensAvatar } = useEnsAvatar(normalizedAddress as Address | undefined);
  const { data: profile } = useSWR<ProfileIdentityResponse>(
    normalizedAddress ? `/api/profile/${normalizedAddress}` : null,
    fetchJson
  );
  const { data: artwork } = useSWR<PlaygroundArtwork>(
    normalizedAddress ? "/api/playground/artwork" : null,
    fetchJson
  );
  const avatarCandidates = useMemo(
    () =>
      Array.from(
        new Set(
          [
            profile?.profile?.avatarUrl,
            ensAvatar?.ensAvatar,
            profile?.fallbackAvatarUrl,
          ]
            .map((value) => value?.trim())
            .filter((value): value is string => Boolean(value))
        )
      ),
    [ensAvatar?.ensAvatar, profile?.fallbackAvatarUrl, profile?.profile?.avatarUrl]
  );
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const avatarUrl =
    avatarCandidates.find((candidate) => !failedImages.includes(candidate)) ||
    "";

  useEffect(() => {
    setFailedImages((current) =>
      current.filter((failedUrl) => avatarCandidates.includes(failedUrl))
    );
  }, [avatarCandidates]);

  const traits = useMemo(
    () =>
      artwork && normalizedAddress
        ? buildRandomTraits(artwork, normalizedAddress.toLowerCase())
        : {},
    [artwork, normalizedAddress]
  );
  const hasGeneratedNounFallback = Object.keys(traits).length > 0;
  const submission = useMemo<NoundrySubmission | undefined>(
    () =>
      normalizedAddress
        ? {
            id: `activity-${normalizedAddress}`,
            title: `${normalizedAddress} profile noun`,
            artist: normalizedAddress,
            traitType: "heads",
            pixels: EMPTY_NOUN_PIXELS,
            selectedTraits: traits,
            previewTraits: traits,
            status: "approved",
            createdAt: "",
            updatedAt: "",
          }
        : undefined,
    [normalizedAddress, traits]
  );

  if (!normalizedAddress) return <GovernanceIcon />;

  return (
    <Link
      href={getProfilePath({ address: normalizedAddress })}
      aria-label={`View profile for ${normalizedAddress}`}
      className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-skin-stroke bg-[#ffcc00]"
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt=""
          className="h-full w-full object-cover"
          onError={() =>
            setFailedImages((current) =>
              current.includes(avatarUrl) ? current : [...current, avatarUrl]
            )
          }
        />
      ) : artwork && submission && hasGeneratedNounFallback ? (
        <div className="h-full w-full">
          <NounPreviewTile
            artwork={artwork}
            submission={submission}
            traits={traits}
            showEditedTrait={false}
          />
        </div>
      ) : (
        <Jazzicon diameter={36} seed={jsNumberForAddress(normalizedAddress)} />
      )}
    </Link>
  );
};

const ActivityActor = ({
  item,
  ensName,
}: {
  item: ActivityItem;
  ensName?: string;
}) => {
  const normalizedAddress =
    item.actor?.address && isAddress(item.actor.address)
      ? getAddress(item.actor.address)
      : undefined;
  if (normalizedAddress) {
    return (
      <Link
        href={getProfilePath({ address: normalizedAddress })}
        className="shrink-0 font-heading text-skin-base underline decoration-2 underline-offset-4"
      >
        {ensName || shortenWalletAddress(normalizedAddress)}
      </Link>
    );
  }

  return item.actor?.label ? (
    <span className="shrink-0 font-heading text-skin-base">{item.actor.label}</span>
  ) : null;
};

const ActivityRow = ({ item, ensName }: { item: ActivityItem; ensName?: string }) => {
  const meta = getMeta(item);
  const hasExpandedComment =
    Boolean(item.description) &&
    (item.type === "auction-bid" || item.type === "proposal-vote");
  const exactTime = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(item.timestamp));
  const compactDate = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(item.timestamp));

  return (
    <li className="flex min-h-16 items-start gap-3 border-b border-skin-stroke py-2.5 last:border-b-0">
      <span className="mt-1 flex w-24 shrink-0 justify-center rounded-full bg-skin-muted px-2 py-0.5 text-[11px] font-semibold text-secondary">
        {CATEGORY_LABELS[item.category]}
      </span>
      <ActivityAvatar address={item.actor?.address} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-start gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-1.5 text-sm leading-snug md:flex-nowrap">
            <ActivityActor item={item} ensName={ensName} />
            <Link href={item.href} className="min-w-0 truncate font-medium text-skin-base hover:underline">
              {item.title}
            </Link>
            {item.description && !hasExpandedComment && (
              <span className="min-w-0 truncate text-secondary">- {item.description}</span>
            )}
            {meta.map((value) => (
              <span key={value} className="min-w-0 truncate text-xs text-secondary">
                {value}
              </span>
            ))}
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2 text-xs text-secondary">
            <time dateTime={item.timestamp} title={exactTime} aria-label={exactTime}>
              {compactDate}
            </time>
            {item.transactionHash && ETHERSCAN_BASEURL && (
              <a
                href={`${ETHERSCAN_BASEURL}/tx/${item.transactionHash}`}
                target="_blank"
                rel="noreferrer"
                aria-label="View transaction on BaseScan"
                title="View transaction on BaseScan"
                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-secondary transition hover:bg-skin-muted hover:text-skin-base"
              >
                <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
                  <path
                    d="M6 14 14 6M8 6h6v6"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.8"
                  />
                </svg>
              </a>
            )}
          </div>
        </div>
        {hasExpandedComment && (
          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-snug text-secondary">
            {item.description}
          </p>
        )}
      </div>
    </li>
  );
};

export const ActivityFeed = () => {
  const [category, setCategory] = useState<ActivityCategory>("all");
  const getKey = (
    pageIndex: number,
    previousPageData: ActivityFeedResponse | null
  ) => {
    if (previousPageData && !previousPageData.nextCursor) return null;
    const params = new URLSearchParams({ category, limit: "10" });
    if (pageIndex > 0 && previousPageData?.nextCursor) {
      params.set("cursor", previousPageData.nextCursor);
    }
    return `/api/activity?${params.toString()}`;
  };
  const { data, error, isLoading, isValidating, mutate, setSize, size } =
    useSWRInfinite<ActivityFeedResponse>(getKey, fetchJson, {
      revalidateFirstPage: true,
      revalidateOnFocus: true,
    });

  useEffect(() => {
    void setSize(1);
  }, [category, setSize]);

  const items = useMemo(() => {
    const unique = new Map<string, ActivityItem>();
    for (const page of data || []) {
      for (const item of page.items) unique.set(item.id, item);
    }
    return Array.from(unique.values());
  }, [data]);
  const actorAddresses = useMemo(
    () =>
      Array.from(
        new Set(
          items
            .map((item) => item.actor?.address)
            .filter((address): address is string => Boolean(address && isAddress(address)))
        )
      ),
    [items]
  );
  const { data: ensNames } = useEnsNames(actorAddresses);
  const sourceErrors = Array.from(
    new Set((data || []).flatMap((page) => Object.values(page.sourceErrors || {})))
  );
  const lastPage = data?.[data.length - 1];
  const canLoadMore = Boolean(lastPage?.nextCursor);
  const isLoadingMore = isValidating && Boolean(data) && size > (data?.length || 0);

  return (
    <section
      aria-labelledby="dashboard-activity"
      className="yc-dark-yellow-form-surface rounded-2xl border border-skin-stroke bg-white p-5 shadow-[0px_4.02px_0px_0px_rgb(var(--color-shadow-neutral))] md:p-6"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 id="dashboard-activity" className="font-heading text-[28px] leading-none text-skin-base">
            Activity
          </h2>
          <p className="mt-2 text-sm leading-snug text-secondary">
            Recent public activity across Yellow Collective.
          </p>
        </div>

        <div className="flex max-w-full gap-2 overflow-x-auto pb-1 pt-1 lg:ml-auto lg:justify-end" aria-label="Activity filters">
          {ACTIVITY_CATEGORIES.map((filter) => {
            const active = category === filter;
            return (
              <button
                key={filter}
                type="button"
                aria-pressed={active}
                onClick={() => setCategory(filter)}
                className={`min-h-10 shrink-0 rounded-[18px] px-4 py-2 font-heading text-sm ${
                  active
                    ? BLUE_3D_BUTTON_CLASSES
                    : "border border-skin-stroke bg-white text-skin-base shadow-[0px_4px_0px_0px_#9ca3af] transition hover:-translate-y-0.5 hover:bg-[#fff7bf] active:translate-y-1 active:shadow-none motion-reduce:transform-none"
                }`}
              >
                {FILTER_LABELS[filter]}
              </button>
            );
          })}
        </div>
      </div>

      {sourceErrors.length > 0 && (
        <div role="status" className="mt-4 rounded-xl border border-[#d7aa00] bg-[#fff7bf] p-3 text-sm text-[#6d5600]">
          Some activity could not be loaded: {sourceErrors.join(" ")}
        </div>
      )}

      {isLoading ? (
        <div aria-busy="true" aria-label="Loading activity" className="mt-4 space-y-2">
          {Array.from({ length: 10 }, (_, row) => (
            <div key={row} className="h-16 animate-pulse rounded-xl bg-skin-muted motion-reduce:animate-none" />
          ))}
        </div>
      ) : error && items.length === 0 ? (
        <div role="alert" className="mt-5 rounded-xl border border-skin-proposal-danger bg-skin-muted p-4 text-sm text-skin-proposal-danger">
          <p>Unable to load activity right now.</p>
          <button type="button" onClick={() => void mutate()} className="mt-3 font-heading underline decoration-2 underline-offset-4">
            Try again
          </button>
        </div>
      ) : items.length === 0 ? (
        <div role="status" className="mt-5 rounded-xl border border-skin-stroke bg-skin-muted p-4 text-sm text-secondary">
          {category === "all"
            ? "No public activity is available yet."
            : `No ${FILTER_LABELS[category].toLowerCase()} activity is available yet.`}
        </div>
      ) : (
        <>
          <ul className="mt-4 h-[640px] overflow-y-auto pr-2" role="list" aria-label="Activity history">
            {items.map((item) => (
              <ActivityRow
                key={item.id}
                item={item}
                ensName={
                  item.actor?.address
                    ? ensNames?.names[item.actor.address.toLowerCase()]
                    : undefined
                }
              />
            ))}
          </ul>
          <div className="mt-4 flex flex-col items-center gap-2">
            {canLoadMore ? (
              <button
                type="button"
                disabled={isLoadingMore}
                onClick={() => void setSize((currentSize) => currentSize + 1)}
                className={`${BLUE_3D_BUTTON_CLASSES} min-h-11 rounded-[18px] px-5 py-2 font-heading text-base disabled:cursor-wait disabled:opacity-60`}
              >
                {isLoadingMore ? "Loading..." : "Load older activity"}
              </button>
            ) : (
              <p className="text-xs text-secondary">No additional activity.</p>
            )}
          </div>
        </>
      )}
    </section>
  );
};
