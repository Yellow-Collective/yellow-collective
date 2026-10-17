import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const readSource = (path) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

const membersPage = readSource("pages/members.tsx");
const membersData = readSource("data/members.ts");
const addresses = readSource("constants/addresses.ts");
const votingData = readSource("data/member-voting-power.ts");

assert.match(
  membersPage,
  /type SortMode =[\s\S]*\|\s*"votingPower"/,
  "Members page sort mode must include voting power."
);

assert.match(
  membersPage,
  /\{\s*label:\s*"Voting power",\s*value:\s*"votingPower"\s*\}/,
  "Members page must expose a Voting power sort option."
);

assert.match(
  membersPage,
  /if \(sort === "votingPower"\) \{[\s\S]*return \(second\.votingPower \?\? -1\) - \(first\.votingPower \?\? -1\) \|\| nameSort\(\);[\s\S]*\}/,
  "Members page must sort voting power descending with the stable name fallback."
);

assert.match(
  membersPage,
  /<MemberStat label="Power" value=\{member\.votingPower\} \/>/,
  "Member cards must show the voting power used by the sort."
);

assert.match(
  membersData,
  /votingPower:\s*number \| null;/,
  "DAO member summaries must include votingPower."
);

assert.match(
  votingData,
  /address: getAddress\(TOKEN_CONTRACT\),\s*abi,\s*functionName: "getVotes"/,
  "Member voting power must use getVotes on the Collective Nouns token contract."
);

assert.match(
  votingData,
  /function getVotes\(address account\) view returns \(uint256\)/,
  "Member voting power must call getVotes."
);

assert.match(
  membersData,
  /nouns\.build\/api\/membersList\/\$\{TOKEN_CONTRACT\}\?chainId=\$\{TOKEN_NETWORK\}/,
  "Member voting power should keep Nouns Builder members list parity as a fallback source."
);

assert.doesNotMatch(
  addresses,
  /COLLECTIVE_NOUNS_VOTING_POWER_CONTRACT/,
  "Members voting power must not use the governor contract as the current voting-power contract."
);

assert.match(
  membersData,
  /votingPower:\s*votingPowerByAddress\.get\(address\) \?\? null/,
  "Member voting power must remain unknown instead of using owned-token count when delegated votes are unavailable."
);

assert.doesNotMatch(
  membersData,
  /votingPower:\s*votingPowerByAddress\.get\(address\) \?\? ownerTokens\.length/,
  "Owned token count must not be used as voting power because holders can delegate away their votes."
);

assert.match(
  membersPage,
  /const MEMBERS_STATIC_GENERATION_TIMEOUT_MS = 20_000/,
  "Members static generation must finish before the hosting platform timeout."
);

assert.match(
  membersPage,
  /withTimeout\([\s\S]*getDaoMembers\(\),[\s\S]*MEMBERS_STATIC_GENERATION_TIMEOUT_MS[\s\S]*\)/,
  "Members data loading must be bounded during ISR generation."
);

assert.match(
  membersPage,
  /process\.env\.NEXT_PHASE === "phase-production-build"[\s\S]*members: \[\],[\s\S]*revalidate: 1/,
  "Production builds must not start member RPC work that can outlive a page timeout."
);

assert.match(
  membersPage,
  /throw error;/,
  "A failed ISR refresh must throw to preserve the previous page."
);

console.log("ok - members page supports voting power sort");
