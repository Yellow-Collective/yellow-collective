import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../pages/create-proposal.tsx", import.meta.url),
  "utf8"
);
const globalStyles = readFileSync(
  new URL("../styles/globals.css", import.meta.url),
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

  const prepareFunction = source.match(
    /const prepareTransaction = \([\s\S]*?\nconst getTransactionReadinessIssue = /
  )?.[0];
  const prepareDefaultBranch = prepareFunction?.match(
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

test("create proposal button is pale blue until it is submittable", () => {
  assert.match(
    source,
    /const showsSubmitLabel =\s*hasBalance &&[\s\S]*hasConfirmedCustomTransactions &&[\s\S]*!isSuccess;/
  );
  assert.match(
    source,
    /showsSubmitLabel[\s\S]*yc-proposal-submit-active bg-skin-button-accent hover:bg-skin-button-accent-hover[\s\S]*yc-proposal-submit-inactive bg-\[#dbeafe\] text-\[#5f7590\]/
  );
  assert.match(
    source,
    /disabled:cursor-not-allowed/
  );
  assert.equal(
    source.includes("bg-[#dc2626]"),
    false,
    "Incomplete proposal actions should use the muted blue inactive state, not red."
  );
  assert.match(
    globalStyles,
    /\[data-theme="dark"\] \.yc-dark-submit-blue\.yc-proposal-submit-inactive/
  );
  assert.match(globalStyles, /background-color: rgb\(219, 234, 254\) !important;/);
});

test("create proposal resolves ENS names before preparing proposal actions", () => {
  assert.match(source, /import \{ normalizeEnsNameInput \} from "@\/utils\/ens";/);
  assert.match(source, /type ResolvedAddressMap = Record<string, `0x\$\{string\}` \| undefined>;/);
  assert.match(source, /const useResolvedEnsAddresses = \(ensNames: string\[\]\) => \{/);
  assert.match(source, /\/api\/ens\/address\/\$\{encodeURIComponent\(ensName\)\}/);
  assert.match(source, /const getAddressInput = \([\s\S]*resolvedAddresses: ResolvedAddressMap[\s\S]*\) => \{/);
  assert.match(
    source,
    /prepareTransaction\(transaction, addresses\?\.treasury, resolvedAddresses\)/
  );
  assert.match(source, /if \(isResolving\) return "Resolving ENS names";/);
});

test("create proposal previews final proposal body and transactions before submit", () => {
  assert.match(source, /import ProposalTransactions from "@\/components\/ProposalTransactions";/);
  assert.match(source, /import ReactMarkdown from "react-markdown";/);
  assert.match(source, /const ProposalSubmissionPreview = \(\{/);
  assert.match(source, /<ProposalSubmissionPreview[\s\S]*description=\{description\}[\s\S]*transactions=\{validTransactions\}/);
  assert.match(source, /const previewTitle = getProposalName\(description\);/);
  assert.match(source, /const previewDescription = getProposalDescription\(description\);/);
  assert.match(source, /Final proposal preview/);
  assert.match(source, /remarkPlugins=\{\[remarkGfm\]\}/);
  assert.match(source, /rehypePlugins=\{\[rehypeRaw, rehypeSanitize\]\}/);
  assert.match(
    source,
    /<ProposalTransactions[\s\S]*transactions=\{[\s\S]*hasValidTransactions[\s\S]*target: transaction\.target,[\s\S]*value: transaction\.value\.toString\(\),[\s\S]*calldata: transaction\.calldata,/
  );
});
