import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
const require = createRequire(import.meta.url);
const address = "0x0000000000000000000000000000000000000001";
let requests = 0;
let failHolder = true;
let failCounts = true;
let now = 1000;
const source = readFileSync("data/members.ts", "utf8");
const dependencies = {
  "@/utils/profile/identity": { shortenWalletAddress: () => "0x000...001" },
  "@/utils/DefaultProvider": {},
  "@/utils/ethers-compat": {
    Contract: class {
      async getVotes() {
        throw new Error("RPC unavailable");
      }
    },
  },
  "data/member-voting-power": { getMemberVotingPower: async () => new Map() },
  "data/ens": { getEnsNamesForAddresses: async () => ({}) },
  "data/nouns-builder/probe": { getCollectiveNounTokensByIds: async () => [] },
  "data/noundry/submissions": {
    countApprovedNoundrySubmissionsByArtists: async () => {
      if (failCounts) throw new Error("database unavailable");
      return new Map();
    },
  },
  "data/profile": { listProfileMetadata: async () => [] },
  "constants/addresses": { TOKEN_CONTRACT: address, TOKEN_NETWORK: "8453" },
  "constants/urls": { SUBGRAPH_ENDPOINT: "https://example.invalid" },
  "graphql-request": {
    gql: (text) => text,
    GraphQLClient: class {
      async request() {
        if (failCounts) throw new Error("index unavailable");
        return { daos: [{ proposals: [] }] };
      }
    },
  },
};
const module = { exports: {} };
vm.runInNewContext(
  ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText,
  {
    module,
    exports: module.exports,
    require: (name) =>
      name in dependencies ? dependencies[name] : require(name),
    console: { warn() {} },
    setTimeout,
    clearTimeout,
    AbortController,
  AbortSignal,
    Date: class extends Date {
      static now() {
        return now;
      }
    },
    fetch: async () => {
      requests++;
      if (failHolder) {
        failHolder = false;
        throw new Error("temporary timeout");
      }
      return {
        ok: true,
        json: async () => ({
          membersList: [{ voter: address, tokens: [7], tokenCount: 1 }],
        }),
      };
    },
  }
);
const { getDaoMembers } = module.exports;
const [first, concurrent] = await Promise.all([
  getDaoMembers(),
  getDaoMembers(),
]);
assert.equal(
  first[0].votingPower,
  null,
  "Unavailable voting power must not be presented as zero"
);
assert.equal(
  first[0].noundrySubmissionCount,
  null,
  "Database failure must not become a zero trait count"
);
assert.equal(
  first[0].proposalVoteCount,
  null,
  "Index failure must not become a zero vote count"
);
assert.equal(
  first[0].tokenCount,
  1,
  "Optional enrichment failures must retain current ownership"
);
assert.strictEqual(
  first,
  concurrent,
  "Simultaneous refreshes share one request"
);
assert.equal(
  requests,
  2,
  "Transient holder fetch is retried once, not once per viewer"
);
failCounts = false;
now += 16_000;
const fresh = await getDaoMembers();
assert.equal(
  fresh[0].noundrySubmissionCount,
  0,
  "A successful empty count is a real zero"
);
assert.equal(fresh[0].proposalVoteCount, 0);
assert.equal(requests, 3, "Expired snapshots must reload the holder source");
console.log(
  "ok - members retry, share refreshes, and distinguish missing stats from zero"
);
