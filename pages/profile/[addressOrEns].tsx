import Layout from "@/components/Layout";
import CoinMediaPreview from "@/components/coins/CoinMediaPreview";
import {
  buildRandomTraits,
  NounPreviewTile,
  SubmissionGalleryCard,
  type NoundrySubmission,
} from "@/components/noundry/NoundryPreview";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/Dialog";
import {
  areSameWalletAddress,
  normalizeProfileMetadata,
  PROFILE_UPDATE_SIGNED_REQUEST_ACTION,
  shortenWalletAddress,
  validateProfileMetadata,
} from "@/utils/profile/identity";
import { createSignedRequestAuthHeader } from "@/utils/signature-auth-client";
import { TOKEN_NETWORK } from "constants/addresses";
import { getEnsAddress } from "data/ens";
import { normalizeEnsNameInput } from "@/utils/ens";
import {
  getPublicProfileData,
  type PublicProfileData,
  type ProfileMetadata,
} from "data/profile";
import {
  type ProfileRoundSubmission,
  type ProfileRoundVote,
} from "data/rounds";
import {
  getYellowCollectiveArtwork,
  type PlaygroundArtwork,
} from "data/nouns-builder/artwork";
import type { ProbeToken } from "data/nouns-builder/probe";
import type {
  GetServerSidePropsContext,
  GetServerSidePropsResult,
  InferGetServerSidePropsType,
} from "next";
import {
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  TrophyIcon,
  XMarkIcon,
} from "@heroicons/react/20/solid";
import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Jazzicon, { jsNumberForAddress } from "react-jazzicon";
import useSWR from "swr";
import { useAccount, useSignMessage } from "wagmi";
import { getAddress, isAddress, zeroAddress } from "viem";
import { utils as ethersUtils } from "@/utils/ethers-compat";

type ProfilePageProps = {
  profile: PublicProfileData | null;
  artwork: PlaygroundArtwork | null;
  lookup: string;
  error?: string;
};

const MAINNET_ETHERSCAN_URL = "https://etherscan.io";
const BASESCAN_URL = "https://basescan.org";
const PROFILE_SIGNED_REQUEST_CHAIN_ID = Number(TOKEN_NETWORK);
type ActivityStatus = "bid" | "submission" | "vote" | "won";
const PROFILE_BUTTON_BASE =
  "inline-flex items-center justify-center rounded-[18px] px-5 py-3 font-heading transition hover:-translate-y-0.5 active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none";
const PROFILE_BUTTON_BLUE =
  "bg-[#1d9bf0] text-white shadow-[0px_4.02px_0px_0px_#0f5f99] hover:bg-[#45adf5] hover:shadow-[0px_6px_0px_0px_#0f5f99]";
const PROFILE_BUTTON_YELLOW =
  "bg-accent text-skin-base shadow-[0px_4.02px_0px_0px_#b89400] hover:bg-[#ffd84d] hover:shadow-[0px_6px_0px_0px_#b89400]";
const PROFILE_BUTTON_GRAY =
  "bg-[#6b7280] text-white shadow-[0px_4.02px_0px_0px_#3f4652] hover:bg-[#7b8493] hover:shadow-[0px_6px_0px_0px_#3f4652]";
const PROFILE_BUTTON_RED =
  "bg-[#c93d2f] text-white shadow-[0px_4.02px_0px_0px_#7f2219] hover:bg-[#d95042] hover:shadow-[0px_6px_0px_0px_#7f2219]";
const PROFILE_BUTTON_PURPLE =
  "bg-[#855DCD] text-white shadow-[0px_4.02px_0px_0px_#4f3285] hover:bg-[#9b75df] hover:shadow-[0px_6px_0px_0px_#4f3285]";
const EMPTY_NOUN_PIXELS = Array.from({ length: 32 * 32 }, () => "transparent");
type ProfileFeedItem = {
  id: string;
  href: string;
  title: string;
  meta?: string;
  comment?: string;
  badge?: string;
  timestamp?: string;
  status: ActivityStatus;
  imageUrl?: string;
  isProposal?: boolean;
  voteTone?: "for" | "against";
};

const toSerializableProfile = (profile: PublicProfileData) =>
  JSON.parse(JSON.stringify(profile)) as PublicProfileData;

const getNumericTokenId = (tokenId: string | number) => {
  const numericId = Number(tokenId);
  return Number.isFinite(numericId) ? numericId : Number.MAX_SAFE_INTEGER;
};

const getFirstOwnedCollectiveNounAvatar = (profile: PublicProfileData) => {
  const firstAuctionWin = [...profile.auctionWins]
    .filter((win) => win.tokenImage)
    .sort((first, second) => {
      const firstTime = first.createdAt
        ? new Date(first.createdAt).getTime()
        : Number.NaN;
      const secondTime = second.createdAt
        ? new Date(second.createdAt).getTime()
        : Number.NaN;

      if (Number.isFinite(firstTime) && Number.isFinite(secondTime)) {
        return firstTime - secondTime;
      }

      return getNumericTokenId(first.tokenId) - getNumericTokenId(second.tokenId);
    })[0];

  if (firstAuctionWin?.tokenImage) return firstAuctionWin.tokenImage;

  return (
    [...profile.ownedTokens]
      .filter((token) => token.image)
      .sort((first, second) => first.id - second.id)[0]?.image || ""
  );
};

const fetcher = async (url: string) => {
  const response = await fetch(url);
  const data = await response.json();

  if (!response.ok) throw new Error(data.error || "Unable to load data.");
  return data;
};

export const getServerSideProps = async ({
  params,
}: GetServerSidePropsContext): Promise<
  GetServerSidePropsResult<ProfilePageProps>
> => {
  const lookup =
    typeof params?.addressOrEns === "string" ? params.addressOrEns.trim() : "";
  const normalizedEnsName = normalizeEnsNameInput(lookup);

  if (!lookup) {
    return {
      props: {
        lookup,
        artwork: null,
        profile: null,
        error: "Enter a wallet address or ENS name to view a profile.",
      },
    };
  }

  const resolvedAddress = isAddress(lookup)
    ? getAddress(lookup)
    : normalizedEnsName
      ? (await getEnsAddress({ ensName: normalizedEnsName })).address
      : undefined;

  if (!resolvedAddress) {
    return {
      props: {
        lookup,
        artwork: null,
        profile: null,
        error: normalizedEnsName
          ? "That ENS name did not resolve to a wallet address."
          : "That profile identifier is not a valid wallet address or ENS name.",
      },
    };
  }

  if (lookup !== resolvedAddress) {
    return {
      redirect: {
        destination: `/profile/${encodeURIComponent(resolvedAddress)}`,
        permanent: false,
      },
    };
  }

  try {
    const [profileData, artwork] = await Promise.all([
      getPublicProfileData(resolvedAddress),
      getYellowCollectiveArtwork().catch((artworkError) => {
        console.error("Unable to load profile fallback artwork", artworkError);
        return null;
      }),
    ]);

    return {
      props: {
        lookup,
        artwork,
        profile: toSerializableProfile(profileData),
      },
    };
  } catch (error) {
    console.error("Unable to load profile", error);
    return {
      props: {
        lookup,
        artwork: null,
        profile: null,
        error: "Unable to load this profile right now.",
      },
    };
  }
};

export default function ProfilePage({
  profile,
  artwork: initialArtwork,
  lookup,
  error,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const { address: connectedAddress, isConnected } = useAccount();
  const { signMessageAsync, isLoading: isSigning } = useSignMessage();
  const [metadata, setMetadata] = useState<ProfileMetadata | null>(
    profile?.metadata || null
  );
  const [isEditing, setIsEditing] = useState(false);
  const [formState, setFormState] = useState({
    username: profile?.metadata?.username || "",
    websiteUrl: profile?.metadata?.websiteUrl || "",
    farcaster: profile?.metadata?.farcaster || "",
    twitter: profile?.metadata?.twitter || "",
    avatarUrl: profile?.metadata?.avatarUrl || "",
  });
  const [saveState, setSaveState] = useState<{
    status: "idle" | "saving" | "success" | "error";
    message: string;
  }>({ status: "idle", message: "" });
  const { data: artwork } = useSWR<PlaygroundArtwork>(
    profile ? "/api/playground/artwork" : null,
    fetcher,
    { fallbackData: initialArtwork || undefined }
  );
  const { data: roundsSettings } = useSWR<{ roundsPublicEnabled: boolean }>(
    "/api/rounds/settings",
    fetcher
  );
  const { data: gallerySettings } = useSWR<{ galleryPublicEnabled: boolean }>(
    "/api/gallery/settings",
    fetcher
  );
  const showRoundsActivity = roundsSettings?.roundsPublicEnabled === true;
  const showContentCoins = gallerySettings?.galleryPublicEnabled === true;

  const isOwnProfile = areSameWalletAddress(connectedAddress, profile?.address);
  const stats = useMemo(() => {
    if (!profile) return [];

    return [
      ["Noundry", profile.noundrySubmissions.length],
      ...(showContentCoins
        ? ([["Content coins", profile.contentCoins.length]] as const)
        : []),
      ...(showRoundsActivity
        ? ([["Round submissions", profile.roundSubmissions.length]] as const)
        : []),
      ["DAO tokens", profile.ownedTokens.length],
      ["Proposals", profile.submittedProposals.length],
      [
        "Votes",
        profile.daoVotes.length +
          (showRoundsActivity ? profile.roundVotes.length : 0),
      ],
    ] as const;
  }, [profile, showContentCoins, showRoundsActivity]);
  const profileStatsGridStyle = {
    "--profile-stat-count": stats.length,
  } as CSSProperties & Record<"--profile-stat-count", number>;

  const saveProfile = async () => {
    if (!profile || !connectedAddress || !isOwnProfile) return;

    const validationError = validateProfileMetadata(formState);
    if (validationError) {
      setSaveState({ status: "error", message: validationError });
      return;
    }

    setSaveState({ status: "saving", message: "Saving profile..." });

    try {
      const path = `/api/profile/${profile.address}`;
      const payload = { profile: formState };
      const authorization = await createSignedRequestAuthHeader({
        walletAddress: connectedAddress,
        chainId: PROFILE_SIGNED_REQUEST_CHAIN_ID,
        action: PROFILE_UPDATE_SIGNED_REQUEST_ACTION,
        method: "PUT",
        path,
        payload,
        signMessageAsync,
      });
      const response = await fetch(path, {
        method: "PUT",
        headers: {
          Authorization: authorization,
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to save profile.");
      }

      setMetadata(result.profile);
      setFormState(normalizeProfileMetadata(result.profile));
      setSaveState({ status: "success", message: "Profile saved." });
      setIsEditing(false);
    } catch (saveError) {
      setSaveState({
        status: "error",
        message:
          saveError instanceof Error
            ? saveError.message
            : "Unable to save profile.",
      });
    }
  };

  if (!profile) {
    return (
      <Layout>
        <Head>
          <title>Profile not found | Yellow Collective</title>
        </Head>
        <div className="mx-auto max-w-[860px] rounded-2xl border border-skin-stroke bg-white p-8 text-center shadow-sm">
          <h1 className="font-heading text-4xl leading-none">
            Profile not found
          </h1>
          <p className="mt-3 text-secondary">{error || lookup}</p>
        </div>
      </Layout>
    );
  }

  const customDisplayName = metadata?.username?.trim() || "";
  const displayName =
    customDisplayName ||
    profile.ensName ||
    shortenWalletAddress(profile.address);
  const showEnsPill = Boolean(customDisplayName && profile.ensName);
  const avatarUrl = metadata?.avatarUrl || profile.ensAvatar || "";
  const profileFallbackAvatarUrl = getFirstOwnedCollectiveNounAvatar(profile);
  const explorerLinks = [
    ["Etherscan", `${MAINNET_ETHERSCAN_URL}/address/${profile.address}`],
    ["Basescan", `${BASESCAN_URL}/address/${profile.address}`],
  ] as const;
  const socialLinks = [
    metadata?.websiteUrl
      ? {
          label: "Website",
          href: metadata.websiteUrl,
          icon: "/chain-link.svg",
          className: PROFILE_BUTTON_RED,
        }
      : undefined,
    metadata?.farcaster
      ? {
          label: "Farcaster",
          href: metadata.farcaster,
          icon: "/farcaster.svg",
          className: PROFILE_BUTTON_PURPLE,
        }
      : undefined,
    metadata?.twitter
      ? {
          label: "X",
          href: metadata.twitter,
          icon: "/x.svg",
          className: PROFILE_BUTTON_BLUE,
        }
      : undefined,
  ].filter(
    (
      link
    ): link is {
      label: string;
      href: string;
      icon: string;
      className: string;
    } => Boolean(link)
  );

  return (
    <Layout>
      <Head>
        <title>{displayName} | Yellow Collective Profile</title>
      </Head>

      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-7 pb-12">
        <section className="yc-dark-surface overflow-hidden rounded-2xl border border-skin-stroke bg-white">
          <div className="grid gap-0">
            <div className="flex flex-col gap-6 p-5 sm:p-6 md:p-8">
              <div className="flex flex-row items-start gap-4 sm:gap-5">
                <ProfileAvatar
                  address={profile.address}
                  avatar={avatarUrl}
                  fallbackAvatar={profileFallbackAvatarUrl}
                  label={displayName}
                  artwork={artwork}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <h1 className="break-words font-heading text-[30px] leading-none min-[360px]:text-[34px] md:text-5xl">
                          {displayName}
                        </h1>
                        {socialLinks.map(({ label, href, icon, className }) => (
                          <a
                            key={label}
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={label}
                            title={label}
                            className={`flex h-11 min-w-11 items-center justify-center gap-2 rounded-xl px-4 font-heading text-sm transition hover:-translate-y-0.5 active:translate-y-1 active:shadow-none ${className}`}
                          >
                            <Image
                              src={icon}
                              width={20}
                              height={20}
                              alt=""
                              className="brightness-0 invert"
                            />
                            <span>{label}</span>
                          </a>
                        ))}
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-secondary">
                        {showEnsPill && (
                          <span className="yc-profile-ens-pill rounded-full bg-[#fff7bf] px-3 py-1 font-heading text-sm text-skin-base">
                            {profile.ensName}
                          </span>
                        )}
                        <span className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="break-all font-heading text-xs text-secondary min-[360px]:text-sm sm:text-base">
                            {profile.address}
                          </span>
                          {explorerLinks.map(([label, href]) => (
                            <a
                              key={label}
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-heading text-sm text-skin-base underline underline-offset-4 transition hover:text-[#b89400]"
                            >
                              {label}
                            </a>
                          ))}
                        </span>
                      </div>
                    </div>
                    {isOwnProfile && (
                      <button
                        type="button"
                        onClick={() => {
                          setFormState({
                            username: metadata?.username || "",
                            websiteUrl: metadata?.websiteUrl || "",
                            farcaster: metadata?.farcaster || "",
                            twitter: metadata?.twitter || "",
                            avatarUrl: metadata?.avatarUrl || "",
                          });
                          setSaveState({ status: "idle", message: "" });
                          setIsEditing(true);
                        }}
                        className={`yc-dark-yellow-button ${PROFILE_BUTTON_BASE} ${PROFILE_BUTTON_YELLOW}`}
                      >
                        Edit Profile
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {Object.keys(profile.errors).length > 0 && (
                <div className="rounded-xl border border-[#f3c343] bg-[#fff7bf] p-4 text-sm text-secondary">
                  Some profile sections could not be loaded. The available
                  activity is still shown below.
                </div>
              )}
            </div>

            <div
              className="grid grid-cols-2 border-t border-skin-stroke bg-[#f7f7f7] sm:grid-cols-3 lg:grid-cols-[repeat(var(--profile-stat-count),minmax(0,1fr))]"
              style={profileStatsGridStyle}
            >
              {stats.map(([label, value]) => (
                <div
                  key={label}
                  className="min-w-0 border-skin-stroke px-1.5 py-3 text-center sm:border-r sm:p-5 last:sm:border-r-0"
                >
                  <div className="font-heading text-2xl leading-none text-skin-base min-[360px]:text-3xl sm:text-4xl">
                    {value}
                  </div>
                  <div className="mt-1 whitespace-nowrap text-[9px] leading-tight text-secondary min-[360px]:text-[10px] sm:text-sm">
                    {label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <CommunityProjectsSection projects={profile.communityProjects} />
        {showContentCoins && (
          <ContentCoinsSection coins={profile.contentCoins} />
        )}
        <GalleryTab
          artwork={artwork}
          submissions={profile.noundrySubmissions}
          showRoundSubmissionActions={isConnected && isOwnProfile}
        />
        <DaoActivityFeed
          proposals={profile.submittedProposals}
          votes={profile.daoVotes}
          auctionBids={profile.auctionBids}
          auctionWins={profile.auctionWins}
        />
        {showRoundsActivity && (
          <RoundsActivityFeed
            submissions={profile.roundSubmissions}
            votes={profile.roundVotes}
          />
        )}
        <OwnedTokensSection tokens={profile.ownedTokens} />
      </div>

      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="yc-dark-yellow-surface max-h-[90vh] max-w-[620px] overflow-y-auto border-skin-stroke bg-white p-0 text-skin-base">
          <DialogHeader className="border-b border-skin-stroke p-6 pr-16">
            <DialogTitle className="font-heading text-3xl leading-none">
              Edit profile
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 p-6">
            <ProfileAvatarUpload
              address={profile.address}
              value={formState.avatarUrl}
              fallbackAvatar={
                profile.ensAvatar || getFirstOwnedCollectiveNounAvatar(profile)
              }
              label={displayName}
              artwork={artwork}
              onChange={(avatarUrl) =>
                setFormState((current) => ({ ...current, avatarUrl }))
              }
              onError={(message) => setSaveState({ status: "error", message })}
            />
            <ProfileField
              label="Username"
              value={formState.username}
              onChange={(value) =>
                setFormState((current) => ({ ...current, username: value }))
              }
              placeholder="yellowartist"
            />
            <ProfileField
              label="Website"
              value={formState.websiteUrl}
              onChange={(value) =>
                setFormState((current) => ({ ...current, websiteUrl: value }))
              }
              placeholder="https://your-site.xyz"
            />
            <ProfileField
              label="Farcaster"
              value={formState.farcaster}
              onChange={(value) =>
                setFormState((current) => ({ ...current, farcaster: value }))
              }
              placeholder="@handle or Warpcast URL"
            />
            <ProfileField
              label="Twitter/X"
              value={formState.twitter}
              onChange={(value) =>
                setFormState((current) => ({ ...current, twitter: value }))
              }
              placeholder="@handle or X URL"
            />
            {saveState.message && (
              <p
                className={`rounded-xl border p-3 text-sm ${
                  saveState.status === "error"
                    ? "border-[#c93d2f] bg-[#fff1ef] text-[#c93d2f]"
                    : "border-skin-stroke bg-skin-muted text-secondary"
                }`}
              >
                {saveState.message}
              </p>
            )}
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className={`${PROFILE_BUTTON_BASE} ${PROFILE_BUTTON_GRAY}`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveProfile}
                disabled={
                  !isConnected ||
                  !isOwnProfile ||
                  isSigning ||
                  saveState.status === "saving"
                }
                className={`${PROFILE_BUTTON_BASE} ${PROFILE_BUTTON_BLUE}`}
              >
                {isSigning || saveState.status === "saving"
                  ? "Saving..."
                  : "Save"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

const ProfileAvatar = ({
  address,
  avatar,
  fallbackAvatar,
  label,
  artwork,
}: {
  address: string;
  avatar?: string;
  fallbackAvatar?: string;
  label: string;
  artwork?: PlaygroundArtwork;
}) => {
  const normalizedAddress = address || zeroAddress;
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [fallbackAvatarFailed, setFallbackAvatarFailed] = useState(false);
  const [randomFallbackSeed, setRandomFallbackSeed] = useState(
    normalizedAddress.toLowerCase()
  );
  const visibleAvatar =
    !avatarFailed && avatar
      ? avatar
      : !fallbackAvatarFailed && fallbackAvatar
        ? fallbackAvatar
        : "";

  useEffect(() => {
    setAvatarFailed(false);
    setFallbackAvatarFailed(false);
  }, [avatar, fallbackAvatar]);

  useEffect(() => {
    if (visibleAvatar) return;

    setRandomFallbackSeed(
      `${normalizedAddress.toLowerCase()}-${Date.now()}-${Math.random()}`
    );
  }, [normalizedAddress, visibleAvatar]);

  const fallbackTraits = useMemo(
    () =>
      artwork
        ? buildRandomTraits(artwork, randomFallbackSeed)
        : {},
    [artwork, randomFallbackSeed]
  );
  const fallbackSubmission = useMemo<NoundrySubmission>(
    () => ({
      id: `profile-${normalizedAddress}`,
      title: `${label} profile noun`,
      artist: normalizedAddress,
      traitType: "heads",
      pixels: EMPTY_NOUN_PIXELS,
      selectedTraits: fallbackTraits,
      previewTraits: fallbackTraits,
      status: "approved",
      createdAt: "",
      updatedAt: "",
    }),
    [fallbackTraits, label, normalizedAddress]
  );

  return (
    <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-skin-stroke bg-[#ffcc00] shadow-[0px_5px_0px_0px_#b89400] sm:h-28 sm:w-28">
      {visibleAvatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={visibleAvatar}
          alt={label}
          className="h-full w-full object-cover"
          onError={() => {
            if (visibleAvatar === avatar) {
              setAvatarFailed(true);
              return;
            }

            setFallbackAvatarFailed(true);
          }}
        />
      ) : artwork ? (
        <NounPreviewTile
          artwork={artwork}
          submission={fallbackSubmission}
          traits={fallbackTraits}
          showEditedTrait={false}
        />
      ) : (
        <Jazzicon diameter={72} seed={jsNumberForAddress(normalizedAddress)} />
      )}
    </div>
  );
};

const resizeAvatarFile = (file: File) =>
  new Promise<string>((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Choose an image file."));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      reject(new Error("Choose an image smaller than 5MB."));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const image = document.createElement("img");
      image.onload = () => {
        const canvas = document.createElement("canvas");
        const size = 320;
        const scale = Math.max(size / image.width, size / image.height);
        const width = image.width * scale;
        const height = image.height * scale;
        const left = (size - width) / 2;
        const top = (size - height) / 2;

        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Unable to process image."));
          return;
        }

        context.fillStyle = "#ffcc00";
        context.fillRect(0, 0, size, size);
        context.drawImage(image, left, top, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.86));
      };
      image.onerror = () => reject(new Error("Unable to read image."));
      image.src = String(reader.result || "");
    };
    reader.onerror = () => reject(new Error("Unable to read image."));
    reader.readAsDataURL(file);
  });

const ProfileAvatarUpload = ({
  address,
  value,
  fallbackAvatar,
  label,
  artwork,
  onChange,
  onError,
}: {
  address: string;
  value: string;
  fallbackAvatar?: string;
  label: string;
  artwork?: PlaygroundArtwork;
  onChange: (value: string) => void;
  onError: (message: string) => void;
}) => {
  const previewAvatar = value || fallbackAvatar || "";

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      onChange(await resizeAvatarFile(file));
    } catch (error) {
      onError(
        error instanceof Error ? error.message : "Unable to upload image."
      );
    } finally {
      event.target.value = "";
    }
  };

  return (
    <div className="rounded-2xl border border-skin-stroke bg-skin-muted p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <ProfileAvatar
          address={address}
          avatar={previewAvatar}
          label={label}
          artwork={artwork}
        />
        <div className="flex flex-1 flex-col gap-3">
          <div>
            <div className="font-heading text-lg leading-none">
              Profile picture
            </div>
            <p className="mt-1 text-sm text-secondary">
              Uses your ENS photo when available. Otherwise, this falls back to
              a wallet-generated Collective Noun.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <label
              className={`w-fit cursor-pointer text-lg ${PROFILE_BUTTON_BASE} ${PROFILE_BUTTON_BLUE}`}
            >
              Upload image
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={handleFileChange}
              />
            </label>
            {value && (
              <button
                type="button"
                onClick={() => onChange("")}
                className={`text-lg ${PROFILE_BUTTON_BASE} ${PROFILE_BUTTON_YELLOW}`}
              >
                Use ENS default
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const GalleryTab = ({
  artwork,
  submissions,
  showRoundSubmissionActions,
}: {
  artwork?: PlaygroundArtwork;
  submissions: NoundrySubmission[];
  showRoundSubmissionActions: boolean;
}) => (
  <ProfileSection
    title="Noundry Gallery"
    emptyTitle="No gallery submissions yet"
    emptyBody="When this wallet submits traits to the Noundry Gallery, they will appear here."
    isEmpty={submissions.length === 0}
  >
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8">
      {submissions.map((submission) => (
        <SubmissionGalleryCard
          key={submission.id}
          submission={submission}
          artwork={artwork}
          compact
          showArtist={false}
          profileTone
          showRoundSubmissionAction={showRoundSubmissionActions}
        />
      ))}
    </div>
  </ProfileSection>
);

const CommunityProjectsSection = ({
  projects,
}: {
  projects: PublicProfileData["communityProjects"];
}) => (
  <ProfileSection
    title="Projects"
    emptyTitle="No associated projects yet"
    emptyBody="Projects linked to this member will appear here."
    isEmpty={projects.length === 0}
  >
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <Link
          key={project.slug}
          href={`/projects/${project.slug}`}
          className="group overflow-hidden rounded-2xl border border-skin-stroke bg-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#fff7bf]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={project.image}
            alt={project.title}
            className="aspect-square w-full bg-skin-muted object-cover transition duration-200 group-hover:scale-[1.02]"
          />
          <div className="border-t border-skin-stroke p-4">
            <div className="caption font-semibold text-secondary">
              {project.category} / {project.date}
            </div>
            <h3 className="mt-2 font-heading text-xl leading-tight text-skin-base">
              {project.title}
            </h3>
            <p className="mt-2 line-clamp-3 text-sm leading-5 text-secondary">
              {project.description}
            </p>
          </div>
        </Link>
      ))}
    </div>
  </ProfileSection>
);

const ContentCoinsSection = ({
  coins,
}: {
  coins: PublicProfileData["contentCoins"];
}) => (
  <ProfileSection
    title="$YELLOW Posts"
    emptyTitle="No Content Posts yet"
    emptyBody="Content posts owned by this wallet will appear here."
    isEmpty={coins.length === 0}
  >
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {coins.map((coin) => (
        <Link
          key={coin.address}
          href={`/coins/${coin.address}`}
          className="group overflow-hidden rounded-2xl border border-skin-stroke bg-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#fff7bf]"
        >
          <div className="aspect-square w-full bg-[#ffcc00]">
            <CoinMediaPreview
              mediaUrl={coin.mediaUrl}
              imageUrl={coin.imageUrl}
              title={coin.title}
              symbol={coin.symbol}
              className="h-full w-full object-cover"
              fallbackClassName="flex h-full w-full items-center justify-center bg-[#ffcc00] p-4 text-center font-heading text-3xl text-skin-base"
              hoverScale
            />
          </div>
          <div className="border-t border-skin-stroke p-4">
            <div className="caption font-semibold text-secondary">
              {coin.symbol}
            </div>
            <h3 className="mt-2 font-heading text-xl leading-tight text-skin-base">
              {coin.title}
            </h3>
            <p className="mt-2 line-clamp-3 text-sm leading-5 text-secondary">
              {coin.description}
            </p>
          </div>
        </Link>
      ))}
    </div>
  </ProfileSection>
);

const RoundsActivityFeed = ({
  submissions,
  votes,
}: {
  submissions: ProfileRoundSubmission[];
  votes: ProfileRoundVote[];
}) => {
  const activity: ProfileFeedItem[] = [
    ...submissions.map((submission) => ({
      id: `round-submission-${submission.id}`,
      href: `/rounds/${submission.roundSlug}`,
      title: submission.title,
      meta: `Submitted to ${submission.roundTitle}`,
      badge: `${submission.voteCount} votes`,
      status: "submission" as const,
      timestamp: submission.createdAt,
    })),
    ...votes.map((vote) => ({
      id: `round-vote-${vote.id}`,
      href: `/rounds/${vote.roundSlug}`,
      title: vote.submissionTitle,
      meta: `Voted in ${vote.roundTitle}`,
      badge: `${vote.voteCount} votes`,
      status: "vote" as const,
      timestamp: vote.updatedAt || vote.createdAt,
    })),
  ].sort(sortNewestActivity);

  return (
    <ProfileSection
      title="Rounds activity"
      emptyTitle="No rounds activity yet"
      emptyBody="Round submissions and votes from this wallet will appear here."
      isEmpty={activity.length === 0}
    >
      <ActivityFeedList>
        {activity.map((item) => (
          <ProfileListLink
            key={item.id}
            href={item.href}
            title={item.title}
            meta={item.meta}
            badge={item.badge}
            status={item.status}
          />
        ))}
      </ActivityFeedList>
    </ProfileSection>
  );
};

const OwnedTokensSection = ({ tokens }: { tokens: ProbeToken[] }) => (
  <ProfileSection
    title="Owned Collective Nouns"
    emptyTitle="No DAO tokens owned"
    emptyBody="Collective Nouns owned by this wallet will appear here."
    isEmpty={tokens.length === 0}
  >
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8">
      {tokens.map((token) => (
        <Link
          key={token.id}
          href={`/?tokenid=${token.id}`}
          className="overflow-hidden rounded-xl border border-skin-stroke bg-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#fff7bf]"
        >
          {token.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={token.image}
              alt={token.name}
              className="aspect-square w-full bg-[#ffcc00] object-cover"
            />
          ) : (
            <div className="aspect-square bg-[#ffcc00]" />
          )}
          <div className="p-2 font-heading text-sm leading-tight sm:p-3">
            {token.name}
          </div>
        </Link>
      ))}
    </div>
  </ProfileSection>
);

const DaoActivityFeed = ({
  proposals,
  votes,
  auctionBids,
  auctionWins,
}: {
  proposals: PublicProfileData["submittedProposals"];
  votes: PublicProfileData["daoVotes"];
  auctionBids: PublicProfileData["auctionBids"];
  auctionWins: PublicProfileData["auctionWins"];
}) => {
  const activity: ProfileFeedItem[] = [
    ...proposals.map((proposal) => ({
      id: `proposal-${proposal.proposalId}`,
      href: `/proposals/${proposal.proposalNumber}`,
      title: `Proposal: ${proposal.title}`,
      meta: "Proposal submitted",
      badge: getProposalStateLabel(proposal.state),
      status: "submission" as const,
      isProposal: true,
      timestamp: proposal.timeCreated
        ? new Date(proposal.timeCreated * 1000).toISOString()
        : undefined,
    })),
    ...votes.map((vote) => ({
      voteTone: getVoteTone(vote.support),
      id: `proposal-vote-${vote.proposalId}-${vote.support}`,
      href: `/proposals/${vote.proposalNumber}`,
      title: `Proposal: ${vote.proposalTitle}`,
      meta: `Voted ${supportText(vote.support)}`,
      badge: `${vote.weight} votes`,
      status: getVoteStatus(vote.support),
      isProposal: true,
      timestamp: vote.timestamp,
    })),
    ...auctionBids.map((bid) => ({
      id: bid.id,
      href: `/?tokenid=${bid.tokenId}`,
      title: bid.tokenName,
      meta: "Bid placed",
      comment: bid.comment,
      badge: formatEthAmount(bid.amount),
      status: "bid" as const,
      imageUrl: bid.tokenImage,
      timestamp: bid.createdAt,
    })),
    ...auctionWins.map((win) => ({
      id: win.id,
      href: `/?tokenid=${win.tokenId}`,
      title: win.tokenName,
      meta: "Auction won",
      badge: formatEthAmount(win.amount),
      status: "won" as const,
      imageUrl: win.tokenImage,
      timestamp: win.createdAt,
    })),
  ].sort(sortNewestActivity);

  return (
    <ProfileSection
      title="DAO activity"
      emptyTitle="No DAO activity found"
      emptyBody="Proposal submissions, proposal votes, auction bids, and auction wins will appear here."
      isEmpty={activity.length === 0}
    >
      <ActivityFeedList>
        {activity.map((item) => (
          <ProfileListLink
            key={item.id}
            href={item.href}
            title={item.title}
            meta={item.meta}
            comment={item.comment}
            badge={item.badge}
            imageUrl={item.imageUrl}
            status={item.status}
            isProposal={item.isProposal}
            voteTone={item.voteTone}
          />
        ))}
      </ActivityFeedList>
    </ProfileSection>
  );
};

const ActivityFeedList = ({ children }: { children: React.ReactNode }) => (
  <div className="max-h-[500px] overflow-y-auto pr-2">
    <div className="flex flex-col gap-3">{children}</div>
  </div>
);

const ProfileSection = ({
  title,
  emptyTitle,
  emptyBody,
  isEmpty,
  children,
}: {
  title: string;
  emptyTitle: string;
  emptyBody: string;
  isEmpty: boolean;
  children: React.ReactNode;
}) => (
  <section className="yc-dark-surface rounded-2xl border border-skin-stroke bg-white p-5 shadow-sm md:p-6">
    <h2 className="font-heading text-3xl leading-none">{title}</h2>
    <div className="mt-5">
      {isEmpty ? (
        <div className="rounded-2xl border border-dashed border-skin-stroke bg-skin-muted p-8 text-center">
          <h3 className="font-heading text-2xl leading-none">{emptyTitle}</h3>
          <p className="mx-auto mt-2 max-w-[520px] text-secondary">
            {emptyBody}
          </p>
        </div>
      ) : (
        children
      )}
    </div>
  </section>
);

const ProfileListLink = ({
  href,
  title,
  meta,
  comment,
  badge,
  imageUrl,
  status,
  isProposal = false,
  voteTone,
}: {
  href: string;
  title: string;
  meta?: string;
  comment?: string;
  badge?: string;
  imageUrl?: string;
  status: ActivityStatus;
  isProposal?: boolean;
  voteTone?: "for" | "against";
}) => (
  <Link
    href={href}
    className={`flex min-h-[76px] flex-col gap-3 rounded-2xl border bg-skin-muted p-3 transition hover:-translate-y-0.5 hover:bg-[#fff7bf] sm:flex-row sm:items-center sm:justify-between sm:p-4 ${getActivityBorderClass(voteTone)}`}
  >
    <div className="flex min-w-0 items-center gap-3">
      <ActivityStatusButton status={status} voteTone={voteTone} />
      {imageUrl && (
        <span className="block h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-skin-stroke bg-[#ffcc00]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="" className="h-full w-full object-cover" />
        </span>
      )}
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2 break-words font-heading text-xl leading-none text-skin-base">
          <span>{title}</span>
          {isProposal && (
            <ArrowTopRightOnSquareIcon className="h-4 w-4 shrink-0 text-secondary" />
          )}
        </div>
        {meta && <div className="mt-1 text-sm text-secondary">{meta}</div>}
        {comment && (
          <p className="mt-2 line-clamp-3 text-sm leading-5 text-secondary">
            &ldquo;{comment}&rdquo;
          </p>
        )}
      </div>
    </div>
    {badge && (
      <span className="w-fit shrink-0 rounded-full bg-white px-3 py-1 font-heading text-sm text-skin-base">
        {badge}
      </span>
    )}
  </Link>
);

const ActivityStatusButton = ({
  status,
  voteTone,
}: {
  status: ActivityStatus;
  voteTone?: "for" | "against";
}) => {
  const statusConfig = {
    bid: {
      label: "Bid",
      className: "bg-[#1d9bf0] text-white shadow-[0px_4px_0px_0px_#0f5f99]",
      Icon: CurrencyDollarIcon,
    },
    submission: {
      label: "Submitted",
      className: "bg-[#ffcc00] text-skin-base shadow-[0px_4px_0px_0px_#b89400]",
      Icon: DocumentTextIcon,
    },
    vote: {
      label: voteTone === "against" ? "Against" : "For",
      className:
        voteTone === "against"
          ? "bg-skin-proposal-danger text-white shadow-[0px_4px_0px_0px_#a52824]"
          : "bg-skin-proposal-success text-white shadow-[0px_4px_0px_0px_#0d8f49]",
      Icon: voteTone === "against" ? XMarkIcon : CheckCircleIcon,
    },
    won: {
      label: "Won",
      className: "bg-[#ffcc00] text-skin-base shadow-[0px_4px_0px_0px_#b89400]",
      Icon: TrophyIcon,
    },
  }[status];
  const Icon = statusConfig.Icon;

  return (
    <span
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-0 ${statusConfig.className}`}
      aria-label={statusConfig.label}
      title={statusConfig.label}
    >
      <Icon className="h-5 w-5" />
    </span>
  );
};

const ProfileField = ({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) => (
  <label className="flex flex-col gap-2">
    <span className="font-heading text-lg leading-none">{label}</span>
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="rounded-2xl border border-skin-stroke bg-skin-muted px-4 py-3 text-base outline-none transition focus:border-skin-base focus:bg-white"
    />
  </label>
);

const supportText = (support: number) => {
  if (support === 0) return "Against";
  if (support === 1) return "For";
  return "Abstain";
};

const getVoteTone = (support: number) => {
  if (support === 0) return "against" as const;
  if (support === 1) return "for" as const;
  return undefined;
};

const getVoteStatus = (_support: number): ActivityStatus => "vote";

const getProposalStateLabel = (state: number) => {
  switch (state) {
    case 0:
      return "Pending";
    case 1:
      return "Active";
    case 2:
      return "Canceled";
    case 3:
      return "Defeated";
    case 4:
      return "Succeeded";
    case 5:
      return "Queued";
    case 6:
      return "Expired";
    case 7:
      return "Executed";
    case 8:
      return "Vetoed";
    default:
      return "Unknown";
  }
};

const getActivityBorderClass = (voteTone?: "for" | "against") => {
  if (voteTone === "against") return "border-skin-proposal-danger";
  if (voteTone === "for") return "border-skin-proposal-success";
  return "border-skin-stroke";
};

const getActivityTime = (timestamp?: string) =>
  timestamp ? new Date(timestamp).getTime() || 0 : 0;

const sortNewestActivity = <T extends { timestamp?: string }>(
  first: T,
  second: T
) => getActivityTime(second.timestamp) - getActivityTime(first.timestamp);

const formatEthAmount = (value: string) => {
  try {
    const formatted = Number(ethersUtils.formatEther(value || "0"));
    if (!Number.isFinite(formatted)) return "0 ETH";

    return `${formatted.toLocaleString("en-US", {
      maximumFractionDigits: 4,
    })} ETH`;
  } catch {
    return "0 ETH";
  }
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};
