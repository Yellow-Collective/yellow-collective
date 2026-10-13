import { createHash } from "node:crypto";
export const PREVIEW_TARGET_ID = "yellow-round-video-preview";
export const sha256 = (value) =>
  createHash("sha256").update(value).digest("hex");

export function parsePreviewTarget(env) {
  if (!env.ROUND_VIDEO_PREVIEW_DATABASE_URL)
    throw new Error("Explicit preview database URL is required.");
  let url;
  try {
    url = new URL(env.ROUND_VIDEO_PREVIEW_DATABASE_URL);
  } catch {
    throw new Error("Preview database URL is invalid.");
  }
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !url.hostname ||
    !url.pathname.slice(1) ||
    /(?:^|[./_-])prod(?:uction)?(?:[./_-]|$)/i.test(
      `${url.hostname}/${url.pathname}`
    )
  )
    throw new Error("Preview target is invalid or appears to be production.");
  if ([...url.searchParams.keys()].some((key) => key !== "sslmode"))
    throw new Error("Preview URL query configuration is unsupported.");
  const identity = [
    url.hostname.toLowerCase(),
    url.port || "5432",
    decodeURIComponent(url.pathname.slice(1)),
    decodeURIComponent(url.username),
  ].join("|");
  const fingerprint = sha256(identity);
  for (const key of [
    "DATABASE_URL",
    "DATABASE_PUBLIC_URL",
    "ROUND_VIDEO_PRODUCTION_DATABASE_URL",
  ]) {
    if (!env[key]) continue;
    let other;
    try {
      other = new URL(env[key]);
    } catch {
      throw new Error("Non-preview comparison configuration is invalid.");
    }
    const otherIdentity = [
      other.hostname.toLowerCase(),
      other.port || "5432",
      decodeURIComponent(other.pathname.slice(1)),
      decodeURIComponent(other.username),
    ].join("|");
    if (identity === otherIdentity)
      throw new Error(
        "Preview target matches an existing non-preview database configuration."
      );
  }
  const mode =
    env.ROUND_VIDEO_PREVIEW_DB_SSL_MODE ||
    url.searchParams.get("sslmode") ||
    "verify-full";
  if (!["verify-full", "require", "disable"].includes(mode))
    throw new Error("Unsupported preview TLS mode.");
  if (
    mode === "disable" &&
    !["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname) &&
    !url.hostname.endsWith(".railway.internal")
  )
    throw new Error("TLS cannot be disabled for a public preview endpoint.");
  return {
    fingerprint,
    connection: {
      host: url.hostname,
      port: Number(url.port || 5432),
      database: decodeURIComponent(url.pathname.slice(1)),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      ssl:
        mode === "disable"
          ? false
          : { rejectUnauthorized: mode === "verify-full" },
      connectionTimeoutMillis: 10000,
      query_timeout: 20000,
      statement_timeout: 15000,
      lock_timeout: 10000,
      idle_in_transaction_session_timeout: 20000,
    },
  };
}

export function verifyPreviewConfirmation(env, target, serverFingerprint) {
  if (
    env.ROUND_VIDEO_PREVIEW_TARGET_ID !== PREVIEW_TARGET_ID ||
    env.ROUND_VIDEO_PREVIEW_TARGET_SHA256 !== target.fingerprint ||
    env.ROUND_VIDEO_PREVIEW_SERVER_SHA256 !== serverFingerprint
  )
    throw new Error(
      "Preview target confirmation does not match inspected identity."
    );
}
