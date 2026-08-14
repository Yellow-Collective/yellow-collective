const fs = require("fs");
const path = require("path");

const IPFS_GATEWAY =
  process.env.NEXT_PUBLIC_IPFS_GATEWAY || "https://gateway.pinata.cloud";
const isDevelopment = process.env.NODE_ENV !== "production";
const farcasterMiniAppSdkPath = path.join(
  __dirname,
  "node_modules",
  "@farcaster",
  "miniapp-sdk"
);
const nobleHashesPath = path.join(
  __dirname,
  "node_modules",
  "@noble",
  "hashes"
);

// CSP external domains:
// api.goldsky.com: Builder/Nouns subgraph reads.
// api.coingecko.com: token price reads.
// nouns.build, evm.stupidtech.net: Builder app metadata and RPC reads.
// *.g.alchemy.com, publicnode, cloudflare-eth, Base, Zora RPC: wallet/provider RPC traffic.
// chain-proxy.wallet.coinbase.com: Coinbase Wallet Base JSON-RPC relay.
// *.walletconnect.com, *.walletconnect.org: WalletConnect modal and relay traffic.
// vitals.vercel-insights.com: Vercel Analytics.
// api.zora.co, zora.co, IPFS/Arweave gateways, imagedelivery.net, wrpcd.net,
// postimg, hackmd, Farcaster/Warpcast, twimg, metadata.ens.domains: existing
// token, project, Farcaster, ENS, and legacy community media.
// Farcaster/Warpcast frame ancestors are required for Mini App embedding, so
// X-Frame-Options is intentionally omitted because DENY would break that flow.
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
  "frame-ancestors 'self' https://farcaster.xyz https://*.farcaster.xyz https://warpcast.com https://*.warpcast.com",
  [
    "script-src",
    "'self'",
    "'unsafe-inline'",
    ...(isDevelopment ? ["'unsafe-eval'"] : []),
  ].join(" "),
  [
    "style-src",
    "'self'",
    "'unsafe-inline'",
    "https://fonts.googleapis.com",
  ].join(" "),
  [
    "connect-src",
    "'self'",
    "https://api.goldsky.com",
    "https://api.coingecko.com",
    "https://nouns.build",
    "https://evm.stupidtech.net",
    "https://*.g.alchemy.com",
    "https://eth.llamarpc.com",
    "https://ethereum.publicnode.com",
    "https://ethereum-goerli.publicnode.com",
    "https://cloudflare-eth.com",
    "https://mainnet.base.org",
    "https://goerli.base.org",
    "https://sepolia.base.org",
    "https://chain-proxy.wallet.coinbase.com",
    "https://rpc.zora.energy",
    "https://testnet.rpc.zora.energy",
    "https://*.walletconnect.com",
    "wss://*.walletconnect.com",
    "https://*.walletconnect.org",
    "wss://*.walletconnect.org",
    "https://vitals.vercel-insights.com",
  ].join(" "),
  [
    "img-src",
    "'self'",
    "data:",
    "blob:",
    "https://api.zora.co",
    "https://zora.co",
    "https://nouns.build",
    "https://gateway.pinata.cloud",
    "https://nouns-builder.mypinata.cloud",
    "https://*.mypinata.cloud",
    "https://ipfs.io",
    "https://cloudflare-ipfs.com",
    "https://arweave.net",
    "https://imagedelivery.net",
    "https://wrpcd.net",
    "https://i.postimg.cc",
    "https://hackmd.io",
    "https://warpcast.com",
    "https://farcaster.xyz",
    "https://*.twimg.com",
    "https://metadata.ens.domains",
    "https://explorer-api.walletconnect.com",
  ].join(" "),
  [
    "font-src",
    "'self'",
    "data:",
    "https://fonts.gstatic.com",
  ].join(" "),
  "frame-src 'self' https://*.walletconnect.com https://*.walletconnect.org",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "media-src 'self' data: blob:",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: contentSecurityPolicy,
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), usb=(), payment=(), bluetooth=(), accelerometer=(), gyroscope=()",
  },
  {
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin-allow-popups",
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    staticGenerationMaxConcurrency: 1,
    staticGenerationMinPagesPerWorker: 1000,
  },
  images: {
    remotePatterns: [
      // Zora renderer URLs used by token and Builder media.
      {
        protocol: "https",
        hostname: "api.zora.co",
        pathname: "/renderer/**",
      },
      // Builder renderer URLs used by Collective Noun token artwork.
      {
        protocol: "https",
        hostname: "nouns.build",
        pathname: "/api/renderer/**",
      },
      // Primary IPFS gateway configured for app media.
      {
        protocol: "https",
        hostname: "gateway.pinata.cloud",
      },
      // Legacy community-project media.
      {
        protocol: "https",
        hostname: "nouns-builder.mypinata.cloud",
      },
      // Pinned community/project media hosted on Cloudflare Images.
      {
        protocol: "https",
        hostname: "imagedelivery.net",
      },
      {
        protocol: "https",
        hostname: "wrpcd.net",
      },
      // Legacy external media used by existing approved community projects.
      {
        protocol: "https",
        hostname: "i.postimg.cc",
      },
      {
        protocol: "https",
        hostname: "hackmd.io",
      },
      // Normalized IPFS and Arweave fallbacks.
      {
        protocol: "https",
        hostname: "ipfs.io",
      },
      {
        protocol: "https",
        hostname: "arweave.net",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/token/:tokenid",
        destination: "/?tokenid=:tokenid",
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-store, max-age=0",
          },
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [
          {
            key: "Content-Type",
            value: "application/manifest+json; charset=utf-8",
          },
        ],
      },
      {
        source: "/.well-known/farcaster.json",
        headers: [
          {
            key: "Content-Type",
            value: "application/json; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "public, max-age=300, must-revalidate",
          },
        ],
      },
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, max-age=0",
          },
        ],
      },
    ];
  },
};

nextConfig.webpack = (config) => {
  config.resolve = config.resolve || {};
  config.resolve.alias = {
    ...(config.resolve.alias || {}),
    // Keep viem's noble-curve imports paired with the root hashes version.
    "@noble/hashes": nobleHashesPath,
  };

  if (!fs.existsSync(farcasterMiniAppSdkPath)) {
    config.resolve.alias["@farcaster/miniapp-sdk"] = path.resolve(
      __dirname,
      "utils/farcasterMiniAppSdkShim.ts"
    );
  }

  return config;
};

module.exports = nextConfig;
