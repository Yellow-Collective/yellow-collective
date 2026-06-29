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
  assert.match(source, /const normalizeFormValue = \(value: unknown\) =>/);
  assert.match(source, /const parsePositiveEther = \(value: unknown\) => \{/);
  assert.match(source, /return parsed > 0n \? parsed : null;/);
  assert.match(source, /if \(!amount\) return null;/);
  assert.match(
    source,
    /const tokenId = normalizeFormValue\(transaction\.tokenId\)\.trim\(\);/
  );
  assert.equal(
    source.includes("transaction.tokenId.trim()"),
    false,
    "Token id validation must tolerate numeric form values."
  );
  assert.match(
    source,
    /const value = parsePositiveEther\(transaction\.valueInETH\);[\s\S]*if \(!value\) return null;[\s\S]*value,/
  );
  assert.match(
    source,
    /if \(!tokenId\) return null;[\s\S]*tokenId,/
  );
});

test("create proposal normalizes numeric form values before trimming", () => {
  assert.equal(
    source.includes("value.trim()"),
    false,
    "ETH amount validation must not trim raw form values."
  );
  assert.equal(
    source.includes("amount.trim()"),
    false,
    "ERC20 amount validation must not trim raw form values."
  );
  assert.equal(
    source.includes("decimals.trim()"),
    false,
    "ERC20 decimal validation must not trim raw form values."
  );
  assert.match(
    source,
    /parseEther\(normalizeFormValue\(transaction\.valueInETH\) \|\| "0"\)/
  );
});
