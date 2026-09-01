import Layout from "@/components/Layout";
import CoinMediaPreview from "@/components/coins/CoinMediaPreview";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/Dialog";
import WalletIdentityLink from "@/components/WalletIdentityLink";
import { isAdminAddress } from "@/utils/admin";
import { getAdminSessionSignedRequestAction } from "@/utils/admin-auth";
import {
  getDexscreenerUrl,
  getExplorerAddressUrl,
  getZoraCoinUrl,
} from "@/utils/coining";
import { getRoundSignedRequestAction } from "@/utils/rounds/auth";
import { createSignedRequestAuthHeader } from "@/utils/signature-auth-client";
import { ArrowLeftIcon, EyeSlashIcon } from "@heroicons/react/20/solid";
import { TOKEN_NETWORK } from "constants/addresses";
import {
  getPublicGalleryCoinByAddressOrSlug,
  type GalleryCoin,
} from "data/coins";
import type { Round } from "data/rounds";
import type {
  GetServerSidePropsContext,
  GetServerSidePropsResult,
  InferGetServerSidePropsType,
} from "next";
import Head from "next/head";
import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { useAccount, useSignMessage } from "wagmi";

type CoinDetailProps = {
  coin: GalleryCoin;
};

type RoundsResponse = {
  rounds: Round[];
};

const ROUND_SIGNED_REQUEST_CHAIN_ID = Number(TOKEN_NETWORK);

const fetcher = async (url: string) => {
  const response = await fetch(url);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Unable to load data.");
  }

  return data;
};

class AdminRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const createAdminSession = async (
  adminAddress: string,
  signMessageAsync: (args: { message: string }) => Promise<string>
) => {
  const authorization = await createSignedRequestAuthHeader({
    walletAddress: adminAddress,
    chainId: ROUND_SIGNED_REQUEST_CHAIN_ID,
    action: getAdminSessionSignedRequestAction(),
    method: "POST",
    path: "/api/admin/session",
    payload: {},
    signMessageAsync,
  });
  const response = await fetch("/api/admin/session", {
    method: "POST",
    headers: { Authorization: authorization },
    cache: "no-store",
    credentials: "same-origin",
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Unable to authorize admin session.");
  }

  return data as { adminAddress: string };
};

const sendAdminGalleryUpdate = async (
  coinAddress: string,
  body: { hidden: boolean }
) => {
  const response = await fetch(
    `/api/admin/gallery/${encodeURIComponent(coinAddress)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      credentials: "same-origin",
      body: JSON.stringify(body),
    }
  );
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new AdminRequestError(
      data.error || "Unable to update coin.",
      response.status
    );
  }

  return data as { coin: GalleryCoin };
};

export const getServerSideProps = async ({
  params,
}: GetServerSidePropsContext): Promise<
  GetServerSidePropsResult<CoinDetailProps>
> => {
  const value = typeof params?.address === "string" ? params.address : "";
  const coin = await getPublicGalleryCoinByAddressOrSlug(value);

  if (!coin) return { notFound: true };

  return { props: { coin: JSON.parse(JSON.stringify(coin)) } };
};

const getDescriptionStorageKey = (address: string) =>
  `yellow:coin-description:${address.toLowerCase()}`;

export default function CoinDetailPage({
  coin,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const { address } = useAccount();
  const { signMessageAsync, isLoading: isSigningMessage } = useSignMessage();
  const { data: roundsData, error: roundsError } = useSWR<RoundsResponse>(
    "/api/rounds",
    fetcher
  );
  const [description, setDescription] = useState(coin.description);
  const [draftDescription, setDraftDescription] = useState(coin.description);
  const [isHidden, setIsHidden] = useState(coin.hidden);
  const [message, setMessage] = useState("");
  const [isRoundPanelOpen, setIsRoundPanelOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isMediaOpen, setIsMediaOpen] = useState(false);
  const [selectedRoundSlug, setSelectedRoundSlug] = useState("");
  const [roundMessage, setRoundMessage] = useState("");
  const [isSubmittingRound, setIsSubmittingRound] = useState(false);
  const [isHidingCoin, setIsHidingCoin] = useState(false);
  const rounds = roundsData?.rounds || [];
  const isAdmin = isAdminAddress(address);

  const isOwner = useMemo(
    () =>
      Boolean(
        address &&
          coin.ownerAddress &&
          address.toLowerCase() === coin.ownerAddress.toLowerCase()
      ),
    [address, coin.ownerAddress]
  );
  const canEdit = isOwner || isAdmin;

  useEffect(() => {
    const saved = window.localStorage.getItem(
      getDescriptionStorageKey(coin.address)
    );
    if (!saved) return;
    setDescription(saved);
    setDraftDescription(saved);
  }, [coin.address]);

  const saveDescription = () => {
    const nextDescription = draftDescription.trim();
    if (!nextDescription) {
      setMessage("Description cannot be empty.");
      return;
    }

    window.localStorage.setItem(
      getDescriptionStorageKey(coin.address),
      nextDescription
    );
    setDescription(nextDescription);
    setMessage("Description updated on this device.");
    setIsEditOpen(false);
  };

  const hideCoin = async () => {
    if (!address || !isAdmin || isHidden) return;

    setIsHidingCoin(true);
    setMessage("");

    try {
      try {
        await sendAdminGalleryUpdate(coin.address, { hidden: true });
      } catch (error) {
        if (
          !(error instanceof AdminRequestError) ||
          (error.status !== 401 && error.status !== 403)
        ) {
          throw error;
        }

        await createAdminSession(address, signMessageAsync);
        await sendAdminGalleryUpdate(coin.address, { hidden: true });
      }

      setIsHidden(true);
      setMessage("Coin hidden from the Gallery.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to hide coin.");
    } finally {
      setIsHidingCoin(false);
    }
  };

  const submitToRound = async () => {
    if (!address || !isOwner || !selectedRoundSlug) return;

    setIsSubmittingRound(true);
    setRoundMessage("");

    try {
      const path = `/api/rounds/${selectedRoundSlug}/submit`;
      const payload = {
        submission: {
          title: coin.title,
          description: [
            description,
            "",
            `Content coin: ${coin.coinName} (${coin.symbol})`,
            `Contract: ${coin.address}`,
            `Owner: ${coin.ownerAddress}`,
          ].join("\n"),
          image: coin.mediaUrl || coin.imageUrl,
          images: [coin.mediaUrl || coin.imageUrl],
          url: `/coins/${coin.address}`,
          submissionType: "project",
          source: "content_coin",
          sourcePayload: {
            coinAddress: coin.address,
            coinName: coin.coinName,
            coinSymbol: coin.symbol,
            mediaUrl: coin.mediaUrl,
            imageUrl: coin.imageUrl,
            ownerAddress: coin.ownerAddress,
            payoutRecipient: coin.payoutRecipient,
          },
        },
      };
      const authorization = await createSignedRequestAuthHeader({
        walletAddress: address,
        chainId: ROUND_SIGNED_REQUEST_CHAIN_ID,
        action: getRoundSignedRequestAction("submit"),
        method: "POST",
        path,
        payload,
        signMessageAsync,
      });
      const response = await fetch(path, {
        method: "POST",
        headers: {
          Authorization: authorization,
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to submit to round.");
      }

      setRoundMessage("Content coin submitted to the round.");
      setSelectedRoundSlug("");
    } catch (error) {
      setRoundMessage(
        error instanceof Error ? error.message : "Unable to submit to round."
      );
    } finally {
      setIsSubmittingRound(false);
    }
  };

  return (
    <Layout>
      <Head>
        <title>{coin.title} | Gallery | Yellow Collective</title>
      </Head>

      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6 pb-12">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/art"
            className="flex w-fit items-center gap-2 font-heading text-lg text-skin-base transition hover:opacity-80"
          >
            <span className="yc-dark-yellow-button flex h-10 w-10 items-center justify-center rounded-full border border-skin-stroke bg-white shadow-[0px_4.02px_0px_0px_rgb(var(--color-shadow-neutral))] transition hover:-translate-y-0.5 hover:bg-[#fff7bf] active:translate-y-1 active:shadow-none">
              <ArrowLeftIcon className="h-4 text-skin-base" />
            </span>
            Gallery
          </Link>

          {isOwner && (
            <button
              type="button"
              onClick={() => {
                setIsRoundPanelOpen((isOpen) => !isOpen);
                setRoundMessage("");
              }}
              className="yc-dark-submit-blue w-fit rounded-[18px] bg-[#1d9bf0] px-5 py-3 font-heading text-base text-white shadow-[0px_4.02px_0px_0px_#0f5f99] transition hover:-translate-y-0.5 hover:bg-[#45adf5] active:translate-y-1 active:shadow-none"
            >
              Submit to a round
            </button>
          )}
        </div>

        {isOwner && isRoundPanelOpen && (
          <section className="yc-round-submit-panel yc-project-surface rounded-2xl border border-skin-stroke bg-white p-5 text-[#212529] shadow-sm md:p-6">
            <h2 className="font-heading text-2xl leading-none">
              Submit to a round
            </h2>
            <p className="mt-2 max-w-[720px] text-base leading-snug">
              Submit this coin to an open Yellow round. This signs a message and
              creates a round submission; it does not change the coin contract.
            </p>
            <div className="mt-5 flex flex-col gap-3 md:flex-row">
              <select
                value={selectedRoundSlug}
                onChange={(event) => {
                  setSelectedRoundSlug(event.target.value);
                  setRoundMessage("");
                }}
                className="min-h-12 flex-1 rounded-xl border border-skin-stroke bg-skin-muted px-4 py-3 text-base text-skin-base focus:outline-none focus:ring-2 focus:ring-skin-highlighted"
              >
                <option value="">Select a round</option>
                {rounds.map((round) => (
                  <option key={round.slug} value={round.slug}>
                    {round.title}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={submitToRound}
                disabled={
                  !selectedRoundSlug ||
                  isSubmittingRound ||
                  isSigningMessage
                }
                className="yc-dark-submit-blue rounded-[18px] bg-[#1d9bf0] px-5 py-3 font-heading text-lg text-white shadow-[0px_4.02px_0px_0px_#0f5f99] transition hover:-translate-y-0.5 hover:bg-[#45adf5] active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmittingRound || isSigningMessage
                  ? "Submitting..."
                  : "Submit"}
              </button>
            </div>
            {roundsError && (
              <p className="mt-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700">
                Unable to load rounds.
              </p>
            )}
            {!roundsError && rounds.length === 0 && (
              <p className="mt-4 rounded-xl border border-skin-stroke bg-[#fff7bf] p-3 text-sm">
                No published rounds are available right now.
              </p>
            )}
            {roundMessage && (
              <p className="mt-4 rounded-xl border border-skin-stroke bg-skin-muted p-3 text-sm">
                {roundMessage}
              </p>
            )}
          </section>
        )}

        <section className="yc-project-surface overflow-hidden rounded-2xl border border-skin-stroke bg-white text-[#212529] shadow-sm">
          <div className="grid gap-0 md:grid-cols-[minmax(0,440px)_1fr]">
            <button
              type="button"
              onClick={() => setIsMediaOpen(true)}
              className="aspect-square w-full overflow-hidden bg-[#fff7bf] text-left focus:outline-none focus:ring-4 focus:ring-[#1d9bf0]"
              aria-label="Open media full size"
            >
              <CoinMediaPreview
                mediaUrl={coin.mediaUrl}
                imageUrl={coin.imageUrl}
                title={coin.title}
                symbol={coin.symbol}
                className="h-full w-full object-contain"
                fallbackClassName="flex h-full w-full items-center justify-center font-heading text-5xl"
                controls
              />
            </button>

            <div className="relative flex min-h-full min-w-0 flex-col p-5 md:p-8">
              <div className="absolute right-5 top-5 flex items-center gap-2 md:right-8 md:top-8">
                {isAdmin && !isHidden && (
                  <button
                    type="button"
                    onClick={hideCoin}
                    disabled={isHidingCoin || isSigningMessage}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-[#7f2219] bg-[#c93d2f] font-heading text-sm text-white shadow-[0px_3px_0px_0px_#7f2219] transition hover:-translate-y-0.5 hover:bg-[#d95042] active:translate-y-0.5 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Hide coin from Gallery"
                    title="Hide coin"
                  >
                    {isHidingCoin || isSigningMessage ? (
                      "..."
                    ) : (
                      <EyeSlashIcon className="h-5 w-5" aria-hidden="true" />
                    )}
                  </button>
                )}
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      setDraftDescription(description);
                      setMessage("");
                      setIsEditOpen(true);
                    }}
                    className="yc-dark-submit-blue rounded-full bg-[#1d9bf0] px-4 py-2 font-heading text-sm text-white shadow-[0px_3px_0px_0px_#0f5f99] transition hover:-translate-y-0.5 hover:bg-[#45adf5] active:translate-y-0.5 active:shadow-none"
                  >
                    Edit
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsDetailsOpen(true)}
                  aria-label="View coin details"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-[#7f2219] bg-[#c93d2f] font-heading text-lg text-white shadow-[0px_3px_0px_0px_#7f2219] transition hover:-translate-y-0.5 hover:bg-[#d95042] active:translate-y-0.5 active:shadow-none"
                >
                  i
                </button>
              </div>
              <div
                className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 ${
                  isAdmin && canEdit ? "pr-40 md:pr-44" : "pr-28"
                }`}
              >
                <h1 className="font-heading text-[38px] leading-none md:text-[56px]">
                  {coin.title}
                </h1>
                <p className="text-sm font-semibold text-[#5f6368] md:text-base">
                  by{" "}
                  <WalletIdentityLink
                    address={coin.ownerAddress}
                    className="underline"
                  />
                </p>
              </div>
              <p className="mt-6 whitespace-pre-line text-base leading-snug md:text-lg">
                {description}
              </p>
              {message && (
                <p className="mt-4 rounded-xl border border-skin-stroke bg-[#fff7bf] p-3 text-sm">
                  {message}
                </p>
              )}
              {isHidden && (
                <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  This coin is hidden from the public Gallery.
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
      <Dialog open={isMediaOpen} onOpenChange={setIsMediaOpen}>
        <DialogContent className="yc-coin-media-dialog max-h-[92vh] max-w-[92vw] border border-skin-stroke bg-black p-4 text-white shadow-[0px_6px_0px_0px_rgb(var(--color-shadow-accent))]">
          <DialogTitle className="sr-only">{coin.title}</DialogTitle>
          <div className="flex max-h-[82vh] min-h-[240px] w-full items-center justify-center overflow-hidden rounded-xl bg-black">
            <CoinMediaPreview
              mediaUrl={coin.mediaUrl}
              imageUrl={coin.imageUrl}
              title={coin.title}
              symbol={coin.symbol}
              className="max-h-[82vh] w-full object-contain"
              fallbackClassName="flex h-[60vh] w-[80vw] items-center justify-center font-heading text-5xl"
              controls
            />
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="yc-coin-info-dialog border border-skin-stroke bg-accent p-6 text-[#212529] shadow-[0px_6px_0px_0px_rgb(var(--color-shadow-accent))]">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl">
              Coin details
            </DialogTitle>
          </DialogHeader>
          <dl className="mt-5 grid gap-3 text-sm">
            <DetailRow label="Coin" value={coin.coinName} />
            <DetailRow
              label="Owner"
              value={coin.ownerAddress}
              href={getExplorerAddressUrl(coin.ownerAddress)}
              mono
            />
            <DetailRow
              label="Contract"
              value={coin.address}
              href={getExplorerAddressUrl(coin.address)}
              mono
            />
            <DetailRow
              label="Payout"
              value={coin.payoutRecipient}
              href={getExplorerAddressUrl(coin.payoutRecipient)}
              mono
            />
          </dl>
          <div className="mt-5 flex flex-wrap gap-3 border-t border-skin-stroke pt-5">
            <ExternalButton href={getZoraCoinUrl(coin.address)}>
              Zora
            </ExternalButton>
            <ExternalButton href={getDexscreenerUrl(coin.address)}>
              Dexscreener
            </ExternalButton>
            <ExternalButton href={getExplorerAddressUrl(coin.address)}>
              Basescan
            </ExternalButton>
          </div>
        </DialogContent>
      </Dialog>
      {canEdit && (
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="yc-coin-edit-dialog border border-skin-stroke bg-accent p-6 text-[#212529] shadow-[0px_6px_0px_0px_rgb(var(--color-shadow-accent))]">
            <DialogHeader>
              <DialogTitle className="font-heading text-2xl">
                Edit description
              </DialogTitle>
            </DialogHeader>
            <div className="mt-5">
              <textarea
                value={draftDescription}
                rows={7}
                onChange={(event) => {
                  setMessage("");
                  setDraftDescription(event.target.value);
                }}
                className="yc-coin-edit-textarea w-full resize-y rounded-xl border border-skin-stroke bg-white px-4 py-3 text-base text-[#212529] placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-[#1d9bf0]"
              />
              <button
                type="button"
                onClick={saveDescription}
                className="yc-dark-submit-blue mt-4 rounded-[18px] bg-[#1d9bf0] px-5 py-3 font-heading text-lg text-white shadow-[0px_4.02px_0px_0px_#0f5f99] transition hover:-translate-y-0.5 hover:bg-[#45adf5] hover:shadow-[0px_6px_0px_0px_#0f5f99] active:translate-y-1 active:shadow-none"
              >
                Save description
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Layout>
  );
}

const DetailRow = ({
  label,
  value,
  href,
  mono,
}: {
  label: string;
  value: string;
  href?: string;
  mono?: boolean;
}) => (
  <div className="yc-coin-info-row min-w-0 rounded-xl border border-skin-stroke bg-[#fff7bf] p-3 text-[#212529]">
    <dt className="font-heading text-sm text-[#5f6368]">{label}</dt>
    <dd
      className={`mt-1 break-words text-sm ${
        mono ? "font-mono" : "font-heading text-lg"
      }`}
    >
      {href ? (
        <Link
          href={href}
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          {value}
        </Link>
      ) : (
        value
      )}
    </dd>
  </div>
);

const ExternalButton = ({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) => (
  <Link
    href={href}
    target="_blank"
    rel="noreferrer"
    className="yc-dark-submit-blue rounded-[18px] bg-[#1d9bf0] px-4 py-3 font-heading text-base text-white shadow-[0px_4.02px_0px_0px_#0f5f99] transition hover:-translate-y-0.5 hover:bg-[#45adf5] active:translate-y-1 active:shadow-none"
  >
    {children}
  </Link>
);
