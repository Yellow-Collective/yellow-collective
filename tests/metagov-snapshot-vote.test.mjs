import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path) => readFileSync(resolve(process.cwd(), path), "utf8");

const voteApi = read("pages/api/metagov/snapshot/vote.ts");
assert.match(
  voteApi,
  /const snapshotProposal = await getSnapshotProposalForNouns\(proposalNumber\);[\s\S]*getCollectiveNounVotingPower\(\s*recoveredAddress,\s*Number\(snapshotProposal\.snapshot\)\s*\)/,
  "Snapshot vote proxy must check holder voting power at the proposal snapshot block before forwarding."
);
console.log("ok - Snapshot vote proxy uses proposal snapshot block for holder gating");

const statusApi = read("pages/api/metagov/snapshot/nouns/[proposalNumber].ts");
assert.match(
  statusApi,
  /const userVotingPower =[\s\S]*voter && proposal[\s\S]*getCollectiveNounVotingPower\(voter, Number\(proposal\.snapshot\)\)[\s\S]*userVotingPower,/,
  "Snapshot status API must expose the connected wallet's proposal-snapshot voting power."
);
console.log("ok - Snapshot status API returns proposal-snapshot voting power");

const voteCard = read("components/NounsSnapshotVoteCard.tsx");
assert.equal(
  voteCard.includes("/api/token/${TOKEN_CONTRACT}/balance/${address}"),
  false,
  "Snapshot vote card must not gate metagov votes on live token balance."
);
assert.match(
  voteCard,
  /Number\(data\?\.userVotingPower \|\| 0\) > 0/,
  "Snapshot vote card must use the status API's proposal-snapshot voting power."
);
console.log("ok - Snapshot vote card uses proposal-snapshot voting power");
