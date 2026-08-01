import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const { privateKeyToAccount } = require("viem/accounts");

const moduleCache = new Map();

const resolveTsPath = (specifier, parentFile) => {
  if (specifier.startsWith("@/")) {
    return resolve(process.cwd(), `${specifier.slice(2)}.ts`);
  }
  if (specifier.startsWith("constants/")) {
    return resolve(process.cwd(), `${specifier}.ts`);
  }
  if (specifier.startsWith(".")) {
    return resolve(dirname(parentFile), `${specifier}.ts`);
  }
  return null;
};

const loadTsModule = (
  filePath,
  { cacheKey = "default", globals = {} } = {}
) => {
  const moduleCacheKey = `${cacheKey}:${filePath}`;
  if (moduleCache.has(moduleCacheKey)) {
    return moduleCache.get(moduleCacheKey).exports;
  }

  const source = readFileSync(filePath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  });
  const module = { exports: {} };
  moduleCache.set(moduleCacheKey, module);

  const localRequire = (specifier) => {
    const tsPath = resolveTsPath(specifier, filePath);
    return tsPath ? loadTsModule(tsPath) : require(specifier);
  };

  vm.runInNewContext(transpiled.outputText, {
    require: localRequire,
    module,
    exports: module.exports,
    console,
    process,
    Buffer,
    URL,
    Date,
    TextEncoder,
    TextDecoder,
    setTimeout,
    clearTimeout,
    ...globals,
  });

  return module.exports;
};

const shared = loadTsModule(resolve(process.cwd(), "utils/signature-auth.ts"));
const server = loadTsModule(
  resolve(process.cwd(), "utils/signature-auth-server.ts")
);

const account = privateKeyToAccount(
  "0x59c6995e998f97a5a0044966f094538df32ec358051de0b36a78c5d0c04507ed"
);
const otherAccount = privateKeyToAccount(
  "0x8b3a350cf5c34c9194ca3ff3d0d29fb9ee6d8c5f7f8f7f8f7f8f7f8f7f8f7f8f"
);

const makeReq = ({ method = "POST", path = "/api/test", body = {} } = {}) => ({
  method,
  url: path,
  headers: {
    host: "localhost:3000",
  },
  body,
  query: {},
  socket: { remoteAddress: "127.0.0.1" },
});

const makeRes = () => {
  const res = {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(key, value) {
      this.headers[key] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
  };

  return res;
};

const issueAndSign = async ({
  body = { ok: true },
  path = "/api/test",
  method = "POST",
  chainId = 8453,
  signer = account,
} = {}) => {
  const req = makeReq({ method, path, body });
  const challenge = await server.issueSignedRequestChallenge(req, {
    walletAddress: account.address,
    chainId,
    action: "test:action",
    method,
    path,
    payloadHash: shared.createRequestPayloadHash(method === "GET" ? {} : body),
  });
  const signature = await signer.signMessage({
    message: shared.buildSignedRequestMessage(challenge),
  });
  const authorization = shared.createSignedRequestAuthorizationHeader({
    nonce: challenge.nonce,
    walletAddress: signer.address,
    signature,
  });

  return { authorization, challenge };
};

const tests = [];
const test = (name, run) => tests.push({ name, run });

test("valid signed request verifies and replay with same nonce fails", async () => {
  server.resetMemorySignedRequestNoncesForTests();
  const body = { profile: { username: "yellow" } };
  const { authorization } = await issueAndSign({ body });
  const req = makeReq({ body });
  req.headers.authorization = authorization;

  assert.equal(
    await server.verifySignedRequest(req, makeRes(), {
      action: "test:action",
      expectedChainId: 8453,
      expectedWalletAddress: account.address,
    }),
    account.address
  );

  const replayRes = makeRes();
  assert.equal(
    await server.verifySignedRequest(req, replayRes, {
      action: "test:action",
      expectedChainId: 8453,
      expectedWalletAddress: account.address,
    }),
    undefined
  );
  assert.equal(replayRes.statusCode, 403);
});

test("authorization header encoding works with browser Buffer polyfills", () => {
  const browserBuffer = {
    from(value, encoding) {
      if (encoding === "base64url") {
        throw new Error("Unknown encoding: base64url");
      }

      const nodeBuffer = Buffer.from(value, encoding);
      return {
        toString(outputEncoding) {
          if (outputEncoding === "base64url") {
            throw new Error("Unknown encoding: base64url");
          }

          return nodeBuffer.toString(outputEncoding);
        },
      };
    },
  };
  const browserShared = loadTsModule(
    resolve(process.cwd(), "utils/signature-auth.ts"),
    {
      cacheKey: "browser-buffer-polyfill",
      globals: { Buffer: browserBuffer },
    }
  );
  const authorization = {
    nonce: "nonce-1",
    walletAddress: account.address,
    signature: `0x${"a".repeat(130)}`,
  };

  const header =
    browserShared.createSignedRequestAuthorizationHeader(authorization);
  const parsed = browserShared.parseSignedRequestAuthorizationHeader(header);

  assert.equal(parsed.nonce, authorization.nonce);
  assert.equal(parsed.walletAddress, authorization.walletAddress);
  assert.equal(parsed.signature, authorization.signature);
});

test("signed request message uses SIWE fields and keeps request bindings", () => {
  const challenge = {
    nonce: "0123456789abcdef",
    walletAddress: account.address,
    chainId: 8453,
    action: "admin:session",
    method: "POST",
    path: "/api/admin/session",
    domain: "www.yellowcollective.art",
    uri: "https://www.yellowcollective.art/api/admin/session",
    issuedAt: "2026-08-01T12:00:00.000Z",
    expirationTime: "2026-08-01T12:05:00.000Z",
    payloadHash: shared.createRequestPayloadHash({}),
  };

  const message = shared.buildSignedRequestMessage(challenge);

  assert.match(
    message,
    /^www\.yellowcollective\.art wants you to sign in with your Ethereum account:\n/u
  );
  assert.match(message, /\nURI: https:\/\/www\.yellowcollective\.art\/api\/admin\/session\n/u);
  assert.match(message, /\nVersion: 1\nChain ID: 8453\n/u);
  assert.match(message, /\nNonce: 0123456789abcdef\n/u);
  assert.match(message, /\nResources:\n/u);
  assert.match(message, /\n- urn:yellow-collective:action:admin%3Asession\n/u);
  assert.match(message, /\n- urn:yellow-collective:method:POST\n/u);
  assert.match(message, /\n- urn:yellow-collective:path:%2Fapi%2Fadmin%2Fsession\n/u);
  assert.match(
    message,
    new RegExp(`\\n- urn:yellow-collective:payload:${challenge.payloadHash}$`, "u")
  );
});

test("production challenge uses the forwarded request origin over stale site config", async () => {
  server.resetMemorySignedRequestNoncesForTests();
  const originalNodeEnv = process.env.NODE_ENV;
  const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.NODE_ENV = "production";
  process.env.NEXT_PUBLIC_SITE_URL = "https://yellowcollective.art";

  try {
    const req = makeReq();
    req.headers.host = "yellowcollective.vercel.app";
    req.headers["x-forwarded-host"] = "www.yellowcollective.art";
    req.headers["x-forwarded-proto"] = "https";
    const challenge = await server.issueSignedRequestChallenge(req, {
      walletAddress: account.address,
      chainId: 8453,
      action: "admin:session",
      method: "POST",
      path: "/api/admin/session",
      payloadHash: shared.createRequestPayloadHash({}),
    });

    assert.equal(challenge.domain, "www.yellowcollective.art");
    assert.equal(
      challenge.uri,
      "https://www.yellowcollective.art/api/admin/session"
    );
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalSiteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
  }
});

test("production challenge rejects unrelated forwarded hosts", async () => {
  server.resetMemorySignedRequestNoncesForTests();
  const originalNodeEnv = process.env.NODE_ENV;
  const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.NODE_ENV = "production";
  process.env.NEXT_PUBLIC_SITE_URL = "https://yellowcollective.art";

  try {
    const req = makeReq();
    req.headers["x-forwarded-host"] = "attacker.example";
    req.headers["x-forwarded-proto"] = "https";
    const challenge = await server.issueSignedRequestChallenge(req, {
      walletAddress: account.address,
      chainId: 8453,
      action: "admin:session",
      method: "POST",
      path: "/api/admin/session",
      payloadHash: shared.createRequestPayloadHash({}),
    });

    assert.equal(challenge.domain, "yellowcollective.art");
    assert.equal(
      challenge.uri,
      "https://yellowcollective.art/api/admin/session"
    );
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalSiteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
  }
});

test("modified body, endpoint, method, wallet, chain, and expiry fail", async () => {
  for (const scenario of [
    {
      name: "body",
      issue: { body: { amount: "1" } },
      verify: { body: { amount: "2" } },
    },
    {
      name: "path",
      issue: { path: "/api/one" },
      verify: { path: "/api/two" },
    },
    {
      name: "method",
      issue: { method: "POST", body: { ok: true } },
      verify: { method: "GET", body: {} },
    },
    {
      name: "wallet",
      issue: { signer: otherAccount },
      verify: {},
    },
    {
      name: "chain",
      issue: { chainId: 1 },
      verify: {},
    },
  ]) {
    server.resetMemorySignedRequestNoncesForTests();
    const { authorization } = await issueAndSign(scenario.issue);
    const req = makeReq(scenario.verify);
    req.headers.authorization = authorization;
    const res = makeRes();

    assert.equal(
      await server.verifySignedRequest(req, res, {
        action: "test:action",
        expectedChainId: 8453,
        expectedWalletAddress: account.address,
      }),
      undefined,
      scenario.name
    );
    assert.equal(res.statusCode, 403, scenario.name);
  }

  server.resetMemorySignedRequestNoncesForTests();
  const { authorization } = await issueAndSign();
  const req = makeReq();
  req.headers.authorization = authorization;
  const originalNow = Date.now;
  Date.now = () => originalNow() + 10 * 60 * 1000;
  try {
    const res = makeRes();
    assert.equal(
      await server.verifySignedRequest(req, res, {
        action: "test:action",
        expectedChainId: 8453,
        expectedWalletAddress: account.address,
      }),
      undefined
    );
    assert.equal(res.statusCode, 403);
  } finally {
    Date.now = originalNow;
  }
});

let failures = 0;

for (const { name, run } of tests) {
  try {
    await run();
    console.log(`ok - ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`not ok - ${name}`);
    console.error(error);
  }
}

if (failures > 0) {
  process.exitCode = 1;
}
