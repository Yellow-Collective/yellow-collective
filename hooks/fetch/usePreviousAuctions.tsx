import useSWR from "swr";
import { PreviousAuction } from "@/services/nouns-builder/auction";

export const usePreviousAuction = ({
  auctionContract,
  enabled = true,
  tokenId,
}: {
  auctionContract?: string;
  enabled?: boolean;
  tokenId: string;
}) => {
  return useSWR<PreviousAuction>(
    enabled && auctionContract && tokenId
      ? `/api/auction/${auctionContract}/previous/${tokenId}`
      : undefined
  );
};
