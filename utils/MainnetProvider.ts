import { MAINNET_RPC_URLS } from "configs/wallet";
import { providers } from "ethers";

const provider: any = new providers.FallbackProvider(
  MAINNET_RPC_URLS.map((rpcUrl, index) => ({
    provider: new providers.StaticJsonRpcProvider(rpcUrl, 1),
    priority: index + 1,
    stallTimeout: 1000,
  })),
  1
);

export default provider;
