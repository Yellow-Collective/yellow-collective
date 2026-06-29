import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../pages/create-proposal.tsx", import.meta.url),
  "utf8"
);

test("create proposal separates transaction validity from custom calldata confirmation", () => {
  assert.match(
    source,
    /const transactionUsesCustomCalldata = \(transaction: Transaction\) =>\s*transaction\.type !== "send-tokens" && transaction\.type !== "nft";/
  );

  assert.match(
    source,
    /const hasConfirmedCustomTransactions = transactions\.every\([\s\S]*!transactionUsesCustomCalldata\(transaction\) \|\|[\s\S]*transaction\.confirmedCustomCalldata[\s\S]*\);/
  );

  const prepareDefaultBranch = source.match(
    /case "custom-transaction":[\s\S]*?return \{[\s\S]*?calldata: transaction\.calldata as `0x\$\{string\}`,[\s\S]*?\};/
  )?.[0];

  assert.ok(prepareDefaultBranch, "Expected custom transaction preparation branch.");
  assert.equal(
    prepareDefaultBranch.includes("confirmedCustomCalldata"),
    false,
    "Transaction shape validity must not depend on the confirmation checkbox."
  );
});

test("create proposal tells users when calldata confirmation is the remaining blocker", () => {
  assert.match(source, /if \(!hasValidTransactions\) return "Complete every proposal action";/);
  assert.match(source, /if \(!hasConfirmedCustomTransactions\) return "Confirm custom calldata";/);
  assert.match(
    source,
    /Confirm that you verified this target, value, and calldata\./
  );
});

test("create proposal requires explicit positive token amounts and NFT ids", () => {
  assert.match(source, /const parsePositiveEther = \(value: string\) => \{/);
  assert.match(source, /return parsed > 0n \? parsed : null;/);
  assert.match(source, /if \(!amount\) return null;/);
  assert.match(source, /if \(!transaction\.tokenId\.trim\(\)\) return null;/);
  assert.match(
    source,
    /const value = parsePositiveEther\(transaction\.valueInETH\);[\s\S]*if \(!value\) return null;[\s\S]*value,/
  );
  assert.match(
    source,
    /if \(!transaction\.tokenId\.trim\(\)\) return null;[\s\S]*transaction\.tokenId,/
  );
});
