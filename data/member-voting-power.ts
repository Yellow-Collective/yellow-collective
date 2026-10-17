import { RPC_URL_LIST } from "configs/wallet";
import { TOKEN_CONTRACT } from "constants/addresses";
import { collectWithDeadline } from "@/utils/collect-with-deadline";
import { createPublicClient, fallback, getAddress, http, parseAbi } from "viem";

const client = createPublicClient({
  transport: fallback(
    RPC_URL_LIST.map((url) => http(url, { timeout: 2_500, retryCount: 0 })),
    {
      retryCount: 0,
    }
  ),
});
const abi = parseAbi([
  "function getVotes(address account) view returns (uint256)",
]);

export async function getMemberVotingPower(addresses: string[]) {
  const batches = Array.from(
    { length: Math.ceil(addresses.length / 50) },
    (_, index) => addresses.slice(index * 50, index * 50 + 50)
  );
  const results = await collectWithDeadline(
    batches,
    async (batch) => {
      const votes = await client.multicall({
        multicallAddress: "0xcA11bde05977b3631167028862bE2a173976CA11",
        batchSize: 0,
        contracts: batch.map((address) => ({
          address: getAddress(TOKEN_CONTRACT),
          abi,
          functionName: "getVotes" as const,
          args: [getAddress(address)] as const,
        })),
      });
      return votes.flatMap((vote, index) =>
        vote.status === "success"
          ? [[batch[index].toLowerCase(), Number(vote.result)] as const]
          : []
      );
    },
    { concurrency: 2, timeoutMs: 6_000 }
  );
  const powers = new Map(results.flat());
  if (powers.size !== addresses.length) {
    console.warn("Member voting power incomplete", {
      loaded: powers.size,
      requested: addresses.length,
    });
  }
  return powers;
}
