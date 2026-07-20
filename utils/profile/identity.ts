import { getAddress, isAddress } from "viem";

export type ProfileMetadataInput = {
  username?: string;
  websiteUrl?: string;
  farcaster?: string;
  twitter?: string;
  avatarUrl?: string;
};

export type NormalizedProfileMetadata = {
  username: string;
  websiteUrl: string;
  farcaster: string;
  twitter: string;
  avatarUrl: string;
};

const USERNAME_MAX_LENGTH = 40;
const SOCIAL_MAX_LENGTH = 120;
const AVATAR_DATA_URL_MAX_LENGTH = 750_000;
const USERNAME_PATTERN = /^[a-zA-Z0-9_.-]+$/;
const FARCASTER_HANDLE_PATTERN = /^@?[a-zA-Z0-9_.-]{1,64}$/;
const TWITTER_HANDLE_PATTERN = /^@?[a-zA-Z0-9_]{1,50}$/;
const AVATAR_DATA_URL_PATTERN =
  /^data:image\/(?:png|jpeg|jpg|webp);base64,[a-zA-Z0-9+/=]+$/;

export const PROFILE_UPDATE_SIGNED_REQUEST_ACTION = "profile:update";

export const normalizeWalletAddress = (value?: string | null) => {
  if (!value || !isAddress(value)) return undefined;
  return getAddress(value);
};

export const areSameWalletAddress = (
  first?: string | null,
  second?: string | null
) => {
  const normalizedFirst = normalizeWalletAddress(first);
  const normalizedSecond = normalizeWalletAddress(second);

  return Boolean(
    normalizedFirst &&
    normalizedSecond &&
    normalizedFirst.toLowerCase() === normalizedSecond.toLowerCase()
  );
};

export const shortenWalletAddress = (address: string, amount = 4) => {
  const normalizedAddress = normalizeWalletAddress(address) || address;
  return normalizedAddress.length > amount * 2 + 3
    ? `${normalizedAddress.slice(0, amount + 2)}...${normalizedAddress.slice(
        -amount
      )}`
    : normalizedAddress;
};

export const getProfilePath = ({
  address,
}: {
  address: string;
  ensName?: string | null;
}) => {
  const profileId = normalizeWalletAddress(address) || address;
  return `/profile/${encodeURIComponent(profileId)}`;
};

export const selectProfileAvatarUrl = (
  uploadedAvatarUrl?: string | null,
  collectiveNounImageUrl?: string | null
) => uploadedAvatarUrl?.trim() || collectiveNounImageUrl?.trim() || "";

const normalizeUrl = (value?: string) => {
  const trimmed = value?.trim();
  if (!trimmed) return "";

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const url = new URL(withProtocol);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
};

export const normalizeFarcaster = (value?: string) => {
  const trimmed = value?.trim();
  if (!trimmed) return "";

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      if (
        ["warpcast.com", "www.warpcast.com"].includes(url.hostname) &&
        url.pathname.length > 1
      ) {
        return `https://warpcast.com/${url.pathname.split("/").filter(Boolean)[0]}`;
      }
    } catch {
      return "";
    }
  }

  if (!FARCASTER_HANDLE_PATTERN.test(trimmed)) return "";
  return `https://warpcast.com/${trimmed.replace(/^@/, "")}`;
};

export const normalizeTwitter = (value?: string) => {
  const trimmed = value?.trim();
  if (!trimmed) return "";

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      if (
        ["x.com", "www.x.com", "twitter.com", "www.twitter.com"].includes(
          url.hostname
        ) &&
        url.pathname.length > 1
      ) {
        return `https://x.com/${url.pathname.split("/").filter(Boolean)[0]}`;
      }
    } catch {
      return "";
    }
  }

  if (!TWITTER_HANDLE_PATTERN.test(trimmed)) return "";
  return `https://x.com/${trimmed.replace(/^@/, "")}`;
};

export const normalizeProfileMetadata = (
  input: ProfileMetadataInput
): NormalizedProfileMetadata => ({
  username: (input.username || "").trim(),
  websiteUrl: normalizeUrl(input.websiteUrl),
  farcaster: normalizeFarcaster(input.farcaster),
  twitter: normalizeTwitter(input.twitter),
  avatarUrl: (input.avatarUrl || "").trim(),
});

export const validateProfileMetadata = (input: ProfileMetadataInput) => {
  const username = (input.username || "").trim();

  if (username.length > USERNAME_MAX_LENGTH) {
    return `Username must be ${USERNAME_MAX_LENGTH} characters or fewer.`;
  }

  if (username && !USERNAME_PATTERN.test(username)) {
    return "Username can only use letters, numbers, underscores, periods, and hyphens.";
  }

  for (const [label, value] of Object.entries({
    websiteUrl: input.websiteUrl,
    farcaster: input.farcaster,
    twitter: input.twitter,
  })) {
    if (typeof value === "string" && value.length > SOCIAL_MAX_LENGTH) {
      return `${label} is too long.`;
    }
  }

  const avatarUrl = input.avatarUrl?.trim();
  if (avatarUrl) {
    if (avatarUrl.length > AVATAR_DATA_URL_MAX_LENGTH) {
      return "Profile image is too large.";
    }

    if (!AVATAR_DATA_URL_PATTERN.test(avatarUrl)) {
      return "Profile image must be a PNG, JPEG, or WebP image.";
    }
  }

  if (input.websiteUrl?.trim() && !normalizeUrl(input.websiteUrl)) {
    return "Website must be a valid URL.";
  }

  if (input.farcaster?.trim() && !normalizeFarcaster(input.farcaster)) {
    return "Farcaster must be a valid handle or Warpcast URL.";
  }

  if (input.twitter?.trim() && !normalizeTwitter(input.twitter)) {
    return "Twitter/X must be a valid handle or X URL.";
  }

  return undefined;
};

export const createProfileUpdateMessage = (address: string) => {
  const normalizedAddress = normalizeWalletAddress(address);
  if (!normalizedAddress) throw new Error("Invalid wallet address.");

  return [
    "Yellow Collective profile update",
    "",
    `Wallet: ${normalizedAddress}`,
    `Issued At: ${Date.now()}`,
  ].join("\n");
};

export const parseProfileUpdateMessage = (message: string) => {
  const wallet = message
    .split("\n")
    .find((line) => line.startsWith("Wallet: "))
    ?.replace("Wallet: ", "")
    .trim();
  const issuedAt = Number(
    message
      .split("\n")
      .find((line) => line.startsWith("Issued At: "))
      ?.replace("Issued At: ", "")
      .trim()
  );

  const normalizedWallet = normalizeWalletAddress(wallet);
  if (!normalizedWallet || !Number.isFinite(issuedAt)) return null;

  return { wallet: normalizedWallet, issuedAt };
};
