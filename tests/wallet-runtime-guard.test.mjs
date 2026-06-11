import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { BigNumber, providers } from "ethers";
import { Interface } from "ethers6";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Farcaster Mini App connector stays out of the normal wallet config", () => {
  const walletConfig = read("configs/wallet.ts");

  assert.equal(walletConfig.includes("FarcasterMiniAppConnector"), false);
  assert.equal(walletConfig.includes("farcaster-mini-app-connector"), false);
});

test("Mini App wallet connection is explicit and gated by runtime detection", () => {
  const appConfig = read("pages/_app.tsx");
  const customConnectButton = read("components/CustomConnectButton.tsx");
  const miniAppWalletHook = read("hooks/useMiniAppWalletConnect.ts");
  const placeBid = read("components/Hero/PlaceBid.tsx");
  const settleAuction = read("components/Hero/SettleAuction.tsx");

  assert.equal(appConfig.includes("MiniAppWalletAutoConnect"), false);
  assert.match(miniAppWalletHook, /await isInMiniApp\(\)/);
  assert.match(miniAppWalletHook, /await import\(\s*["']\.\.\/configs\/farcaster-mini-app-connector["']\s*\)/);
  assert.match(miniAppWalletHook, /https:\/\/rnbwapp\.com\/dapp\?url=/);
  assert.match(miniAppWalletHook, /sdk\?\.actions\.openUrl/);
  assert.match(customConnectButton, /useMiniAppWalletConnect/);
  assert.match(customConnectButton, /Open in Rainbow/);
  assert.match(customConnectButton, /Open in browser/);
  assert.match(customConnectButton, /Continue with Farcaster Wallet/);
  assert.match(placeBid, /isMiniApp[\s\S]*connectMiniAppWallet\(\)[\s\S]*openConnectModal\?\.\(\)/);
  assert.match(settleAuction, /isMiniApp[\s\S]*connectMiniAppWallet\(\)[\s\S]*openConnectModal\?\.\(\)/);
});

test("CSP allows the imported Google font stylesheet and font files", () => {
  const nextConfig = read("next.config.js");

  assert.match(nextConfig, /style-src[\s\S]*https:\/\/fonts\.googleapis\.com/);
  assert.match(nextConfig, /font-src[\s\S]*https:\/\/fonts\.gstatic\.com/);
  assert.match(nextConfig, /img-src[\s\S]*https:\/\/explorer-api\.walletconnect\.com/);
});

test("Wagmi receives an ethers v5 provider with synchronous network chainId", () => {
  const provider = new providers.StaticJsonRpcProvider("https://mainnet.base.org", {
    chainId: 8453,
    name: "base",
  });

  assert.equal(provider.network.chainId, 8453);
});

test("BuilderSDK server providers stay on ethers v5", () => {
  const defaultProvider = read("utils/DefaultProvider.ts");
  const mainnetProvider = read("utils/MainnetProvider.ts");

  for (const providerFile of [defaultProvider, mainnetProvider]) {
    assert.match(providerFile, /import \{ providers \} from "ethers"/);
    assert.equal(providerFile.includes("@/utils/ethers-compat"), false);
    assert.match(providerFile, /new providers\.FallbackProvider/);
  }
});

test("treasury API returns a primitive balance string", () => {
  const treasuryApi = read("pages/api/treasury/[address].tsx");
  const treasuryHook = read("hooks/fetch/useTreasuryBalance.tsx");

  assert.match(treasuryApi, /res\.json\(treasuryBalance\.toString\(\)\)/);
  assert.match(treasuryHook, /useSWR<string>/);
  assert.equal(treasuryApi.includes("res.send(treasuryBalance);"), false);
});

test("previous auction fetch waits for auction contract and token id", () => {
  const previousAuctionHook = read("hooks/fetch/usePreviousAuctions.tsx");
  const hero = read("components/Hero/Hero.tsx");

  assert.equal(previousAuctionHook.includes("TOKEN_CONTRACT"), false);
  assert.match(previousAuctionHook, /enabled && auctionContract && tokenId/);
  assert.match(previousAuctionHook, /\/api\/auction\/\$\{auctionContract\}\/previous\/\$\{tokenId\}/);
  assert.match(hero, /usePreviousAuction\(\{\s*auctionContract,\s*enabled: !hidden,\s*tokenId,/);
});

test("bid calldata uses ethers6-compatible token id values", () => {
  const placeBid = read("components/Hero/PlaceBid.tsx");

  assert.equal(placeBid.includes("BigNumber.from(tokenId || 1)"), false);
  assert.match(
    placeBid,
    /createBidWithReferral[\s\S]*\[tokenId \|\| "1", COLLECTIVE_NOUNS_TREASURY\]/
  );

  const auctionInterface = new Interface([
    {
      inputs: [
        { internalType: "uint256", name: "_tokenId", type: "uint256" },
        { internalType: "address", name: "_referral", type: "address" },
      ],
      name: "createBidWithReferral",
      outputs: [],
      stateMutability: "payable",
      type: "function",
    },
  ]);

  assert.doesNotThrow(() =>
    auctionInterface.encodeFunctionData("createBidWithReferral", [
      "0x00",
      "0x55333306a4c6e74eb9e23a521a24fb78be2de92c",
    ])
  );
});

test("auction bid preparation uses serializable ethers v5 BigNumber values", () => {
  const placeBid = read("components/Hero/PlaceBid.tsx");

  assert.match(
    placeBid,
    /const parseBidAmount = \(value: string\): BigNumber \| undefined/
  );
  assert.match(
    placeBid,
    /BigNumber\.from\(utils\.parseEther\(value\)\.toString\(\)\)/
  );
  assert.equal(placeBid.includes("return value ? utils.parseEther(value)"), false);
  assert.match(placeBid, /const isPreparedBidValid = parsedBid[\s\S]*parsedBid\.gt\(ZERO_BID\)[\s\S]*parsedBid\.gte\(nextBidAmount\)/);
  assert.match(placeBid, /const canPrepareBid = Boolean\([\s\S]*isConnected[\s\S]*!commentError/);
  assert.match(placeBid, /request: canPrepareBid && auction && finalBidCalldata && parsedBid/);
  assert.match(placeBid, /const toSafeBigNumber/);
  assert.match(placeBid, /const isZeroBalanceValue/);

  assert.throws(() => JSON.stringify({ value: 1n }), /BigInt/);
  assert.doesNotThrow(() => JSON.stringify({ value: BigNumber.from("1") }));
});
