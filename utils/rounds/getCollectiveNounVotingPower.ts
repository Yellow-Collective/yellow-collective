import { getBalanceOf } from "data/nouns-builder/token";
import DefaultProvider from "@/utils/DefaultProvider";
import { Contract } from "@/utils/ethers-compat";
import { getAddress, isAddress } from "viem";

export const ROUND_VOTING_TOKEN_CONTRACT =
  "0x220e41499CF4d93a3629a5509410CBf9E6E0B109" as const;

const balanceAbi = ["function balanceOf(address owner) view returns (uint256)"];

export const getCollectiveNounVotingPower = async (
  walletAddress: string,
  blockTag?: number
) => {
  if (!isAddress(walletAddress)) {
    throw new Error("Invalid wallet address.");
  }

  if (blockTag) {
    const contract = new Contract(
      ROUND_VOTING_TOKEN_CONTRACT,
      balanceAbi,
      DefaultProvider
    );
    const balance = await contract.balanceOf(getAddress(walletAddress), {
      blockTag,
    });

    return Number(balance.toString());
  }

  const balance = await getBalanceOf({
    address: ROUND_VOTING_TOKEN_CONTRACT,
    user: getAddress(walletAddress),
  });

  return Number(balance.toString());
};

export const getBlockNumberAtOrBeforeTimestamp = async (timestamp: string) => {
  const target = Math.floor(new Date(timestamp).getTime() / 1000);
  if (!Number.isFinite(target)) {
    throw new Error("Invalid snapshot timestamp.");
  }

  const latestNumber = await DefaultProvider.getBlockNumber();
  const latestBlock = await DefaultProvider.getBlock(latestNumber);
  if (!latestBlock || latestBlock.timestamp <= target) return latestNumber;

  let low = 0;
  let high = latestNumber;
  let best = 0;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const block = await DefaultProvider.getBlock(mid);
    if (!block) break;

    if (block.timestamp <= target) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return best;
};
