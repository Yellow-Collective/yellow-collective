import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "pages/rounds.tsx"), "utf8");

assert.match(
  source,
  /const upcomingRounds = rounds\s*\.filter\(\(round\) => getRoundState\(round\) === "upcoming"\)\s*\.sort\(compareRoundsBySubmissionsOpenAt\)/,
  "The /rounds Upcoming section must sort upcoming rounds explicitly."
);

assert.match(
  source,
  /const compareRoundsBySubmissionsOpenAt = \(left: Round, right: Round\) =>\s*new Date\(left\.submissionsOpenAt\)\.getTime\(\) -\s*new Date\(right\.submissionsOpenAt\)\.getTime\(\)/,
  "Upcoming rounds must be ordered by submissionsOpenAt ascending."
);

console.log("ok - rounds page sorts upcoming rounds by submissions open date");
