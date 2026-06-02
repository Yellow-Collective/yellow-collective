import { RPC_CHAIN_ID, RPC_URL_LIST } from "configs/wallet";
import { providers } from "@/utils/ethers-compat";

const provider: any = new providers.FallbackProvider(
  RPC_URL_LIST.map((rpcUrl, index) => ({
    provider: new providers.StaticJsonRpcProvider(rpcUrl, RPC_CHAIN_ID),
    priority: index + 1,
    stallTimeout: 1000,
  })),
  RPC_CHAIN_ID,
  { quorum: 1 }
);

provider.getStorageAt = provider.getStorage.bind(provider);

export default provider;
