import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, isAbsolute, resolve } from "node:path";
import vm from "node:vm";
import test from "node:test";
import * as core from "@wagmi/core";
import { BigNumber, providers } from "ethers";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const read = (path) =>
  readFileSync(isAbsolute(path) ? path : new URL(`../${path}`, import.meta.url), "utf8");
const load = (path, overrides) => {
  const module = { exports: {} };
  const { outputText } = ts.transpileModule(read(path), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
    },
  });
  vm.runInNewContext(outputText, {
    module,
    exports: module.exports,
    window: { addEventListener() {}, removeEventListener() {} },
    console,
    TextEncoder,
    require: (name) =>
      Object.hasOwn(overrides, name) ? overrides[name] : require(name),
  });
  return module.exports;
};

const account = "0x1111111111111111111111111111111111111111";
const auction = "0x2222222222222222222222222222222222222222";
const hash = `0x${"ab".repeat(32)}`;
const base = {
  id: 8453,
  name: "Base",
  network: "base",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://example.invalid"] } },
};

const setup = async (chainId = 8453, estimateGasError) => {
  const requests = [];
  const provider = {
    request: async (request) => {
      requests.push(request);
      switch (request.method) {
        case "eth_requestAccounts":
        case "eth_accounts":
          return [account];
        case "eth_chainId":
          return `0x${chainId.toString(16)}`;
        case "eth_estimateGas":
          if (estimateGasError) throw estimateGasError;
          return "0x186a0";
        case "eth_sendTransaction":
          return hash;
        default:
          throw new Error(`Unexpected synthetic RPC: ${request.method}`);
      }
    },
    on() {},
    removeListener() {},
  };
  const { FarcasterMiniAppConnector } = load(
    "configs/farcaster-mini-app-connector.ts",
    {
      "@wagmi/core": core,
      "@/utils/farcasterMiniApp": {
        getMiniAppEthereumProvider: async () => provider,
        isInMiniApp: async () => true,
      },
    }
  );
  const connector = new FarcasterMiniAppConnector({ chains: [base] });
  const client = core.createClient({
    autoConnect: false,
    connectors: [connector],
    provider: new providers.StaticJsonRpcProvider(
      "https://example.invalid",
      base.id
    ),
  });
  await core.connect({ connector });
  return { connector, client, requests };
};

test("Farcaster signer prepares and sends a bid through installed Wagmi without losing payload fields", async () => {
  const { connector, client, requests } = await setup();
  try {
    const signer = await connector.getSigner({ chainId: 8453 });
    const request = {
      to: auction,
      data: "0x1234abcd",
      value: BigNumber.from("1100000000000000"),
    };
    const config = await core.prepareSendTransaction({
      chainId: 8453,
      signer,
      request,
    });
    assert.equal(signer.provider.network.chainId, 8453);
    assert.equal(BigNumber.isBigNumber(config.request.gasLimit), true);
    const result = await core.sendTransaction(config);
    assert.equal(result.hash, hash);
    const sent = requests.filter(
      ({ method }) => method === "eth_sendTransaction"
    );
    assert.equal(sent.length, 1);
    assert.equal(sent[0].params[0].from.toLowerCase(), account);
    assert.equal(sent[0].params[0].to.toLowerCase(), auction);
    assert.equal(sent[0].params[0].data, request.data);
    assert.equal(
      BigInt(sent[0].params[0].value),
      BigInt(request.value.toString())
    );
  } finally {
    await core.disconnect();
  }
});

test("a wallet that rejects gas estimation still reproduces the remaining preparation failure", async () => {
  const { connector, requests } = await setup(8453, {
    code: 4200,
    message: "Unsupported eth_estimateGas",
  });
  try {
    const signer = await connector.getSigner({ chainId: 8453 });
    await assert.rejects(
      core.prepareSendTransaction({
        chainId: 8453,
        signer,
        request: {
          to: auction,
          data: "0x1234",
          value: BigNumber.from("1100000000000000"),
        },
      })
    );
    assert.equal(
      requests.some(({ method }) => method === "eth_estimateGas"),
      true
    );
    assert.equal(
      requests.some(({ method }) => method === "eth_sendTransaction"),
      false
    );
  } finally {
    await core.disconnect();
  }
});

test("Wagmi refuses a bid on a different active chain before sending", async () => {
  const { connector, client, requests } = await setup(1);
  try {
    const signer = await connector.getSigner();
    await assert.rejects(
      core.prepareSendTransaction({
        chainId: 8453,
        signer,
        request: { to: auction, data: "0x1234", value: BigNumber.from(1) },
      }),
      /chain|network/i
    );
    assert.equal(
      requests.some(({ method }) => method === "eth_sendTransaction"),
      false
    );
  } finally {
    await core.disconnect();
  }
});

// Execute the real component with controlled hook results; no browser wallet or RPC is used.
const createHookHarness = () => {
  const slots = [];
  let cursor = 0;
  const React = require("react");
  return {
    begin() {
      cursor = 0;
    },
    react: {
      ...React,
      useState(initial) {
        const index = cursor++;
        if (!(index in slots)) slots[index] = initial;
        return [
          slots[index],
          (value) => {
            slots[index] =
              typeof value === "function" ? value(slots[index]) : value;
          },
        ];
      },
      useRef(initial) {
        const index = cursor++;
        if (!(index in slots)) slots[index] = { current: initial };
        return slots[index];
      },
      useMemo: (fn) => fn(),
      useCallback: (fn) => fn,
      useEffect() {},
    },
  };
};
const nodes = (tree) => {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== "object") return [];
  return [tree, ...nodes(tree.props?.children)];
};
const textContent = (tree) => {
  if (Array.isArray(tree)) return tree.map(textContent).join(" ");
  if (tree == null || typeof tree === "boolean") return "";
  return typeof tree === "object"
    ? textContent(tree.props?.children)
    : String(tree);
};
const bidComments = load("utils/bid-comments.ts", {});
const errorHelpers = load("utils/auction-wallet-error.ts", {});
const nativeBid = load("utils/miniapp-auction-bid.ts", {
  "./auction-wallet-error": errorHelpers,
});
const { auctionAbi } = load("abis/auction.ts", {});
const ethersCompat = load("utils/ethers-compat.ts", {});

const createBidHarness = () => {
  const hooks = createHookHarness();
  const state = {
    account: { address: account, isConnected: true },
    chain: { id: 8453 },
    miniApp: {
      isMiniApp: true,
      isConnectingMiniApp: false,
      miniAppConnectionError: undefined,
    },
    prepareError: undefined,
    isPreparing: false,
    prepared: true,
    send: { isLoading: false, error: undefined, data: undefined },
    receipt: { isLoading: false, isSuccess: false, error: undefined },
    debounce: undefined,
    writes: 0,
    connects: 0,
    webConnects: 0,
    checks: 0,
    retries: 0,
  };
  state.miniApp.connectMiniAppWallet = () => {
    state.connects++;
  };
  let sendOptions;
  let receiptOptions;
  const { PlaceBid } = load("components/Hero/PlaceBid.tsx", {
    react: hooks.react,
    "next/image": { default: "img", __esModule: true },
    "../Button": { default: "button", __esModule: true },
    "../ExternalLink": { default: "a", __esModule: true },
    "@rainbow-me/rainbowkit": {
      useConnectModal: () => ({
        openConnectModal: () => {
          state.webConnects++;
        },
      }),
    },
    "@vercel/analytics": { track() {} },
    "@/hooks/useMiniAppWalletConnect": {
      useMiniAppWalletConnect: () => state.miniApp,
    },
    "@/hooks/useDebounce": { useDebounce: (value) => state.debounce ?? value },
    "@/utils/ethers-compat": ethersCompat,
    "@/utils/bid-comments": bidComments,
    "@/utils/auction-wallet-error": errorHelpers,
    "@/utils/miniapp-auction-bid": nativeBid,
    "abis/auction": { auctionAbi },
    "constants/addresses": { COLLECTIVE_NOUNS_TREASURY: account },
    wagmi: {
      useAccount: () => state.account,
      useNetwork: () => ({ chain: state.chain }),
      useBalance: () => ({
        data: { value: BigNumber.from("1000000000000000000") },
      }),
      usePrepareSendTransaction: (options) => ({
        config: {
          request:
            options.enabled && state.prepared ? options.request : undefined,
        },
        error: state.prepareError,
        isFetching: state.isPreparing,
        refetch: () => {
          state.retries++;
        },
      }),
      useSendTransaction: (options) => {
        sendOptions = options;
        return {
          ...state.send,
          sendTransaction: options.request
            ? () => {
                state.writes++;
              }
            : undefined,
          reset: () => {
            state.send.error = undefined;
            state.send.data = undefined;
          },
        };
      },
      useWaitForTransaction: (options) => {
        receiptOptions = options;
        return {
          ...state.receipt,
          refetch: () => {
            state.checks++;
          },
        };
      },
    },
  });
  const render = (onNewBid = async () => {}) => {
    hooks.begin();
    return PlaceBid({
      highestBid: "1000000000000000",
      auction,
      tokenId: "7",
      hidden: false,
      onNewBid,
    });
  };
  const button = (tree) => nodes(tree).find(({ type }) => type === "button");
  const enter = (value) =>
    nodes(render())
      .find(({ type }) => type === "input")
      .props.onChange({ target: { value } });
  const click = (tree) => button(tree).props.onClick({ preventDefault() {} });
  return {
    state,
    render,
    button,
    enter,
    click,
    getSendOptions: () => sendOptions,
    getReceiptOptions: () => receiptOptions,
  };
};

test("connection-only click and connection errors are visible in the bid form", () => {
  const h = createBidHarness();
  h.state.account.isConnected = false;
  h.enter("0.0011");
  assert.match(textContent(h.render()), /Connect to bid/);
  h.click(h.render());
  assert.equal(h.state.connects, 1);
  assert.equal(h.state.writes, 0);
  h.state.miniApp.isConnectingMiniApp = true;
  assert.equal(h.button(h.render()).props.disabled, true);
  assert.match(textContent(h.render()), /Connecting wallet/);
  h.state.miniApp.isConnectingMiniApp = false;
  h.state.miniApp.miniAppConnectionError = { code: 4001 };
  assert.match(textContent(h.render()), /connection was cancelled/);
  h.state.account.isConnected = true;
  assert.equal(h.button(h.render()).props.disabled, false);
  assert.match(textContent(h.render()), /Place bid/);
});

test("preparation errors are visible and retry only preparation", () => {
  const h = createBidHarness();
  h.enter("0.0011");
  h.state.prepared = false;
  h.state.prepareError = { code: "INVALID_ARGUMENT" };
  const tree = h.render();
  assert.equal(h.button(tree).props.disabled, true);
  assert.match(textContent(tree), /Unable to prepare this bid/);
  nodes(tree)
    .find((node) => textContent(node) === "Retry bid preparation")
    .props.onClick();
  assert.equal(h.state.retries, 1);
  assert.equal(h.state.writes, 0);
});

test("active Farcaster bidding is available even when the legacy prepared writer is absent", () => {
  const h = createBidHarness();
  h.state.account.connector = {
    id: "farcasterMiniApp",
    getProvider: async () => ({ request: async () => hash }),
  };
  h.state.prepared = false;
  h.state.prepareError = { code: 4200, message: "Unsupported eth_estimateGas" };
  h.enter("0.0011");
  const tree = h.render();
  assert.equal(
    h.button(tree).props.disabled,
    false,
    "legacy preparation cannot block native Farcaster approval"
  );
  assert.doesNotMatch(textContent(tree), /Unable to prepare this bid/);
});

test("approval and confirmation stay distinct, block duplicates and expose a submitted hash", () => {
  const h = createBidHarness();
  h.enter("0.0011");
  const ready = h.render();
  h.click(ready);
  h.click(ready);
  assert.equal(
    h.state.writes,
    1,
    "same-render duplicate clicks cannot send twice"
  );
  h.state.send.isLoading = true;
  assert.match(textContent(h.render()), /Approve your bid in your wallet/);
  assert.equal(h.button(h.render()).props.disabled, true);
  h.state.send.isLoading = false;
  h.state.send.data = { hash };
  h.getSendOptions().onSettled();
  h.state.receipt.isLoading = true;
  const pending = h.render();
  assert.match(textContent(pending), /Waiting for confirmation on Base/);
  assert.equal(
    nodes(pending).find(({ type }) => type === "a").props.href,
    `https://basescan.org/tx/${hash}`
  );
  assert.equal(h.getReceiptOptions().chainId, 8453);
  h.state.receipt.isLoading = false;
  h.state.receipt.error = new Error("timeout");
  const unknown = h.render();
  assert.match(
    textContent(unknown),
    /Check the transaction before placing another bid/
  );
  assert.equal(h.button(unknown).props.disabled, true);
  nodes(unknown)
    .find((node) => textContent(node) === "Check transaction status")
    .props.onClick();
  assert.equal(h.state.checks, 1);
  assert.equal(h.state.writes, 1);
});

test("wallet rejection permits a deliberate retry and preserves the entered bid", () => {
  const h = createBidHarness();
  h.enter("0.0011");
  h.click(h.render());
  h.getSendOptions().onSettled();
  h.state.send.error = { cause: { code: "ACTION_REJECTED" } };
  const tree = h.render();
  assert.match(textContent(tree), /approval was cancelled/);
  assert.equal(
    nodes(tree).find(({ type }) => type === "input").props.value,
    "0.0011"
  );
  assert.equal(h.button(tree).props.disabled, false);
  h.click(tree);
  assert.equal(h.state.writes, 2);
});

test("web connect remains the browser modal; invalid, stale and wrong-chain bids never send", () => {
  const h = createBidHarness();
  h.state.account.isConnected = false;
  h.state.miniApp.isMiniApp = false;
  h.click(h.render());
  assert.equal(h.state.webConnects, 1);
  assert.equal(h.state.connects, 0);
  h.state.account.isConnected = true;
  for (const amount of ["-1", "0", "0.0001", "garbage"]) {
    h.enter(amount);
    assert.equal(h.button(h.render()).props.disabled, true);
    h.click(h.render());
  }
  h.enter("0.002");
  h.state.debounce = "0.0011";
  assert.equal(h.button(h.render()).props.disabled, true);
  h.click(h.render());
  h.state.debounce = undefined;
  h.state.chain.id = 1;
  assert.match(textContent(h.render()), /Switch your wallet to Base/);
  h.click(h.render());
  assert.equal(h.state.writes, 0);
});

test("receipt success clears inputs, while refresh failure retains confirmation truth", async () => {
  const h = createBidHarness();
  h.enter("0.0011");
  h.render(async () => {
    throw new Error("refresh offline");
  });
  await h.getReceiptOptions().onSuccess();
  h.state.receipt.isSuccess = true;
  const tree = h.render();
  assert.equal(
    nodes(tree).find(({ type }) => type === "input").props.value,
    ""
  );
  assert.match(
    textContent(tree),
    /Your bid was confirmed, but the auction could not refresh/
  );
});

test("wallet error messages stay useful without exposing raw diagnostics", () => {
  for (const phase of ["connect", "prepare", "send", "confirm"]) {
    assert.doesNotMatch(
      errorHelpers.getAuctionWalletError(
        { message: "private diagnostic marker" },
        phase
      ),
      /private diagnostic marker/
    );
  }
  assert.match(
    errorHelpers.getAuctionWalletError(
      { error: { code: "INSUFFICIENT_FUNDS" } },
      "prepare"
    ),
    /ETH on Base/
  );
  assert.match(
    errorHelpers.getAuctionWalletError(
      { name: "ChainMismatchError" },
      "prepare"
    ),
    /Switch your wallet to Base/
  );
});

test("the bid form retains token, referral, ETH amount and optional comment in its prepared payload", () => {
  const h = createBidHarness();
  h.enter("0.0011");
  nodes(h.render())
    .find(({ type }) => type === "textarea")
    .props.onChange({ target: { value: "Nice art!" } });
  h.render();
  const request = h.getSendOptions().request;
  const iface = new ethersCompat.utils.Interface(auctionAbi);
  const decoded = iface.decodeFunctionData(
    "createBidWithReferral",
    request.data
  );
  assert.equal(decoded[0].toString(), "7");
  assert.equal(decoded[1].toLowerCase(), account);
  assert.equal(request.to, auction);
  assert.equal(request.value.toString(), "1100000000000000");
  assert.equal(
    request.data.endsWith(Buffer.from("Nice art!", "utf8").toString("hex")),
    true
  );
});

test("Mini App connection hook exposes failure, unlocks retry and blocks same-render duplicate connects", async () => {
  const hooks = createHookHarness();
  let calls = 0;
  let failConnection;
  const connectionFailure = { code: 4001 };
  const connection = new Promise((_, reject) => {
    failConnection = reject;
  });
  const { useMiniAppWalletConnect } = load("hooks/useMiniAppWalletConnect.ts", {
    react: hooks.react,
    "@/utils/farcasterMiniApp": {
      isInMiniApp: async () => true,
      loadMiniAppSdk: async () => null,
    },
    wagmi: {
      useConnect: () => ({
        connectAsync: async () => {
          calls++;
          if (calls === 1) await connection;
        },
      }),
    },
    "../configs/wallet": { chains: [base] },
    "../configs/farcaster-mini-app-connector": {
      FarcasterMiniAppConnector: class {},
    },
  });
  const render = () => {
    hooks.begin();
    return useMiniAppWalletConnect();
  };
  const initial = render();
  const first = initial.connectMiniAppWallet();
  const duplicate = initial.connectMiniAppWallet();
  assert.equal(render().isConnectingMiniApp, true);
  failConnection(connectionFailure);
  await Promise.all([first, duplicate]);
  assert.equal(calls, 1);
  assert.equal(render().isConnectingMiniApp, false);
  assert.equal(render().miniAppConnectionError, connectionFailure);
  await render().connectMiniAppWallet();
  assert.equal(calls, 2);
  assert.equal(render().miniAppConnectionError, undefined);
});

const nativeRequest = {
  account,
  auction,
  calldata: "0x1234abcd",
  value: 1100000000000000n,
};
const nativeProviderFixture = ({
  walletAccount = account,
  chainId = "0x2105",
  sendError,
  sendResult = hash,
} = {}) => {
  const requests = [];
  return {
    requests,
    provider: {
      request: async (request) => {
        requests.push(request);
        if (request.method === "eth_accounts") return [walletAccount];
        if (request.method === "eth_chainId") return chainId;
        if (request.method === "eth_sendTransaction") {
          if (sendError) throw sendError;
          return typeof sendResult === "function"
            ? await sendResult(request)
            : sendResult;
        }
        throw { code: 4200, message: "Unsupported preparation RPC" };
      },
    },
  };
};

test("native approval uses the active connector without wallet-side estimation and preserves the exact bid", async () => {
  const { connector, requests } = await setup(8453, { code: 4200 });
  try {
    assert.equal(
      await nativeBid.sendMiniAppAuctionBid(
        await connector.getProvider(),
        nativeRequest
      ),
      hash
    );
    assert.equal(
      requests.some(({ method }) => method === "eth_estimateGas"),
      false
    );
    const sends = requests.filter(
      ({ method }) => method === "eth_sendTransaction"
    );
    assert.equal(sends.length, 1);
    const payload = sends[0].params[0];
    assert.equal(payload.from, account);
    assert.equal(payload.to, auction);
    assert.equal(payload.data, nativeRequest.calldata);
    assert.equal(BigInt(payload.value), nativeRequest.value);
    assert.equal(payload.chainId, "0x2105");
    for (const key of ["gas", "gasLimit", "gasPrice", "maxFeePerGas", "nonce"])
      assert.equal(key in payload, false);
  } finally {
    await core.disconnect();
  }
});

test("native preflight refuses changed account, wrong chain, unavailable provider and invalid payload before a send", async () => {
  for (const options of [{ walletAccount: auction }, { chainId: "0x1" }]) {
    const f = nativeProviderFixture(options);
    await assert.rejects(
      nativeBid.sendMiniAppAuctionBid(f.provider, nativeRequest),
      /MINIAPP_ACCOUNT_CHANGED|MINIAPP_WRONG_CHAIN/
    );
    assert.equal(
      f.requests.some(({ method }) => method === "eth_sendTransaction"),
      false
    );
  }
  await assert.rejects(
    nativeBid.sendMiniAppAuctionBid(undefined, nativeRequest),
    /MINIAPP_PROVIDER_UNAVAILABLE/
  );
  for (const mutation of [
    { auction: "bad" },
    { value: 0n },
    { value: "1" },
    { calldata: "bad" },
  ]) {
    const f = nativeProviderFixture();
    await assert.rejects(
      nativeBid.sendMiniAppAuctionBid(f.provider, {
        ...nativeRequest,
        ...mutation,
      }),
      /MINIAPP_INVALID_BID/
    );
    assert.equal(f.requests.length, 0);
  }
});

test("rejection is retryable but a lost or invalid transaction response has an unknown outcome", async () => {
  const rejected = nativeProviderFixture({ sendError: { code: 4001 } });
  await assert.rejects(
    nativeBid.sendMiniAppAuctionBid(rejected.provider, nativeRequest),
    (error) => error.code === 4001
  );
  for (const options of [
    { sendResult: "0x1234" },
    { sendResult: null },
    { sendError: { code: -32603, message: "internal wallet failure" } },
  ]) {
    const f = nativeProviderFixture(options);
    await assert.rejects(
      nativeBid.sendMiniAppAuctionBid(f.provider, nativeRequest),
      (error) => error.submissionUnknown === true
    );
    assert.equal(
      f.requests.filter(({ method }) => method === "eth_sendTransaction")
        .length,
      1
    );
  }
  assert.equal(
    errorHelpers.isAuctionWalletRejection({ message: "unknown tx 0x4001abcd" }),
    false
  );
});

test("native component opens one approval, tracks the returned hash across connector changes and blocks stale handlers", async () => {
  const h = createBidHarness();
  let approve;
  const result = new Promise((resolve) => {
    approve = resolve;
  });
  const f = nativeProviderFixture({ sendResult: () => result });
  h.state.account.connector = {
    id: "farcasterMiniApp",
    getProvider: async () => f.provider,
  };
  h.state.prepared = false;
  h.state.prepareError = { code: 4200 };
  h.enter("0.0011");
  nodes(h.render())
    .find(({ type }) => type === "textarea")
    .props.onChange({ target: { value: "Native bid!" } });
  const ready = h.render();
  const first = h.click(ready);
  await h.click(ready);
  assert.equal(h.button(h.render()).props.disabled, true);
  assert.match(textContent(h.render()), /Approve your bid in your wallet/);
  approve(hash);
  await first;
  await h.click(ready);
  assert.equal(
    f.requests.filter(({ method }) => method === "eth_sendTransaction").length,
    1
  );
  assert.equal(h.state.writes, 0, "never use Wagmi as a second send route");
  const payload = f.requests.find(
    ({ method }) => method === "eth_sendTransaction"
  ).params[0];
  assert.equal(
    payload.data.endsWith(Buffer.from("Native bid!", "utf8").toString("hex")),
    true
  );
  const decoded = new ethersCompat.utils.Interface(
    auctionAbi
  ).decodeFunctionData("createBidWithReferral", payload.data);
  assert.equal(decoded[0].toString(), "7");
  assert.equal(decoded[1].toLowerCase(), account);
  h.state.account.connector = { id: "injected" };
  h.render();
  assert.equal(h.getReceiptOptions().hash, hash);
  assert.equal(h.button(h.render()).props.disabled, true);
});

test("native rejection allows another deliberate approval, while unknown response locks further bids", async () => {
  const h = createBidHarness();
  let f = nativeProviderFixture({ sendError: { code: 4001 } });
  h.state.account.connector = {
    id: "farcasterMiniApp",
    getProvider: async () => f.provider,
  };
  h.enter("0.0011");
  await h.click(h.render());
  assert.match(textContent(h.render()), /approval was cancelled/);
  assert.equal(h.button(h.render()).props.disabled, false);
  f = nativeProviderFixture({ sendResult: "0xnotahash" });
  await h.click(h.render());
  const unknown = h.render();
  assert.match(textContent(unknown), /Check your wallet activity/);
  assert.equal(h.button(unknown).props.disabled, true);
  await h.click(unknown);
  assert.equal(
    f.requests.filter(({ method }) => method === "eth_sendTransaction").length,
    1
  );
  assert.equal(h.state.writes, 0);
});

test("a different connector inside the miniapp keeps the web preparation guard", () => {
  const h = createBidHarness();
  h.state.account.connector = { id: "injected" };
  h.state.prepared = false;
  h.state.prepareError = {
    code: -32603,
    message: "private internal diagnostic",
  };
  h.enter("0.0011");
  assert.equal(h.button(h.render()).props.disabled, true);
  assert.match(textContent(h.render()), /Wallet code: -32603/);
  assert.doesNotMatch(textContent(h.render()), /private internal diagnostic/);
});

test("native bidding still rejects invalid, below-minimum, stale and wrong-chain inputs without requesting approval", async () => {
  const h = createBidHarness();
  const f = nativeProviderFixture();
  h.state.account.connector = {
    id: "farcasterMiniApp",
    getProvider: async () => f.provider,
  };
  for (const value of ["-1", "0", "0.0001", "bad"]) {
    h.enter(value);
    assert.equal(h.button(h.render()).props.disabled, true);
    await h.click(h.render());
  }
  h.enter("0.002");
  h.state.debounce = "0.0011";
  assert.equal(h.button(h.render()).props.disabled, true);
  await h.click(h.render());
  h.state.debounce = undefined;
  h.state.chain.id = 1;
  assert.equal(h.button(h.render()).props.disabled, true);
  await h.click(h.render());
  assert.equal(f.requests.length, 0);
  assert.equal(h.state.writes, 0);
});

test("installed Farcaster SDK bridge accepts the native bid even when the host refuses gas estimation", async () => {
  const requests = [];
  const sdkBridge = load(resolve(dirname(require.resolve("@farcaster/miniapp-sdk")), "ethereumProvider.js"), {
    "./miniAppHost.js": {
      miniAppHost: {
        ethProviderRequestV2: async (request) => {
          requests.push(request);
          const response = { jsonrpc: "2.0", id: request.id };
          if (request.method === "eth_estimateGas") return { ...response, error: { code: 4200, message: "Unsupported method" } };
          const result = request.method === "eth_accounts" ? [account]
            : request.method === "eth_chainId" ? "0x2105"
            : request.method === "eth_sendTransaction" ? hash : undefined;
          assert.notEqual(result, undefined);
          return { ...response, result };
        },
      },
    },
  });
  await assert.rejects(sdkBridge.ethereumProvider.request({ method: "eth_estimateGas", params: [nativeRequest] }), (error) => error.code === 4200);
  requests.length = 0;
  assert.equal(await nativeBid.sendMiniAppAuctionBid(sdkBridge.ethereumProvider, nativeRequest), hash);
  assert.deepEqual(requests.map(({ method }) => method), ["eth_accounts", "eth_chainId", "eth_sendTransaction"]);
});
