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
  });

  return module.exports;
};

const voteValidation = loadTsModule(
  resolve(process.cwd(), "utils/rounds/validateRoundVote.ts")
);
const roundsSource = readFileSync(resolve(process.cwd(), "data/rounds.ts"), "utf8");
const roundPageSource = readFileSync(
  resolve(process.cwd(), "pages/rounds/[slug].tsx"),
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

test("round voting UI separates locked votes, draft votes, and remaining votes", () => {
  assert.match(roundPageSource, /votes already submitted/);
  assert.match(roundPageSource, /Previously submitted votes cannot be changed/);
  assert.match(roundPageSource, /votes remaining/);
  assert.match(roundPageSource, /lockedVotesBySubmission/);
  assert.match(roundPageSource, /New votes/);
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
