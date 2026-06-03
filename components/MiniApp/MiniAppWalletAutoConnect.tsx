import { isInMiniApp } from "@/utils/farcasterMiniApp";
import { useEffect } from "react";
import { useAccount, useConnect } from "wagmi";
import { chains } from "../../configs/wallet";

export default function MiniAppWalletAutoConnect() {
  const { isConnected } = useAccount();
  const { connectAsync, connectors } = useConnect();

  useEffect(() => {
    let cancelled = false;

    const connectMiniAppWallet = async () => {
      if (isConnected) return;

      const inMiniApp = await isInMiniApp();
      if (!inMiniApp || cancelled) return;

      try {
        const { FarcasterMiniAppConnector } = await import(
          "../../configs/farcaster-mini-app-connector"
        );
        const connector =
          connectors.find(
            (availableConnector) => availableConnector.id === "farcasterMiniApp"
          ) ?? new FarcasterMiniAppConnector({ chains });

        await connectAsync({
          connector,
          chainId: chains[0]?.id,
        });
      } catch (error) {
        console.warn("Unable to connect Farcaster Mini App wallet", error);
      }
    };

    connectMiniAppWallet();

    return () => {
      cancelled = true;
    };
  }, [connectAsync, connectors, isConnected]);

  return null;
}
