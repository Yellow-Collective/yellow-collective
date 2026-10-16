import {
  buildSignedRequestMessage,
  createRequestPayloadHash,
  createSignedRequestAuthorizationHeader,
  normalizeSignedRequestMethod,
  normalizeSignedRequestPath,
  normalizeSignedRequestWallet,
  type SignedRequestChallenge,
  type SignedRequestMethod,
} from "./signature-auth";

type SignMessageAsync = (args: { message: string }) => Promise<string>;

// Bound each stage separately. A late wallet response must never resume a request.
const withDeadline = async <T>(
  operation: Promise<T>,
  ms: number,
  message: string,
  onTimeout?: () => void
) => {
  if (!ms) return operation;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(message));
          onTimeout?.();
        }, ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};

type CreateSignedRequestAuthHeaderInput = {
  walletAddress: string;
  chainId: number;
  action: string;
  method: SignedRequestMethod | string;
  path: string;
  payload?: unknown;
  signMessageAsync: SignMessageAsync;
  bounded?: boolean;
};

export const createSignedRequestAuthHeader = async ({
  walletAddress,
  chainId,
  action,
  method,
  path,
  payload = {},
  signMessageAsync,
  bounded = false,
}: CreateSignedRequestAuthHeaderInput) => {
  const normalizedMethod = normalizeSignedRequestMethod(method);
  if (!normalizedMethod) throw new Error("Invalid signed request method.");

  const challengeRequest = {
    walletAddress: normalizeSignedRequestWallet(walletAddress),
    chainId,
    action,
    method: normalizedMethod,
    path: normalizeSignedRequestPath(path),
    payloadHash: createRequestPayloadHash(payload),
  };
  const controller = new AbortController();
  const { response, data } = await withDeadline(
    (async () => {
      const response = await fetch("/api/auth/nonce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(challengeRequest),
        signal: controller.signal,
      });
      const data = (await response.json().catch(() => ({}))) as {
        challenge?: SignedRequestChallenge;
        message?: string;
        error?: string;
      };
      return { response, data };
    })(),
    bounded ? 30000 : 0,
    "Signing request timed out. Check your connection and try again.",
    () => controller.abort()
  );

  if (!response.ok || !data.challenge || !data.message) {
    throw new Error(data.error || "Unable to create signing challenge.");
  }

  const expectedMessage = buildSignedRequestMessage(data.challenge);
  if (data.message !== expectedMessage) {
    throw new Error("Signing challenge mismatch.");
  }

  let signature: `0x${string}`;
  try {
    signature = (await withDeadline(
      signMessageAsync({ message: data.message }),
      bounded ? 90000 : 0,
      "Wallet confirmation timed out. Dismiss any pending request in your wallet, then try again."
    )) as `0x${string}`;
  } catch (error) {
    if ((error as { name?: string })?.name === "ConnectorNotFoundError") {
      throw new Error(
        "Wallet connection is unavailable. Disconnect and reconnect your wallet using the wallet button, then try again. Your form has been kept."
      );
    }
    throw error;
  }

  return createSignedRequestAuthorizationHeader({
    nonce: data.challenge.nonce,
    walletAddress: data.challenge.walletAddress,
    signature,
  });
};
