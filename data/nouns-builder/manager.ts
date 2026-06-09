import { BuilderSDK } from "@buildersdk/sdk";
import DefaultProvider from "@/utils/DefaultProvider";
import { MANAGER_CONTRACT } from "constants/addresses";
import { YELLOW_COLLECTIVE_CONTRACTS } from "data/contracts";
import { getAddress } from "viem";

const { manager } = BuilderSDK.connect({ signerOrProvider: DefaultProvider });

export type DAOAddresses = {
  metadata: `0x${string}`;
  auction: `0x${string}`;
  treasury: `0x${string}`;
  governor: `0x${string}`;
};

export const getAddresses = async ({
  tokenAddress,
}: {
  tokenAddress: `0x${string}`;
}): Promise<DAOAddresses> => {
  try {
    const { metadata, auction, treasury, governor } = await manager({
      address: MANAGER_CONTRACT,
    }).getAddresses(tokenAddress);

    return { metadata, auction, treasury, governor };
  } catch (error) {
    if (
      getAddress(tokenAddress) ===
      getAddress(YELLOW_COLLECTIVE_CONTRACTS.nft.address)
    ) {
      console.warn(
        "Unable to load manager DAO addresses; using configured Yellow Collective contracts.",
        error
      );
      return {
        metadata: YELLOW_COLLECTIVE_CONTRACTS.metadata.address,
        auction: YELLOW_COLLECTIVE_CONTRACTS.auctionHouse.address,
        treasury: YELLOW_COLLECTIVE_CONTRACTS.treasury.address,
        governor: YELLOW_COLLECTIVE_CONTRACTS.governor.address,
      };
    }

    throw error;
  }
};
