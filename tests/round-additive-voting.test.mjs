import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const loadTsModule = (filePath, requireOverrides = {}) => {
  const source = readFileSync(filePath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  });
  const module = { exports: {} };
  const localRequire = (specifier) =>
    Object.prototype.hasOwnProperty.call(requireOverrides, specifier)
      ? requireOverrides[specifier]
      : require(specifier);

  vm.runInNewContext(transpiled.outputText, {
    require: localRequire,
    module,
    exports: module.exports,
  });

  return module.exports;
};

const voteValidation = loadTsModule(
  resolve(process.cwd(), "utils/rounds/validateRoundVote.ts")
);
const loadRoundVotingPowerModule = (delegatedVotes) =>
  loadTsModule(resolve(process.cwd(), "utils/rounds/getRoundVotingPower.ts"), {
    "./getCollectiveNounVotingPower": {
      getCollectiveNounVotingPower: async () => delegatedVotes,
    },
  });
const roundsSource = readFileSync(resolve(process.cwd(), "data/rounds.ts"), "utf8");
const votingPowerApiSource = readFileSync(
  resolve(process.cwd(), "pages/api/rounds/[slug]/voting-power.ts"),
  "utf8"
);
const roundPageSource = readFileSync(
  resolve(process.cwd(), "pages/rounds/[slug].tsx"),
  "utf8"
);
const globalsSource = readFileSync(
  resolve(process.cwd(), "styles/globals.css"),
  "utf8"
);

const tests = [];
const test = (name, run) => tests.push({ name, run });

test("allows a partial vote allocation", () => {
  assert.equal(
    voteValidation.validateRoundVoteAllocation({
      votingPower: 100,
      votes: [
        { submissionId: "entry-a", voteCount: 40 },
        { submissionId: "entry-b", voteCount: 20 },
      ],
    }),
    undefined
  );
});

test("allows later submissions within the remaining balance", () => {
  assert.equal(
    voteValidation.validateRoundVoteAllocation({
      votingPower: 100,
      usedVotes: 60,
      votes: [{ submissionId: "entry-c", voteCount: 25 }],
    }),
    undefined
  );
});

test("rejects submissions that exceed the remaining balance", () => {
  assert.match(
    voteValidation.validateRoundVoteAllocation({
      votingPower: 100,
      usedVotes: 60,
      votes: [{ submissionId: "entry-c", voteCount: 41 }],
    }),
    /40 vote/
  );
});

test("rejects overwrite-style zero or negative submissions", () => {
  assert.throws(
    () =>
      voteValidation.validateRoundVoteAllocation({
        votingPower: 100,
        usedVotes: 60,
        votes: [{ submissionId: "entry-a", voteCount: -20 }],
      }),
    /positive whole number/
  );
});

test("round voting power reads getVotes from the Collective Noun contract", async () => {
  const calls = [];
  const votingPowerModule = loadTsModule(
    resolve(process.cwd(), "utils/rounds/getCollectiveNounVotingPower.ts"),
    {
      "data/nouns-builder/token": {
        getBalanceOf: async () => {
          throw new Error("balanceOf must not gate round voting power");
        },
      },
      "@/utils/DefaultProvider": { default: {} },
      "@/utils/ethers-compat": {
        Contract: function Contract(address, abi) {
          calls.push({ type: "constructor", address, abi });
          return {
            getVotes: async (walletAddress, options) => {
              calls.push({ type: "getVotes", walletAddress, options });
              return { toString: () => "7" };
            },
          };
        },
      },
      viem: {
        getAddress: (address) => address,
        isAddress: () => true,
      },
    }
  );

  const votingPower = await votingPowerModule.getCollectiveNounVotingPower(
    "0x0000000000000000000000000000000000000001",
    123
  );

  assert.equal(votingPower, 7);
  assert.equal(
    calls[0].address,
    "0x220e41499CF4d93a3629a5509410CBf9E6E0B109"
  );
  assert.match(calls[0].abi.join(" "), /getVotes/);
  assert.equal(calls[1].type, "getVotes");
  assert.equal(
    calls[1].walletAddress,
    "0x0000000000000000000000000000000000000001"
  );
  assert.equal(calls[1].options.blockTag, 123);
});

test("fixed votes per wallet still return zero without delegated Collective Noun votes", async () => {
  const { getRoundVotingPower } = loadRoundVotingPowerModule(0);

  const votingPower = await getRoundVotingPower(
    {
      votingStrategy: "fixed_per_wallet",
      votesPerWallet: 5,
      votingSnapshotBlock: null,
    },
    "0x0000000000000000000000000000000000000001"
  );

  assert.equal(votingPower, 0);
});

test("one vote per wallet still requires delegated Collective Noun votes", async () => {
  const { getRoundVotingPower } = loadRoundVotingPowerModule(0);

  const votingPower = await getRoundVotingPower(
    {
      votingStrategy: "one_per_wallet",
      votesPerWallet: 1,
      votingSnapshotBlock: null,
    },
    "0x0000000000000000000000000000000000000001"
  );

  assert.equal(votingPower, 0);
});

test("token-weighted rounds use delegated Collective Noun votes", async () => {
  const { getRoundVotingPower } = loadRoundVotingPowerModule(4);

  const votingPower = await getRoundVotingPower(
    {
      votingStrategy: "one_per_nft",
      votesPerWallet: 1,
      votingSnapshotBlock: 123,
    },
    "0x0000000000000000000000000000000000000001"
  );

  assert.equal(votingPower, 4);
});

test("round vote persistence is additive and never deletes prior wallet votes", () => {
  const start = roundsSource.indexOf("export const castRoundVotes");
  const section = roundsSource.slice(start);

  assert.doesNotMatch(section, /DELETE FROM round_votes/);
  assert.match(section, /validateRoundVoteAllocation\(\{[\s\S]*usedVotes/);
  assert.match(
    section,
    /ON CONFLICT[\s\S]*vote_count\s*=\s*round_votes\.vote_count\s*\+\s*EXCLUDED\.vote_count/
  );
});

test("round tally queries continue summing all additive vote rows", () => {
  assert.match(
    roundsSource,
    /SELECT submission_id, COALESCE\(SUM\(vote_count\), 0\)::int AS vote_count[\s\S]*FROM round_votes/
  );
  assert.match(
    roundsSource,
    /SELECT COALESCE\(SUM\(vote_count\), 0\)::int AS used_votes[\s\S]*FROM round_votes/
  );
});

test("existing round votes remain reported even when current voting power is zero", () => {
  assert.match(
    votingPowerApiSource,
    /const \[votingPower, usedVotes\] = await Promise\.all\(\[[\s\S]*getRoundVotingPower\(roundForVoting, walletAddress\),[\s\S]*getRoundVoteUsage\(\{ roundId: round\.id, walletAddress \}\),[\s\S]*\]\);/
  );
  assert.match(
    votingPowerApiSource,
    /usedVotes,[\s\S]*remainingVotes:\s*Math\.max\(votingPower - usedVotes, 0\)/
  );
  assert.match(
    roundPageSource,
    /const alreadySubmittedVotes = votingPowerData\?\.usedVotes \|\| 0;/
  );
  assert.match(roundPageSource, /votes submitted/);
});

test("round voting UI separates locked votes, pending votes, and remaining votes", () => {
  assert.match(roundPageSource, /votes submitted/);
  assert.doesNotMatch(roundPageSource, /votes already submitted/);
  assert.match(roundPageSource, /pending votes/);
  assert.doesNotMatch(roundPageSource, /draft votes/);
  assert.match(roundPageSource, /Previously submitted votes cannot be changed/);
  assert.match(roundPageSource, /votes remaining/);
  assert.match(roundPageSource, /lockedVotesBySubmission/);
  assert.match(roundPageSource, /yc-round-locked-vote-pill[\s\S]*\{lockedVotes\} locked/);
  assert.match(globalsSource, /yc-round-locked-vote-pill[\s\S]*color: #212529 !important/);
  assert.match(roundPageSource, /2xl:w-\[640px\][\s\S]*votes submitted/);
  assert.match(roundPageSource, /min-w-\[9\.75rem\][\s\S]*pending votes/);
  assert.match(roundPageSource, /whitespace-nowrap[\s\S]*\{submission\.voteCount\} votes/);
  assert.match(roundPageSource, /New votes/);
});

test("round voting copy describes delegated Collective Noun voting power", () => {
  assert.doesNotMatch(roundPageSource, /Collective Noun held/);
  assert.match(roundPageSource, /delegated Collective Noun vote/);
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
