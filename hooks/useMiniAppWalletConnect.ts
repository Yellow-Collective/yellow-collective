import { isInMiniApp, loadMiniAppSdk } from "@/utils/farcasterMiniApp";
import { useCallback, useEffect, useRef, useState } from "react";
import { useConnect } from "wagmi";
import { chains } from "../configs/wallet";

const getCurrentUrl = () =>
  typeof window === "undefined"
    ? "https://yellowcollective.art"
    : window.location.href;

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
  const [miniAppConnectionError, setMiniAppConnectionError] =
    useState<unknown>();
  const connectingRef = useRef(false);

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
    if (connectingRef.current) return;

    connectingRef.current = true;
    setMiniAppConnectionError(undefined);
    setIsConnectingMiniApp(true);

    try {
      const { FarcasterMiniAppConnector } =
        await import("../configs/farcaster-mini-app-connector");

      await connectAsync({
        connector: new FarcasterMiniAppConnector({ chains }),
        chainId: chains[0]?.id,
      });
    } catch (error) {
      setMiniAppConnectionError(error);
    } finally {
      connectingRef.current = false;
      setIsConnectingMiniApp(false);
    }
  }, [connectAsync]);

  const openInBrowser = useCallback(async () => {
    await openExternalUrl(getCurrentUrl());
  }, []);

  const openInRainbow = useCallback(async () => {
    await openExternalUrl(getRainbowBrowserUrl(getCurrentUrl()));
  }, []);

  return {
    connectMiniAppWallet,
    isConnectingMiniApp,
    miniAppConnectionError,
    isMiniApp,
    openInBrowser,
    openInRainbow,
  };
};
