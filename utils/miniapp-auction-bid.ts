import { isAddress, numberToHex } from "viem";
import type { MiniAppEthereumProvider } from "./farcasterMiniApp";
import { isAuctionWalletRejection } from "./auction-wallet-error";

export class MiniAppBidSubmissionError extends Error {
  constructor(
    public readonly code: string,
    public readonly submissionUnknown = false,
    public readonly cause?: unknown
  ) {
    super(code);
    this.name = "MiniAppBidSubmissionError";
  }
}

// This function requests wallet approval and sends a bid transaction.
export const sendMiniAppAuctionBid = async (
  provider: MiniAppEthereumProvider | undefined,
  bid: { account: string; auction: string; calldata: string; value: bigint }
): Promise<`0x${string}`> => {
  if (!provider)
    throw new MiniAppBidSubmissionError("MINIAPP_PROVIDER_UNAVAILABLE");
  if (
    !isAddress(bid.account) ||
    !isAddress(bid.auction) ||
    /^0x0{40}$/i.test(bid.auction) ||
    typeof bid.value !== "bigint" ||
    bid.value <= 0n ||
    !/^0x(?:[a-f0-9]{2}){4,}$/i.test(bid.calldata)
  )
    throw new MiniAppBidSubmissionError("MINIAPP_INVALID_BID");

  const [accounts, chainId] = await Promise.all([
    provider.request({ method: "eth_accounts" }),
    provider.request({ method: "eth_chainId" }),
  ]);
  if (
    !Array.isArray(accounts) ||
    !accounts.some(
      (account) =>
        typeof account === "string" &&
        account.toLowerCase() === bid.account.toLowerCase()
    )
  )
    throw new MiniAppBidSubmissionError("MINIAPP_ACCOUNT_CHANGED");
  if (Number(chainId) !== 8453)
    throw new MiniAppBidSubmissionError("MINIAPP_WRONG_CHAIN");

  let hash: unknown;
  try {
    // The native wallet supplies gas and fees during its approval flow. Do not
    // route this request through the legacy signer's wallet-side gas estimate.
    hash = await provider.request({
      method: "eth_sendTransaction",
      params: [
        {
          from: bid.account,
          to: bid.auction,
          data: bid.calldata,
          value: numberToHex(bid.value),
          chainId: "0x2105",
        },
      ],
    });
  } catch (error) {
    if (isAuctionWalletRejection(error)) throw error;
    // The wallet may have accepted the request before its response was lost.
    throw new MiniAppBidSubmissionError(
      "MINIAPP_SUBMISSION_UNKNOWN",
      true,
      error
    );
  }
  if (typeof hash !== "string" || !/^0x[a-f0-9]{64}$/i.test(hash)) {
    throw new MiniAppBidSubmissionError("MINIAPP_SUBMISSION_UNKNOWN", true);
  }
  return hash as `0x${string}`;
};
