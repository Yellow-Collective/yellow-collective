import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import test from "node:test";
import * as core from "@wagmi/core";
import { BigNumber, providers } from "ethers";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
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
    window: {},
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

const setup = async (chainId = 8453) => {
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
