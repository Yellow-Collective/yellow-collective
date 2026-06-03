import {
  FARCASTER_MINI_APP_CONNECTOR_ID,
  FarcasterMiniAppConnector,
} from "../../configs/farcaster-mini-app-connector";
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

      const connector = connectors.find(
        (availableConnector) =>
          availableConnector.id === FARCASTER_MINI_APP_CONNECTOR_ID
      );

      if (!(connector instanceof FarcasterMiniAppConnector)) return;

      try {
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
