import Header from "../components/Header";
import { useIsMounted } from "hooks/useIsMounted";
import Hero from "../components/Hero/Hero";
import { GetStaticPropsResult, InferGetStaticPropsType } from "next";
import { SWRConfig } from "swr";
import { ContractInfo, TokenInfo } from "data/nouns-builder/token";
import { AuctionInfo } from "data/nouns-builder/auction";
import Footer from "@/components/Footer";
import Banner from "@/components/Banner";
import Faq from "@/components/Faq";
import Description from "@/components/Description";
import { TOKEN_CONTRACT } from "constants/addresses";
import { YELLOW_COLLECTIVE_CONTRACTS } from "data/contracts";
import { zeroAddress } from "viem";

const fallbackContract: ContractInfo = {
  name: "Collective Nouns",
  description: "ERC-721 membership and artwork contract for Collective Nouns.",
  image: "",
  external_url: "",
  total_supply: "0x00",
  auction: YELLOW_COLLECTIVE_CONTRACTS.auctionHouse.address,
};

const fallbackAuction: AuctionInfo = {
  tokenId: "0x00",
  highestBid: "0x00",
  highestBidder: zeroAddress,
  startTime: 0,
  endTime: 0,
  settled: true,
  bids: [],
};

const fallbackToken: TokenInfo = {
  name: "Collective Noun #0",
  image: "",
  owner: zeroAddress,
};

export const getStaticProps = async (): Promise<
  GetStaticPropsResult<{
    tokenContract: string;
    tokenId: string;
    contract: ContractInfo;
    token: TokenInfo;
    auction: AuctionInfo;
  }>
> => {
  const tokenContract = TOKEN_CONTRACT as `0x${string}`;
  const contract = fallbackContract;
  const auction = fallbackAuction;
  const tokenId = auction.tokenId;
  const token = fallbackToken;

  if (!contract.image) contract.image = "";

  return {
    props: {
      tokenContract,
      tokenId,
      contract,
      token,
      auction,
    },
    revalidate: 60,
  };
};

export default function SiteComponent({
  tokenContract,
  tokenId,
  contract,
  token,
  auction,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  const isMounted = useIsMounted();

  return (
    <SWRConfig
      value={{
        fallback: {
          [`/api/token/${tokenContract}`]: contract,
          [`/api/token/${tokenContract}/${tokenId}`]: token,
          [`/api/auction/${contract.auction}`]: auction,
        },
      }}
    >
      {isMounted && (
        <div className="flex min-h-dvh w-full flex-col items-center justify-start bg-skin-backdrop text-skin-base">
          <Banner />
          <div className="max-w-[1400px] w-full">
            <Header />
          </div>
          <Hero />
          <Description />
          <Faq />
          <Footer />
        </div>
      )}
    </SWRConfig>
  );
}
