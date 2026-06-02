import { Bid } from "@/services/nouns-builder/auction";
import { formatNumber } from "@/utils/formatNumber";
import { utils } from "@/utils/ethers-compat";
import ExternalLink from "../ExternalLink";
import Image from "next/image";
import { ETHERSCAN_BASEURL } from "constants/urls";
import { Dialog, DialogContent, DialogHeader, DialogTrigger } from "../Dialog";
import { twMerge } from "tailwind-merge";
import WalletInfo from "../WalletInfo";

function BidRow({
  bid,
  tight,
  showComment,
}: {
  bid: Bid;
  tight: boolean;
  showComment: boolean;
}) {
  return (
    <div
      className={twMerge(
        "flex w-full flex-col gap-2",
        !tight && "py-3 border-b-2 border-transparent/10"
      )}
    >
      <div className="flex w-full flex-row items-center justify-between gap-3">
        <WalletInfo address={bid.bidder} size="sm" />
        <ExternalLink href={`${ETHERSCAN_BASEURL}/tx/${bid.transactionHash}`}>
          <div
            className={twMerge(
              "flex flex-row gap-2 items-center hover:opacity-70 transition-opacity",
              tight && "yc-bid-history-external-link"
            )}
          >
            <h6 className="text-primary/70">
              Ξ {formatNumber(utils.formatEther(bid.bidAmount || "0"), 4)}
            </h6>
            <Image
              src="/link.svg"
              width={24}
              height={24}
              alt="view"
              className={tight ? "yc-bid-history-popout-icon" : ""}
            />
          </div>
        </ExternalLink>
      </div>
      {showComment && bid.comment && (
        <p className="line-clamp-3 rounded-[14px] bg-white px-4 py-3 text-sm leading-5 text-black">
          &ldquo;{bid.comment}&rdquo;
        </p>
      )}
    </div>
  );
}

export default function BidHistory({
  tokenId,
  tokenImage,
  bids,
  numToShow,
  title,
  shouldShowPreviewComment,
}: {
  tokenId: string;
  tokenImage?: string;
  bids?: Bid[];
  numToShow: number;
  title: string;
  shouldShowPreviewComment?: (bid: Bid) => boolean;
}) {
  return (
    <div className="yc-auction-focus-area flex flex-col items-center">
      {bids?.slice(0, numToShow).map((bid, i) => {
        return (
          <BidRow
            bid={bid}
            tight={false}
            showComment={Boolean(shouldShowPreviewComment?.(bid))}
            key={i}
          />
        );
      })}
      {(bids?.length ?? 0) > numToShow && (
        <Dialog>
          <DialogTrigger>
            <h6 className="pt-3  text-primary/70 hover:text-primary/50">
              {title}
            </h6>
          </DialogTrigger>
          <DialogContent className="yc-bid-history-dialog flex flex-col max-h-[90vh] md:max-h-[70vh]">
            <DialogHeader>
              <div className="flex flex-row gap-4 items-center border-b-2 p-6">
                {tokenImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={tokenImage}
                    width={64}
                    height={64}
                    alt=""
                    className="h-16 w-16 rounded-xl border-2 border-transparent/10 object-cover"
                  />
                )}
                <div className="flex flex-col items-start">
                  <h6 className="text-secondary">Bids for</h6>
                  <h5>Collective Noun #{parseInt(tokenId, 16)}</h5>
                </div>
              </div>
            </DialogHeader>
            <div className="flex flex-col gap-6 p-6 overflow-y-auto">
              {bids?.map((bid, i) => (
                <BidRow bid={bid} tight={true} showComment key={i} />
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
