import { BigNumber, ethers, utils } from "@/utils/ethers-compat";
import Image from "next/image";
import { CountdownDisplay } from "../CountdownDisplay";
import { useCurrentAuctionInfo, useContractInfo, useTokenInfo } from "hooks";
import { compareAddress } from "@/utils/compareAddress";
import { SettleAuction } from "./SettleAuction";
import { PlaceBid } from "./PlaceBid";
import { useEffect, useState } from "react";
import { AuctionInfo } from "@/services/nouns-builder/auction";
import { ContractInfo } from "@/services/nouns-builder/token";
import { usePreviousAuction } from "@/hooks/fetch/usePreviousAuctions";
import { useRouter } from "next/router";
import Button from "../Button";
import clsx from "clsx";
import { getAddress, zeroAddress } from "viem";
import { formatNumber } from "@/utils/formatNumber";
import BidHistory from "./BidHistory";
import WalletInfo from "../WalletInfo";
import { auction } from "@/services/nouns-builder";

export default function Hero() {
  const { data: contractInfo } = useContractInfo();
  const { data: auctionInfo, mutate: mutateCurrentAuctionInfo } =
    useCurrentAuctionInfo({
      auctionContract: contractInfo?.auction,
    });
  const { query, push } = useRouter();

  const currentTokenId = auctionInfo ? auctionInfo?.tokenId : "";

  const tokenId = query.tokenid
    ? BigNumber.from(query.tokenid as string).toHexString()
    : currentTokenId;

  const { data: tokenInfo, mutate: mutateTokenInfo } = useTokenInfo({
    tokenId,
  });
  const [imageLoaded, setImageLoaded] = useState(false);

  const pageBack = () => {
    const bnTokenId = BigNumber.from(tokenId);
    if (bnTokenId.eq(0)) return;
    setImageLoaded(false);
    push(`/token/${bnTokenId.sub(1).toNumber()}`, undefined, {
      shallow: true,
    });
  };

  const pageForward = () => {
    const bnTokenId = BigNumber.from(tokenId);
    if (bnTokenId.eq(currentTokenId)) return;
    push(`/token/${bnTokenId.add(1).toNumber()}`, undefined, {
      shallow: true,
    });
  };

  return (
    <div className="bg-transparent flex w-full max-w-[374px] flex-col items-center justify-center gap-8 px-4 py-[48px] md:max-w-[500px] md:gap-16 md:px-10 md:py-[64px] lg:w-[1100px] lg:max-w-6xl lg:flex-row lg:items-start lg:justify-start">
      <div className="relative flex aspect-square w-full max-w-[342px] shrink-0 items-center justify-center overflow-hidden rounded-[48px] border-[3px] border-transparent/10 md:h-[420px] md:w-[420px] md:max-w-none md:rounded-[64px]">
        {tokenInfo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={tokenInfo?.image}
            onLoad={() => setImageLoaded(true)}
            alt=""
            className={clsx(
              "h-full w-full object-cover",
              imageLoaded ? "visible" : "invisible"
            )}
          />
        )}
        <Image
          src="/loading.gif"
          alt="loading"
          fill
          className={clsx(
            "bg-secondary",
            tokenInfo && imageLoaded ? "invisible" : "visible"
          )}
        />
      </div>
      <div className="flex w-full min-w-0 flex-col gap-6 overflow-hidden">
        <div className="flex items-center mb-4 gap-4">
          <Button
            variant="secondary"
            size="icon"
            className="yc-dark-yellow-button !bg-white !text-[#212529] shadow-[0px_4.02px_0px_0px_rgb(var(--color-shadow-neutral))] hover:!bg-[#fff7bf] hover:shadow-[0px_6px_0px_0px_rgb(var(--color-shadow-neutral))] disabled:!border disabled:!border-skin-stroke disabled:!bg-white disabled:!text-[#212529] disabled:!opacity-60"
            onClick={pageBack}
            disabled={tokenId == "0x00"}
          >
            <Image
              src="/arrow-left.svg"
              width={24}
              height={24}
              alt="back"
              className="brightness-0"
            />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="yc-dark-yellow-button !bg-white !text-[#212529] shadow-[0px_4.02px_0px_0px_rgb(var(--color-shadow-neutral))] hover:!bg-[#fff7bf] hover:shadow-[0px_6px_0px_0px_rgb(var(--color-shadow-neutral))] disabled:!border disabled:!border-skin-stroke disabled:!bg-white disabled:!text-[#212529] disabled:!opacity-60"
            onClick={pageForward}
            disabled={tokenId == currentTokenId}
          >
            <Image
              src="/arrow-right.svg"
              width={24}
              height={24}
              alt="back"
              className="brightness-0"
            />
          </Button>
        </div>

        <h1 className="text-[42px] leading-[46px] min-[360px]:text-[48px] min-[360px]:leading-[56px] md:text-[56px] md:leading-[64px]">
          Collective Noun #{parseInt(tokenId, 16)}
        </h1>

        <CurrentAuction
          auctionInfo={auctionInfo}
          contractInfo={contractInfo}
          tokenId={currentTokenId}
          tokenImage={tokenInfo?.image}
          hidden={tokenId != currentTokenId}
          revalidateAuctionInfo={async () => {
            await mutateCurrentAuctionInfo();
            await mutateTokenInfo();
            return;
          }}
        />
        <EndedAuction
          auctionContract={contractInfo?.auction}
          tokenId={tokenId}
          tokenImage={tokenInfo?.image}
          owner={tokenInfo?.owner}
          hidden={tokenId == currentTokenId}
        />
      </div>
    </div>
  );
}

const EndedAuction = ({
  auctionContract,
  tokenId,
  tokenImage,
  owner,
  hidden,
}: {
  auctionContract?: string;
  tokenId: string;
  tokenImage?: string;
  owner?: `0x${string}`;
  hidden: boolean;
}) => {
  const { data: auctionData } = usePreviousAuction({
    auctionContract,
    enabled: !hidden,
    tokenId,
  });
  const featuredBidComment = auctionData?.bids?.find(
    (bid) =>
      bid.comment?.trim() &&
      compareAddress(bid.bidder, auctionData.winner) &&
      BigNumber.from(bid.bidAmount || "0").eq(
        BigNumber.from(auctionData.amount || "0")
      )
  )?.comment;

  return (
    <div className="flex flex-col items-start">
      <div
        className={clsx(
          "flex flex-col md:flex-row md:flex-wrap justify-start w-full gap-6 pb-3",
          hidden && "hidden"
        )}
      >
        <div className="flex flex-col gap-2 shrink-0 min-w-[165px] md:pr-6">
          <div className="font-light">Winning Bid</div>
          <h3>
            {auctionData
              ? `Ξ ${formatNumber(utils.formatEther(auctionData.amount || "0"), 4)}`
              : "n/a"}
          </h3>
        </div>
        <div className="flex flex-col gap-2">
          <div className="font-light">Held by</div>
          <WalletInfo
            address={(owner || ethers.constants.AddressZero) as `0x${string}`}
            size="lg"
          />
        </div>
      </div>
      {!hidden && featuredBidComment && (
        <p className="mb-3 line-clamp-3 w-full max-w-[420px] rounded-[14px] bg-white px-4 py-3 text-sm leading-5 text-black">
          &ldquo;{featuredBidComment}&rdquo;
        </p>
      )}
      {auctionData?.amount != undefined && (
        <BidHistory
          tokenId={tokenId}
          tokenImage={tokenImage}
          bids={auctionData?.bids}
          numToShow={0}
          title="View bid history"
        />
      )}
    </div>
  );
};

const CurrentAuction = ({
  auctionInfo,
  contractInfo,
  tokenId,
  tokenImage,
  hidden,
  revalidateAuctionInfo,
}: {
  auctionInfo?: AuctionInfo;
  contractInfo?: ContractInfo;
  tokenImage?: string;
  tokenId: string;
  hidden: boolean;
  revalidateAuctionInfo: () => Promise<void>;
}) => {
  const [auctionOver, setAuctionOver] = useState<boolean>(false);

  useEffect(() => {
    const intervalId = setInterval(() => {
      const timeRemaining = Math.max(
        (auctionInfo?.endTime || 0) - Math.round(Date.now() / 1000),
        0
      );
      setAuctionOver(timeRemaining == 0);
    }, 1000);

    return () => clearInterval(intervalId);
  }, [auctionInfo]);

  return (
    <div
      className={clsx("flex flex-col w-full gap-6 pb-3", hidden && "hidden")}
    >
      <div className="grid w-full grid-cols-2 gap-3 md:flex md:flex-row md:flex-wrap md:justify-start md:gap-4">
        <div className="flex min-w-0 flex-col gap-2 md:min-w-[165px] md:shrink-0 md:pr-6">
          <div className="font-light">
            {auctionOver ? "Winning Bid" : "Current Bid"}
          </div>
          <h3 className="text-[24px] leading-[30px] min-[360px]:text-[32px] min-[360px]:leading-[40px] md:text-[36px] md:leading-[44px]">
            Ξ{" "}
            {formatNumber(utils.formatEther(auctionInfo?.highestBid || "0"), 4)}
          </h3>
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          <div className="font-light">
            {auctionOver ? "Winner" : "Auction ends in"}
          </div>
          {auctionOver ? (
            <WalletInfo
              address={auctionInfo?.highestBidder ?? zeroAddress}
              size="lg"
            />
          ) : (
            <CountdownDisplay
              to={auctionInfo?.endTime || "0"}
              className="text-[24px] leading-[30px] min-[360px]:text-[32px] min-[360px]:leading-[40px] md:text-[36px] md:leading-[44px]"
            />
          )}
        </div>
      </div>

      <SettleAuction
        auction={contractInfo?.auction}
        hidden={!auctionOver}
        onSettled={revalidateAuctionInfo}
      />
      <PlaceBid
        highestBid={auctionInfo?.highestBid || "0"}
        auction={contractInfo?.auction}
        tokenId={tokenId}
        hidden={auctionOver}
        onNewBid={revalidateAuctionInfo}
      />

      {!auctionOver &&
        auctionInfo?.highestBidder &&
        !compareAddress(
          auctionInfo?.highestBidder,
          ethers.constants.AddressZero
        ) && (
          <>
            <BidHistory
              tokenImage={tokenImage}
              tokenId={tokenId}
              bids={auctionInfo?.bids}
              numToShow={3}
              title="View all bids"
              shouldShowPreviewComment={(bid) =>
                compareAddress(bid.bidder, auctionInfo.highestBidder) &&
                BigNumber.from(bid.bidAmount || "0").eq(
                  BigNumber.from(auctionInfo.highestBid || "0")
                )
              }
            />
          </>
        )}
    </div>
  );
};
