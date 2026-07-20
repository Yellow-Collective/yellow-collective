import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const loadTsModule = (filePath) => {
  const source = readFileSync(filePath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  });
  const module = { exports: {} };

  vm.runInNewContext(transpiled.outputText, {
    require,
    module,
    exports: module.exports,
    URL,
    Date,
    console,
  });

  return module.exports;
};

const identity = loadTsModule(
  resolve(process.cwd(), "utils/profile/identity.ts")
);

const testAddress = "0x000000000000000000000000000000000000dEaD";
const checksumAddress = "0x000000000000000000000000000000000000dEaD";

const tests = [];
const test = (name, run) => tests.push({ name, run });

test("normalizes valid wallets and rejects invalid values", () => {
  assert.equal(identity.normalizeWalletAddress(testAddress), checksumAddress);
  assert.equal(identity.normalizeWalletAddress("not-a-wallet"), undefined);
});

test("compares own-profile addresses case-insensitively", () => {
  assert.equal(
    identity.areSameWalletAddress(
      "0x000000000000000000000000000000000000dead",
      checksumAddress
    ),
    true
  );
  assert.equal(
    identity.areSameWalletAddress(checksumAddress, undefined),
    false
  );
});

test("builds profile paths from wallet addresses even when ENS is available", () => {
  assert.equal(
    identity.getProfilePath({
      address: checksumAddress,
      ensName: "yellow.eth",
    }),
    `/profile/${checksumAddress}`
  );
  assert.equal(
    identity.getProfilePath({ address: checksumAddress }),
    `/profile/${checksumAddress}`
  );
});

test("prefers an uploaded profile image before a Collective Noun fallback", () => {
  assert.equal(
    identity.selectProfileAvatarUrl("uploaded-avatar", "collective-noun"),
    "uploaded-avatar"
  );
  assert.equal(
    identity.selectProfileAvatarUrl("", "collective-noun"),
    "collective-noun"
  );
  assert.equal(identity.selectProfileAvatarUrl("", ""), "");
});

test("normalizes profile social links", () => {
  assert.deepEqual(
    JSON.parse(
      JSON.stringify(
        identity.normalizeProfileMetadata({
          username: "  yellowartist  ",
          websiteUrl: "yellowcollective.art",
          farcaster: "@yellow",
          twitter: "https://twitter.com/yellowcollect",
          avatarUrl: "data:image/jpeg;base64,abcd",
        })
      )
    ),
    {
      username: "yellowartist",
      websiteUrl: "https://yellowcollective.art",
      farcaster: "https://warpcast.com/yellow",
      twitter: "https://x.com/yellowcollect",
      avatarUrl: "data:image/jpeg;base64,abcd",
    }
  );
});

test("validates metadata input", () => {
  assert.equal(
    identity.validateProfileMetadata({
      username: "bad username",
    }),
    "Username can only use letters, numbers, underscores, periods, and hyphens."
  );
  assert.equal(
    identity.validateProfileMetadata({
      farcaster: "https://example.com/not-warpcast",
    }),
    "Farcaster must be a valid handle or Warpcast URL."
  );
  assert.equal(
    identity.validateProfileMetadata({
      username: "yellow_artist",
      twitter: "@yellow",
      avatarUrl: "data:image/webp;base64,abcd",
    }),
    undefined
  );
  assert.equal(
    identity.validateProfileMetadata({
      avatarUrl: "https://example.com/avatar.png",
    }),
    "Profile image must be a PNG, JPEG, or WebP image."
  );
});

test("parses profile update messages", () => {
  const message = identity.createProfileUpdateMessage(checksumAddress);
  const parsed = identity.parseProfileUpdateMessage(message);

  assert.equal(parsed.wallet, checksumAddress);
  assert.equal(Number.isFinite(parsed.issuedAt), true);
  assert.equal(identity.parseProfileUpdateMessage("bad message"), null);
});

let failures = 0;

for (const { name, run } of tests) {
  try {
    run();
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
