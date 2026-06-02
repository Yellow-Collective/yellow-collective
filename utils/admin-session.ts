import type { NextApiRequest, NextApiResponse } from "next";
import { createHmac, timingSafeEqual } from "crypto";
import { getAddress, isAddress } from "viem";

const ADMIN_SESSION_COOKIE_NAME = "yellow_admin_session";
const ADMIN_SESSION_TTL_SECONDS = 6 * 60 * 60;

type AdminSessionPayload = {
  walletAddress: string;
  issuedAt: string;
  expirationTime: string;
};

type CreateAdminSessionTokenOptions = {
  issuedAt?: Date;
  expirationTime?: Date;
};

const getAdminSessionSecret = () => {
  const secret =
    process.env.ADMIN_SESSION_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.SESSION_SECRET ||
    process.env.DATABASE_URL ||
    process.env.DATABASE_PUBLIC_URL;

  if (secret) return secret;
  if (process.env.NODE_ENV !== "production") {
    return "yellow-collective-local-admin-session-secret";
  }

  throw new Error("ADMIN_SESSION_SECRET is required for admin sessions.");
};

const encodeBase64Url = (value: string) =>
  Buffer.from(value, "utf8").toString("base64url");

const decodeBase64Url = (value: string) =>
  Buffer.from(value, "base64url").toString("utf8");

const signSessionPayload = (encodedPayload: string) =>
  createHmac("sha256", getAdminSessionSecret())
    .update(encodedPayload)
    .digest("base64url");

const safeEqual = (first: string, second: string) => {
  const firstBuffer = Buffer.from(first);
  const secondBuffer = Buffer.from(second);

  return (
    firstBuffer.length === secondBuffer.length &&
    timingSafeEqual(new Uint8Array(firstBuffer), new Uint8Array(secondBuffer))
  );
};

const serializeCookie = (
  name: string,
  value: string,
  { maxAge }: { maxAge: number }
) => {
  const parts = [
    `${name}=${value}`,
    "Path=/api/admin",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${maxAge}`,
  ];

  if (process.env.NODE_ENV === "production") parts.push("Secure");

  return parts.join("; ");
};

const parseCookieHeader = (value?: string) => {
  if (!value) return {};

  return Object.fromEntries(
    value.split(";").map((cookie) => {
      const [name, ...rawValueParts] = cookie.trim().split("=");
      return [name, rawValueParts.join("=")];
    })
  );
};

export const createAdminSessionToken = (
  walletAddress: string,
  options: CreateAdminSessionTokenOptions = {}
) => {
  if (!isAddress(walletAddress)) throw new Error("Invalid admin wallet.");

  const issuedAt = options.issuedAt || new Date();
  const expirationTime =
    options.expirationTime ||
    new Date(issuedAt.getTime() + ADMIN_SESSION_TTL_SECONDS * 1000);
  const payload: AdminSessionPayload = {
    walletAddress: getAddress(walletAddress),
    issuedAt: issuedAt.toISOString(),
    expirationTime: expirationTime.toISOString(),
  };
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = signSessionPayload(encodedPayload);

  return `${encodedPayload}.${signature}`;
};

export const verifyAdminSessionToken = (token?: string | null) => {
  if (!token) return undefined;

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return undefined;

  const expectedSignature = signSessionPayload(encodedPayload);
  if (!safeEqual(signature, expectedSignature)) return undefined;

  try {
    const payload = JSON.parse(
      decodeBase64Url(encodedPayload)
    ) as Partial<AdminSessionPayload>;

    if (
      typeof payload.walletAddress !== "string" ||
      !isAddress(payload.walletAddress) ||
      typeof payload.expirationTime !== "string" ||
      new Date(payload.expirationTime).getTime() <= Date.now()
    ) {
      return undefined;
    }

    return getAddress(payload.walletAddress);
  } catch {
    return undefined;
  }
};

export const getAdminSessionAddress = (req: NextApiRequest) => {
  const cookies = parseCookieHeader(req.headers.cookie);
  return verifyAdminSessionToken(cookies[ADMIN_SESSION_COOKIE_NAME]);
};

export const setAdminSessionCookie = (
  res: NextApiResponse,
  walletAddress: string
) => {
  res.setHeader(
    "Set-Cookie",
    serializeCookie(
      ADMIN_SESSION_COOKIE_NAME,
      createAdminSessionToken(walletAddress),
      { maxAge: ADMIN_SESSION_TTL_SECONDS }
    )
  );
};

export const clearAdminSessionCookie = (res: NextApiResponse) => {
  res.setHeader(
    "Set-Cookie",
    serializeCookie(ADMIN_SESSION_COOKIE_NAME, "", { maxAge: 0 })
  );
};
