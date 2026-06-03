import "../styles/globals.css";
import type { AppProps } from "next/app";
import { WagmiConfig } from "wagmi";
import { wagmiClient, chains } from "../configs/wallet";
import { RainbowKitProvider, lightTheme } from "@rainbow-me/rainbowkit";
import { SWRConfig } from "swr";
import { useInitTheme } from "@/hooks/useInitTheme";
import localFont from "next/font/local";
import Head from "next/head";
import { Analytics } from "@vercel/analytics/react";
import MiniAppReady from "@/components/MiniApp/MiniAppReady";
import MiniAppWalletAutoConnect from "@/components/MiniApp/MiniAppWalletAutoConnect";
import PWARegister from "@/components/PWARegister";
import {
  LEGACY_FRAME_EMBED_JSON,
  MINI_APP_EMBED_JSON,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_SHORT_NAME,
  SITE_THEME_COLOR,
  getAbsoluteUrl,
} from "@/utils/site";
import { useEffect, useState } from "react";

export const pally = localFont({
  src: "../styles/Pally-Variable.ttf",
  display: "swap",
  variable: "--font-pally",
});

const MyApp = ({ Component, pageProps }: AppProps) => {
  useInitTheme();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const appContent = (
    <>
      <Head>
        <title>{SITE_NAME}</title>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <meta name="description" content={SITE_DESCRIPTION} />
        <meta name="application-name" content={SITE_NAME} />
        <meta name="theme-color" content={SITE_THEME_COLOR} />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content={SITE_SHORT_NAME} />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta property="og:title" content={SITE_NAME} />
        <meta property="og:description" content={SITE_DESCRIPTION} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={getAbsoluteUrl("/")} />
        <meta property="og:image" content={getAbsoluteUrl("/og-image.png")} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={SITE_NAME} />
        <meta name="twitter:description" content={SITE_DESCRIPTION} />
        <meta name="twitter:image" content={getAbsoluteUrl("/og-image.png")} />
        <meta name="fc:miniapp" content={MINI_APP_EMBED_JSON} />
        <meta name="fc:frame" content={LEGACY_FRAME_EMBED_JSON} />
      </Head>

      <main className={pally.variable}>
        <MiniAppReady />
        <MiniAppWalletAutoConnect />
        <PWARegister />
        <Component {...pageProps} />
        <Analytics />
      </main>
    </>
  );

  return (
    <SWRConfig
      value={{
        fetcher: (resource, init) =>
          fetch(resource, init).then((res) => res.json()),
      }}
    >
      <WagmiConfig client={wagmiClient}>
        {isMounted ? (
          <RainbowKitProvider chains={chains}>{appContent}</RainbowKitProvider>
        ) : (
          appContent
        )}
      </WagmiConfig>
    </SWRConfig>
  );
};
export default MyApp;
