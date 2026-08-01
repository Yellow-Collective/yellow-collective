import type { NextApiRequest, NextApiResponse } from "next";
import { randomBytes } from "crypto";
import { Pool } from "pg";
import { getAddress, isAddress, verifyMessage } from "viem";
import { TOKEN_NETWORK } from "constants/addresses";
import {
  buildSignedRequestMessage,
  createRequestPayloadHash,
  normalizeSignedRequestMethod,
  normalizeSignedRequestPath,
  normalizeSignedRequestWallet,
  parseSignedRequestAuthorizationHeader,
  type SignedRequestChallenge,
  type SignedRequestMethod,
} from "./signature-auth";

const SIGNED_REQUEST_TTL_MS = 5 * 60 * 1000;
const DEFAULT_SIGNED_REQUEST_CHAIN_ID = Number(TOKEN_NETWORK);

type StoredChallenge = SignedRequestChallenge & {
  consumedAt?: string | null;
};

type IssueSignedRequestChallengeInput = {
  walletAddress: string;
  chainId: number;
  action: string;
  method: SignedRequestMethod | string;
  path: string;
  payloadHash: `0x${string}`;
};

type VerifySignedRequestInput = {
  action: string;
  expectedChainId?: number;
  expectedWalletAddress?: string;
  payload?: unknown;
};

let pool: Pool | null = null;
let tableReady: Promise<void> | null = null;
const memoryChallenges = new Map<string, StoredChallenge>();

const getConnectionString = () =>
  process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;

const getPool = () => {
  const connectionString = getConnectionString();
  if (!connectionString) return null;

  if (!pool) {
    pool = new Pool({
      connectionString,
      connectionTimeoutMillis: 8000,
      idleTimeoutMillis: 10000,
      max: 2,
      ssl: connectionString.includes("railway.internal")
        ? undefined
        : { rejectUnauthorized: false },
    });
  }

  return pool;
};

const ensureNonceTable = async () => {
  const noncePool = getPool();
  if (!noncePool) return;

  if (!tableReady) {
    tableReady = noncePool
      .query(
        `
          CREATE TABLE IF NOT EXISTS signed_request_nonces (
            nonce text PRIMARY KEY,
            wallet_address text NOT NULL,
            chain_id integer NOT NULL,
            action text NOT NULL,
            method text NOT NULL,
            path text NOT NULL,
            domain text NOT NULL,
            uri text NOT NULL,
            issued_at timestamptz NOT NULL,
            expiration_time timestamptz NOT NULL,
            payload_hash text NOT NULL,
            consumed_at timestamptz
          )
        `
      )
      .then(() =>
        noncePool.query(
          `
            CREATE INDEX IF NOT EXISTS signed_request_nonces_expiration_idx
            ON signed_request_nonces (expiration_time)
          `
        )
      )
      .then(() => undefined);
  }

  return tableReady;
};

const mapChallengeRow = (row: Record<string, any>): StoredChallenge => ({
  nonce: row.nonce,
  walletAddress: getAddress(row.wallet_address),
  chainId: Number(row.chain_id),
  action: row.action,
  method: row.method,
  path: row.path,
  domain: row.domain,
  uri: row.uri,
  issuedAt: new Date(row.issued_at).toISOString(),
  expirationTime: new Date(row.expiration_time).toISOString(),
  payloadHash: row.payload_hash,
  consumedAt: row.consumed_at ? new Date(row.consumed_at).toISOString() : null,
});

const storeChallenge = async (challenge: StoredChallenge) => {
  const noncePool = getPool();
  if (!noncePool) {
    memoryChallenges.set(challenge.nonce, challenge);
    return;
  }

  await ensureNonceTable();
  await noncePool.query(
    `
      INSERT INTO signed_request_nonces (
        nonce,
        wallet_address,
        chain_id,
        action,
        method,
        path,
        domain,
        uri,
        issued_at,
        expiration_time,
        payload_hash
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::timestamptz, $10::timestamptz, $11)
    `,
    [
      challenge.nonce,
      challenge.walletAddress,
      challenge.chainId,
      challenge.action,
      challenge.method,
      challenge.path,
      challenge.domain,
      challenge.uri,
      challenge.issuedAt,
      challenge.expirationTime,
      challenge.payloadHash,
    ]
  );
};

const loadChallenge = async (nonce: string) => {
  const noncePool = getPool();
  if (!noncePool) return memoryChallenges.get(nonce) || null;

  await ensureNonceTable();
  const result = await noncePool.query(
    `
      SELECT *
      FROM signed_request_nonces
      WHERE nonce = $1
      LIMIT 1
    `,
    [nonce]
  );

  return result.rows[0] ? mapChallengeRow(result.rows[0]) : null;
};

const consumeChallenge = async (nonce: string) => {
  const noncePool = getPool();
  if (!noncePool) {
    const challenge = memoryChallenges.get(nonce);
    if (!challenge || challenge.consumedAt) return false;

    memoryChallenges.set(nonce, {
      ...challenge,
      consumedAt: new Date().toISOString(),
    });
    return true;
  }

  await ensureNonceTable();
  const result = await noncePool.query(
    `
      UPDATE signed_request_nonces
      SET consumed_at = now()
      WHERE nonce = $1
        AND consumed_at IS NULL
        AND expiration_time > now()
    `,
    [nonce]
  );

  return result.rowCount === 1;
};

const getHeaderValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export const setNoStoreHeaders = (res: NextApiResponse) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
};

export const getRequestPath = (req: NextApiRequest) => {
  const url = req.url || "/";
  return normalizeSignedRequestPath(new URL(url, "http://local").pathname);
};

const getFirstForwardedValue = (value?: string) =>
  value?.split(",", 1)[0]?.trim();

const createRequestOrigin = (protocol?: string, host?: string) => {
  if (!host) return "";

  const normalizedProtocol = protocol?.toLowerCase();
  if (normalizedProtocol !== "http" && normalizedProtocol !== "https") {
    return "";
  }

  try {
    const url = new URL(`${normalizedProtocol}://${host}`);
    if (
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      return "";
    }

    return url.origin;
  } catch {
    return "";
  }
};

const getConfiguredBaseUrl = () => {
  const configuredSiteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    (process.env.NEXT_PUBLIC_VERCEL_URL
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
      : "");

  if (!configuredSiteUrl) return "";

  try {
    const normalized = configuredSiteUrl.startsWith("http")
      ? configuredSiteUrl
      : `https://${configuredSiteUrl}`;
    return new URL(normalized).origin;
  } catch {
    return "";
  }
};

const isConfiguredProductionOrigin = (
  requestOrigin: string,
  configuredOrigin: string
) => {
  const requestUrl = new URL(requestOrigin);
  const configuredUrl = new URL(configuredOrigin);
  const configuredHostname = configuredUrl.hostname.toLowerCase();
  const alternateHostname = configuredHostname.startsWith("www.")
    ? configuredHostname.slice(4)
    : `www.${configuredHostname}`;

  return (
    requestUrl.protocol === configuredUrl.protocol &&
    requestUrl.port === configuredUrl.port &&
    (requestUrl.hostname.toLowerCase() === configuredHostname ||
      requestUrl.hostname.toLowerCase() === alternateHostname)
  );
};

const getRequestBaseUrl = (req: NextApiRequest) => {
  const forwardedHost = getFirstForwardedValue(
    getHeaderValue(req.headers["x-forwarded-host"])
  );
  const host =
    forwardedHost || getFirstForwardedValue(getHeaderValue(req.headers.host));
  const forwardedProto = getFirstForwardedValue(
    getHeaderValue(req.headers["x-forwarded-proto"])
  );
  const protocol =
    forwardedProto || (host?.includes("localhost") ? "http" : "https");
  const requestOrigin = createRequestOrigin(protocol, host);
  const configuredOrigin = getConfiguredBaseUrl();

  if (
    process.env.NODE_ENV === "production" &&
    configuredOrigin &&
    requestOrigin &&
    !isConfiguredProductionOrigin(requestOrigin, configuredOrigin)
  ) {
    return configuredOrigin;
  }

  return requestOrigin || configuredOrigin || "http://localhost";
};

const getRequestDomainAndUri = (req: NextApiRequest, path: string) => {
  const baseUrl = getRequestBaseUrl(req);
  const url = new URL(path, baseUrl);

  return {
    domain: url.host,
    uri: url.toString(),
  };
};

export const resetMemorySignedRequestNoncesForTests = () => {
  memoryChallenges.clear();
};

export const issueSignedRequestChallenge = async (
  req: NextApiRequest,
  input: IssueSignedRequestChallengeInput
) => {
  const method = normalizeSignedRequestMethod(input.method);
  if (!method) throw new Error("Invalid request method.");
  if (!input.action.trim()) throw new Error("Action is required.");

  const walletAddress = normalizeSignedRequestWallet(input.walletAddress);
  const path = normalizeSignedRequestPath(input.path);
  const { domain, uri } = getRequestDomainAndUri(req, path);
  const issuedAtDate = new Date();
  const expirationDate = new Date(issuedAtDate.getTime() + SIGNED_REQUEST_TTL_MS);
  const challenge: StoredChallenge = {
    nonce: randomBytes(24).toString("hex"),
    walletAddress,
    chainId: Number(input.chainId),
    action: input.action,
    method,
    path,
    domain,
    uri,
    issuedAt: issuedAtDate.toISOString(),
    expirationTime: expirationDate.toISOString(),
    payloadHash: input.payloadHash,
    consumedAt: null,
  };

  await storeChallenge(challenge);
  return challenge;
};

export const verifySignedRequest = async (
  req: NextApiRequest,
  res: NextApiResponse,
  {
    action,
    expectedChainId = DEFAULT_SIGNED_REQUEST_CHAIN_ID,
    expectedWalletAddress,
    payload,
  }: VerifySignedRequestInput
) => {
  setNoStoreHeaders(res);

  const authorization = parseSignedRequestAuthorizationHeader(
    getHeaderValue(req.headers.authorization)
  );

  if (!authorization) {
    res.status(401).json({ error: "Signed request authorization required." });
    return undefined;
  }

  const challenge = await loadChallenge(authorization.nonce);
  if (!challenge) {
    res.status(401).json({ error: "Signing nonce not found or expired." });
    return undefined;
  }

  const method = normalizeSignedRequestMethod(req.method);
  const path = getRequestPath(req);
  const payloadHash = createRequestPayloadHash(
    method === "GET" ? {} : payload ?? req.body ?? {}
  );
  const { domain, uri } = getRequestDomainAndUri(req, path);
  const normalizedWalletAddress = isAddress(authorization.walletAddress)
    ? getAddress(authorization.walletAddress)
    : "";
  const normalizedExpectedWallet = expectedWalletAddress
    ? getAddress(expectedWalletAddress)
    : undefined;

  if (
    challenge.consumedAt ||
    new Date(challenge.expirationTime).getTime() <= Date.now() ||
    challenge.walletAddress !== normalizedWalletAddress ||
    (normalizedExpectedWallet && challenge.walletAddress !== normalizedExpectedWallet) ||
    challenge.chainId !== expectedChainId ||
    challenge.action !== action ||
    challenge.method !== method ||
    challenge.path !== path ||
    challenge.domain !== domain ||
    challenge.uri !== uri ||
    challenge.payloadHash !== payloadHash
  ) {
    res.status(403).json({ error: "Signed request does not match this request." });
    return undefined;
  }

  try {
    const isValid = await verifyMessage({
      address: challenge.walletAddress as `0x${string}`,
      message: buildSignedRequestMessage(challenge),
      signature: authorization.signature,
    });

    if (!isValid) {
      res.status(403).json({ error: "Signed request signature invalid." });
      return undefined;
    }

    const consumed = await consumeChallenge(challenge.nonce);
    if (!consumed) {
      res.status(409).json({ error: "Signing nonce has already been used." });
      return undefined;
    }

    return challenge.walletAddress;
  } catch (error) {
    console.error("Signed request verification failed", error);
    res.status(403).json({ error: "Signed request signature invalid." });
    return undefined;
  }
};
