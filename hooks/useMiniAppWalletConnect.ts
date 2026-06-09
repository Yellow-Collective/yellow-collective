import { isInMiniApp, loadMiniAppSdk } from "@/utils/farcasterMiniApp";
import { useCallback, useEffect, useState } from "react";
import { useConnect } from "wagmi";
import { chains } from "../configs/wallet";

const getCurrentUrl = () =>
  typeof window === "undefined" ? "https://yellowcollective.art" : window.location.href;

const getRainbowBrowserUrl = (url: string) =>
  `https://rnbwapp.com/dapp?url=${encodeURIComponent(url)}`;

const openExternalUrl = async (url: string) => {
  const sdk = await loadMiniAppSdk();

  if (sdk?.actions.openUrl) {
    await sdk.actions.openUrl(url);
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
};

export const useMiniAppWalletConnect = () => {
  const { connectAsync } = useConnect();
  const [isMiniApp, setIsMiniApp] = useState(false);
  const [isConnectingMiniApp, setIsConnectingMiniApp] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const detectMiniApp = async () => {
      const inMiniApp = await isInMiniApp();
      if (!cancelled) setIsMiniApp(inMiniApp);
    };

    detectMiniApp();

    return () => {
      cancelled = true;
    };
  }, []);

  const connectMiniAppWallet = useCallback(async () => {
    if (isConnectingMiniApp) return;

    setIsConnectingMiniApp(true);

    try {
      const { FarcasterMiniAppConnector } = await import(
        "../configs/farcaster-mini-app-connector"
      );

      await connectAsync({
        connector: new FarcasterMiniAppConnector({ chains }),
        chainId: chains[0]?.id,
      });
    } catch (error) {
      console.warn("Unable to connect Farcaster Mini App wallet", error);
    } finally {
      setIsConnectingMiniApp(false);
    }
  }, [connectAsync, isConnectingMiniApp]);

  const openInBrowser = useCallback(async () => {
    await openExternalUrl(getCurrentUrl());
  }, []);

  const openInRainbow = useCallback(async () => {
    await openExternalUrl(getRainbowBrowserUrl(getCurrentUrl()));
  }, []);

  return {
    connectMiniAppWallet,
    isConnectingMiniApp,
    isMiniApp,
    openInBrowser,
    openInRainbow,
  };
};
