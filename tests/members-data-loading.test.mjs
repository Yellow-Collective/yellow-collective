import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const readSource = (path) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

const membersData = readSource("data/members.ts");

assert.match(
  membersData,
  /nouns\.build\/api\/membersList\/\$\{TOKEN_CONTRACT\}\?chainId=\$\{TOKEN_NETWORK\}/,
  "Member discovery must use the fast holder-first Nouns Builder member list."
);

assert.match(
  membersData,
  /tokens\?:\s*number\[\]/,
  "Holder-first member discovery must preserve owned token IDs."
);

assert.match(
  membersData,
  /withTimeoutFallback\([\s\S]*getEnsNamesForAddresses\(addresses\)[\s\S]*\{\} as Record<string, string>/,
  "ENS enrichment must time out to an empty map without erasing holders."
);

assert.match(
  membersData,
  /const memberSeeds = await getMemberSeeds\(\);/,
  "DAO member summaries must start with holder seeds rather than full token metadata."
);

assert.doesNotMatch(
  membersData,
  /export const getDaoMemberSummaries[\s\S]*?const \{ tokens \} = await getCollectiveNounTokens\(\)/,
  "Full token metadata must not block member discovery."
);

assert.doesNotMatch(
  membersData,
  /const fallbackVotingPower = new Map\([\s\S]*member\.tokenCount/,
  "Timed-out voting-power enrichment must not substitute token ownership for delegated voting power."
);

console.log("ok - members load holder-first with optional enrichment");
