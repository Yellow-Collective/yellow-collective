import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { providers } from "ethers";
import { Interface } from "ethers6";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("wallet config does not register the Farcaster Mini App connector globally", () => {
  const walletConfig = read("configs/wallet.ts");
  const appConfig = read("pages/_app.tsx");

  assert.equal(walletConfig.includes("FarcasterMiniAppConnector"), false);
  assert.equal(walletConfig.includes("farcaster-mini-app-connector"), false);
  assert.equal(appConfig.includes("MiniAppWalletAutoConnect"), false);
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
