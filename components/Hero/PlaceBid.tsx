import { BigNumber, utils } from "@/utils/ethers-compat";
import Image from "next/image";
import { useMemo, useRef, useState } from "react";
import {
  useWaitForTransaction,
  useAccount,
  useBalance,
  Address,
  usePrepareSendTransaction,
  useSendTransaction,
  useNetwork,
} from "wagmi";
import { useDebounce } from "@/hooks/useDebounce";
import Button from "../Button";
import clsx from "clsx";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { track } from "@vercel/analytics";
import ExternalLink from "../ExternalLink";
import { auctionAbi } from "abis/auction";
import { COLLECTIVE_NOUNS_TREASURY } from "constants/addresses";
import {
  appendBidCommentDataSuffix,
  getBidCommentByteLength,
  getBidCommentDataSuffix,
  MAX_BID_COMMENT_LENGTH,
  truncateBidCommentToByteLimit,
  validateBidCommentText,
} from "@/utils/bid-comments";
import { useMiniAppWalletConnect } from "@/hooks/useMiniAppWalletConnect";
import { getAuctionWalletError } from "@/utils/auction-wallet-error";

const auctionInterface = new utils.Interface(auctionAbi as any);
const BASE_CHAIN_ID = 8453;
const ZERO_BID = BigNumber.from(0);

const parseBidAmount = (value: string): BigNumber | undefined => {
  try {
    if (!value) return undefined;

    return BigNumber.from(utils.parseEther(value).toString());
  } catch {
    return undefined;
  }
};

const toSafeBigNumber = (value: unknown, fallback = ZERO_BID) => {
  try {
    return BigNumber.from(value ?? fallback);
  } catch {
    return fallback;
  }
};

const isZeroBalanceValue = (value: unknown) => {
  try {
    if (typeof value === "bigint") return value === BigInt(0);
    return BigNumber.from(value ?? 0).isZero();
  } catch {
    return false;
  }
};

export const PlaceBid = ({
  highestBid,
  auction,
  tokenId,
  hidden,
  onNewBid,
}: {
  highestBid?: string;
  auction?: string;
  tokenId?: string;
  hidden: boolean;
  onNewBid: () => Promise<void>;
}) => {
  const { address, isConnected } = useAccount();
  const { chain } = useNetwork();
  const { data: baseBalance } = useBalance({
    address,
    chainId: BASE_CHAIN_ID,
    enabled: isConnected && Boolean(address),
    watch: true,
  });
  const [bid, setBid] = useState("");
  const [bidComment, setBidComment] = useState("");
  const debouncedBid = useDebounce(bid, 500);

  const { openConnectModal } = useConnectModal();
  const {
    connectMiniAppWallet,
    isMiniApp,
    isConnectingMiniApp,
    miniAppConnectionError,
  } = useMiniAppWalletConnect();
  const [refreshError, setRefreshError] = useState("");
  const submissionRef = useRef(false);
  const isWrongChain = isConnected && chain?.id !== BASE_CHAIN_ID;
  const bidCommentDataSuffix = getBidCommentDataSuffix(bidComment);
  const parsedBid = useMemo(() => parseBidAmount(debouncedBid), [debouncedBid]);
  const finalBidCalldata = useMemo(() => {
    if (!tokenId) return undefined;

    const baseCalldata = auctionInterface.encodeFunctionData(
      "createBidWithReferral",
      [tokenId || "1", COLLECTIVE_NOUNS_TREASURY]
    );

    return appendBidCommentDataSuffix(
      baseCalldata,
      bidCommentDataSuffix
    ) as `0x${string}`;
  }, [bidCommentDataSuffix, tokenId]);
  const highestBidBN = toSafeBigNumber(highestBid);
  const amountIncrease = highestBidBN.div("10");
  const nextBidAmount = highestBidBN.add(amountIncrease);
  const commentLength = getBidCommentByteLength(bidComment);
  const commentError = bidComment.trim()
    ? validateBidCommentText(bidComment) || ""
    : "";
  const isPreparedBidValid = parsedBid
    ? parsedBid.gt(ZERO_BID) && parsedBid.gte(nextBidAmount)
    : false;
  const canPrepareBid = Boolean(
    auction &&
    finalBidCalldata &&
    parsedBid &&
    isPreparedBidValid &&
    debouncedBid &&
    isConnected &&
    !isWrongChain &&
    !commentError
  );

  const {
    config,
    error: prepareError,
    isFetching: isPreparing,
    refetch: prepareBid,
  } = usePrepareSendTransaction({
    chainId: BASE_CHAIN_ID,
    request:
      canPrepareBid && auction && finalBidCalldata && parsedBid
        ? {
            to: auction as Address,
            data: finalBidCalldata,
            value: parsedBid,
          }
        : undefined,
    enabled: canPrepareBid,
  });
  const {
    sendTransaction: write,
    data,
    error: sendError,
    isLoading: isAwaitingApproval,
    reset,
  } = useSendTransaction({
    ...config,
    onSettled: () => {
      submissionRef.current = false;
    },
  });
  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: confirmationError,
    refetch,
  } = useWaitForTransaction({
    chainId: BASE_CHAIN_ID,
    hash: data?.hash,
    timeout: 120_000,
    onError: () => {
      track("placeBidError");
    },
    onSuccess: async () => {
      setBid("");
      setBidComment("");

      track("placeBidSuccess");
      try {
        await onNewBid();
      } catch {
        setRefreshError(
          "Your bid was confirmed, but the auction could not refresh. Reload to see the latest bids."
        );
      }
    },
  });

  const getError = () => {
    const minNextBid = utils.formatEther(nextBidAmount);
    const bidAmount = parseBidAmount(bid);
    if (bid) {
      if (!bidAmount) return "Enter a valid ETH amount";

      if (bidAmount.lte(ZERO_BID)) return "Enter a bid greater than 0";

      if (bidAmount.lt(nextBidAmount))
        return `Bid must be at least ${minNextBid}`;
    }

    return "";
  };
  const bidError = getError();
  const hasBidError = Boolean(bidError);
  const hasUnconfirmedTransaction = Boolean(data?.hash && !isConfirmed);
  const isBusy = isConnectingMiniApp || isAwaitingApproval || isConfirming;
  const isCurrentBidPrepared = Boolean(
    bid === debouncedBid &&
    canPrepareBid &&
    !prepareError &&
    config.request &&
    parsedBid &&
    config.request.to === auction &&
    config.request.data === finalBidCalldata &&
    toSafeBigNumber(config.request.value).eq(parsedBid)
  );
  const walletError = isWrongChain
    ? "Switch your wallet to Base to place a bid."
    : getAuctionWalletError(confirmationError, "confirm") ||
      getAuctionWalletError(sendError, "send") ||
      (!isConnected
        ? getAuctionWalletError(miniAppConnectionError, "connect")
        : "") ||
      (canPrepareBid && bid === debouncedBid
        ? getAuctionWalletError(prepareError, "prepare")
        : "");
  const bidStatus = isConnectingMiniApp
    ? "Connecting wallet…"
    : isAwaitingApproval
      ? "Approve your bid in your wallet…"
      : isConfirming
        ? "Waiting for confirmation on Base…"
        : refreshError || (isConfirmed ? "Bid confirmed on Base." : "");
  const showBridgeToBase =
    isConnected &&
    baseBalance?.value !== undefined &&
    isZeroBalanceValue(baseBalance.value);

  return (
    <div
      className={clsx(
        "yc-auction-focus-area flex flex-col gap-6",
        hidden && "hidden"
      )}
    >
      <div className={clsx("flex w-full flex-row flex-wrap items-start gap-3")}>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <input
            value={bid}
            type="number"
            aria-label="Bid amount in ETH"
            disabled={isBusy || hasUnconfirmedTransaction}
            onChange={(e) => {
              reset();
              setRefreshError("");
              setBid(e.target.value);
            }}
            className={clsx(
              "h-[59px] w-full min-w-0 rounded-[18px] border-2 border-accent bg-primary px-4 py-4 outline-none focus:border-accent sm:px-6",
              bidError && "border-negative"
            )}
            placeholder={
              nextBidAmount
                ? `Ξ ${utils.formatEther(nextBidAmount)} or more`
                : ""
            }
          />
          {bidError && <p className="caption text-negative">{bidError}</p>}
        </div>
        <div className="flex flex-col items-center justify-center gap-1">
          <Button
            className="yc-dark-yellow-button h-[59px] min-w-[112px] px-3 py-0 text-sm hover:-translate-y-0.5 hover:shadow-[0px_6px_0px_0px_rgb(var(--color-action-shadow))] active:translate-y-1 active:shadow-none sm:min-w-[140px]"
            disabled={
              isBusy ||
              hasUnconfirmedTransaction ||
              ((!write ||
                !isCurrentBidPrepared ||
                isPreparing ||
                hasBidError) &&
                isConnected) ||
              !!commentError
            }
            aria-busy={isBusy}
            onClick={(e) => {
              e.preventDefault();
              if (isConnected) {
                if (
                  submissionRef.current ||
                  isBusy ||
                  hasUnconfirmedTransaction ||
                  !isCurrentBidPrepared ||
                  isPreparing ||
                  !write ||
                  commentError ||
                  hasBidError
                )
                  return;
                submissionRef.current = true;
                setRefreshError("");
                track("placeBidTriggered");
                // This function requests wallet approval and sends a bid transaction.
                write();
              } else {
                if (isMiniApp) {
                  connectMiniAppWallet();
                } else {
                  openConnectModal?.();
                }
              }
            }}
          >
            {isBusy ? (
              <Image
                src="/spinner.svg"
                height={24}
                width={24}
                alt={bidStatus}
              />
            ) : !isConnected ? (
              "Connect to bid"
            ) : isPreparing || (bid && bid !== debouncedBid) ? (
              "Preparing bid…"
            ) : (
              "Place bid"
            )}
          </Button>
        </div>
        {(walletError || bidStatus || data?.hash) && (
          <div className="flex w-full flex-col gap-2" aria-live="polite">
            {walletError && (
              <p className="caption text-negative" role="alert">
                {walletError}
              </p>
            )}
            {bidStatus && (
              <p className="caption" role="status">
                {bidStatus}
              </p>
            )}
            {prepareError &&
              canPrepareBid &&
              !isBusy &&
              !hasUnconfirmedTransaction && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    void prepareBid();
                  }}
                >
                  Retry bid preparation
                </Button>
              )}
            {data?.hash && (
              <ExternalLink href={`https://basescan.org/tx/${data.hash}`}>
                View bid transaction on Base
              </ExternalLink>
            )}
            {confirmationError && hasUnconfirmedTransaction && (
              <Button
                variant="secondary"
                onClick={() => {
                  void refetch();
                }}
              >
                Check transaction status
              </Button>
            )}
          </div>
        )}
        {showBridgeToBase && (
          <ExternalLink href="https://bridge.base.org/deposit">
            <div className="flex h-[59px] flex-row items-center gap-2">
              <Image src="/info-circle.svg" width={20} height={20} alt="" />
              <span className="font-bold">Bridge to Base</span>
            </div>
          </ExternalLink>
        )}
        <label className="flex w-full max-w-[420px] flex-col gap-2">
          <div className="flex items-end justify-between gap-3">
            <span className="font-bold">Add a comment</span>
            <span
              className={clsx(
                "caption text-primary/60",
                commentError && "text-negative"
              )}
            >
              {commentLength}/{MAX_BID_COMMENT_LENGTH}
            </span>
          </div>
          <textarea
            value={bidComment}
            disabled={isBusy || hasUnconfirmedTransaction}
            onChange={(e) => {
              reset();
              setRefreshError("");
              setBidComment(truncateBidCommentToByteLimit(e.target.value));
            }}
            className={clsx(
              "min-h-[92px] w-full resize-none rounded-[18px] border-2 border-accent bg-primary px-5 py-4 outline-none focus:border-accent",
              commentError && "border-negative"
            )}
            maxLength={MAX_BID_COMMENT_LENGTH}
            placeholder="Say something about your bid..."
          />
          <p
            className={clsx(
              "caption text-primary/60",
              commentError && "text-negative"
            )}
          >
            {commentError ||
              "Optional. Publicly shown with your bid on Yellow and nouns.build."}
          </p>
        </label>
      </div>
    </div>
  );
};
