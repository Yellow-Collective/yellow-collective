import { getAddress, isAddress, keccak256, stringToHex } from "viem";

export type SignedRequestMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type SignedRequestChallenge = {
  nonce: string;
  walletAddress: string;
  chainId: number;
  action: string;
  method: SignedRequestMethod;
  path: string;
  domain: string;
  uri: string;
  issuedAt: string;
  expirationTime: string;
  payloadHash: `0x${string}`;
};

export type SignedRequestAuthorization = {
  nonce: string;
  walletAddress: string;
  signature: `0x${string}`;
};

const AUTH_SCHEME = "YellowSignature";

const normalizeForStableJson = (value: unknown): unknown => {
  if (value === undefined) return null;
  if (value === null) return null;
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(normalizeForStableJson);
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([first], [second]) => first.localeCompare(second));

    return Object.fromEntries(
      entries.map(([key, entryValue]) => [key, normalizeForStableJson(entryValue)])
    );
  }

  return value;
};

export const stableStringify = (value: unknown) =>
  JSON.stringify(normalizeForStableJson(value ?? {}));

export const createRequestPayloadHash = (payload: unknown = {}) =>
  keccak256(stringToHex(stableStringify(payload))) as `0x${string}`;

export const normalizeSignedRequestMethod = (
  method?: string
): SignedRequestMethod | undefined => {
  const normalized = method?.toUpperCase();
  return normalized === "GET" ||
    normalized === "POST" ||
    normalized === "PUT" ||
    normalized === "PATCH" ||
    normalized === "DELETE"
    ? normalized
    : undefined;
};

export const normalizeSignedRequestPath = (path: string) => {
  const withoutQuery = path.split("?")[0] || "/";
  return withoutQuery.startsWith("/") ? withoutQuery : `/${withoutQuery}`;
};

export const normalizeSignedRequestWallet = (walletAddress: string) => {
  if (!isAddress(walletAddress)) throw new Error("Invalid wallet address.");
  return getAddress(walletAddress);
};

export const buildSignedRequestMessage = (challenge: SignedRequestChallenge) =>
  [
    `${challenge.domain} wants you to sign in with your Ethereum account:`,
    normalizeSignedRequestWallet(challenge.walletAddress),
    "",
    "Authorize this Yellow Collective request. Review the request resources before signing.",
    "",
    `URI: ${challenge.uri}`,
    "Version: 1",
    `Chain ID: ${challenge.chainId}`,
    `Nonce: ${challenge.nonce}`,
    `Issued At: ${challenge.issuedAt}`,
    `Expiration Time: ${challenge.expirationTime}`,
    "Resources:",
    `- urn:yellow-collective:action:${encodeURIComponent(challenge.action)}`,
    `- urn:yellow-collective:method:${challenge.method}`,
    `- urn:yellow-collective:path:${encodeURIComponent(challenge.path)}`,
    `- urn:yellow-collective:payload:${challenge.payloadHash}`,
  ].join("\n");

const encodeBase64Url = (value: string) => {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(value, "utf8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/u, "");
  }

  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");
};

const decodeBase64Url = (value: string) => {
  const padded = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");

  if (typeof Buffer !== "undefined") {
    return Buffer.from(padded, "base64").toString("utf8");
  }

  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));

  return new TextDecoder().decode(bytes);
};

export const createSignedRequestAuthorizationHeader = (
  authorization: SignedRequestAuthorization
) => `${AUTH_SCHEME} ${encodeBase64Url(JSON.stringify(authorization))}`;

export const parseSignedRequestAuthorizationHeader = (
  value?: string | null
): SignedRequestAuthorization | null => {
  if (!value) return null;

  const [scheme, encoded] = value.split(" ");
  if (scheme !== AUTH_SCHEME || !encoded) return null;

  try {
    const parsed = JSON.parse(decodeBase64Url(encoded)) as Partial<SignedRequestAuthorization>;
    if (
      typeof parsed.nonce !== "string" ||
      typeof parsed.walletAddress !== "string" ||
      typeof parsed.signature !== "string" ||
      !isAddress(parsed.walletAddress) ||
      !/^0x[0-9a-fA-F]+$/.test(parsed.signature)
    ) {
      return null;
    }

    return {
      nonce: parsed.nonce,
      walletAddress: getAddress(parsed.walletAddress),
      signature: parsed.signature as `0x${string}`,
    };
  } catch {
    return null;
  }
};
