import { BigNumber, utils } from "@/utils/ethers-compat";
import Image from "next/image";
import { useMemo, useState } from "react";
import {
  useWaitForTransaction,
  useAccount,
  useBalance,
  Address,
  usePrepareSendTransaction,
  useSendTransaction,
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

const auctionInterface = new utils.Interface(auctionAbi as any);
const BASE_CHAIN_ID = 8453;

const parseBidAmount = (value: string) => {
  try {
    return value ? utils.parseEther(value) : undefined;
  } catch {
    return undefined;
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
  const highestBidBN = BigNumber.from(highestBid);
  const amountIncrease = highestBidBN.div("10");
  const nextBidAmount = highestBidBN.add(amountIncrease);
  const commentLength = getBidCommentByteLength(bidComment);
  const commentError = bidComment.trim()
    ? validateBidCommentText(bidComment) || ""
    : "";

  const { config, error } = usePrepareSendTransaction({
    chainId: BASE_CHAIN_ID,
    request:
      auction && finalBidCalldata && parsedBid
        ? {
            to: auction as Address,
            data: finalBidCalldata,
            value: parsedBid,
          }
        : undefined,
    enabled:
      Boolean(auction && finalBidCalldata && parsedBid && debouncedBid) &&
      !commentError,
  });
  const { sendTransaction: write, data } = useSendTransaction(config);
  const { isLoading } = useWaitForTransaction({
    hash: data?.hash,
    onError: () => {
      track("placeBidError");
    },
    onSuccess: async () => {
      setBid("");
      setBidComment("");

      track("placeBidSuccess");
      await onNewBid();
    },
  });

  const getError = () => {
    const minNextBid = utils.formatEther(nextBidAmount);
    const bidAmount = parseBidAmount(bid);
    if (
      bid &&
      (!bidAmount || BigNumber.from(bidAmount.toString()).lt(nextBidAmount))
    ) {
      return `Bid must be at least ${minNextBid}`;
    }

    const reason = (error as any)?.reason;
    if (!reason) return "";

    if (reason.includes("insufficient funds"))
      return "Error insufficient funds for bid";

    if (parsedBid && BigNumber.from(parsedBid.toString()).lt(nextBidAmount))
      return "Error invalid bid";
  };
  const showBridgeToBase =
    isConnected && baseBalance?.value !== undefined && baseBalance.value.isZero();

  return (
    <div
      className={clsx(
        "yc-auction-focus-area flex flex-col gap-6",
        hidden && "hidden"
      )}
    >
      <div
        className={clsx(
          "flex w-full flex-row flex-wrap items-start gap-3"
        )}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <input
            value={bid}
            type="number"
            onChange={(e) => setBid(e.target.value)}
            className={clsx(
              "h-[59px] w-full min-w-0 rounded-[18px] border-2 border-accent bg-primary px-4 py-4 outline-none focus:border-accent sm:px-6",
              getError() != undefined && getError() != "" && "border-negative"
            )}
            placeholder={
              nextBidAmount
                ? `Ξ ${utils.formatEther(nextBidAmount)} or more`
                : ""
            }
          />
          {error && <p className="caption text-negative">{getError()}</p>}
        </div>
        <div className="flex flex-col items-center justify-center gap-1">
          <Button
            className="yc-dark-yellow-button h-[59px] min-w-[112px] px-3 py-0 text-sm hover:-translate-y-0.5 hover:shadow-[0px_6px_0px_0px_rgb(var(--color-action-shadow))] active:translate-y-1 active:shadow-none sm:min-w-[140px]"
            disabled={((!write || isLoading) && isConnected) || !!commentError}
            onClick={(e) => {
              e.preventDefault();
              if (isConnected) {
                if (commentError) return;
                track("placeBidTriggered");
                write?.();
              } else {
                openConnectModal?.();
              }
            }}
          >
            {isLoading ? (
              <Image src="/spinner.svg" height={24} width={24} alt="spinner" />
            ) : (
              "Place bid"
            )}
          </Button>
        </div>
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
            onChange={(e) =>
              setBidComment(truncateBidCommentToByteLimit(e.target.value))
            }
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
