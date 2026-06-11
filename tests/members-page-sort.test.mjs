import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const readSource = (path) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

const membersPage = readSource("pages/members.tsx");
const membersData = readSource("data/members.ts");

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
  /if \(sort === "votingPower"\) \{[\s\S]*return second\.votingPower - first\.votingPower \|\| nameSort\(\);[\s\S]*\}/,
  "Members page must sort voting power descending with the stable name fallback."
);

assert.match(
  membersPage,
  /<MemberStat label="Power" value=\{member\.votingPower\} \/>/,
  "Member cards must show the voting power used by the sort."
);

assert.match(
  membersData,
  /votingPower:\s*number;/,
  "DAO member summaries must include votingPower."
);

assert.match(
  membersData,
  /https:\/\/nouns\.build\/api\/membersList\/\$\{TOKEN_CONTRACT\}\?chainId=\$\{TOKEN_NETWORK\}/,
  "Member voting power must come from the Nouns Builder members list API."
);

assert.match(
  membersData,
  /votingPower:\s*votingPowerByAddress\.get\(address\) \?\? ownerTokens\.length/,
  "Member voting power must fall back to owned token count when delegate data is unavailable."
);

console.log("ok - members page supports voting power sort");
