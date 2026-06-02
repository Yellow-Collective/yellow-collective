import { BigNumber, utils } from "@/utils/ethers-compat";

export const formatTreasuryBalance = (balance: BigNumber) => {
  const balanceEth = parseFloat(utils.formatEther(balance || 0));
  if (balanceEth > 1000) return balanceEth.toFixed(2);
  if (balanceEth > 100) return balanceEth.toFixed(3);
  return balanceEth.toFixed(4);
};
