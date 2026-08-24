import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const transpile = (filePath, dependencies = {}) => {
  const source = readFileSync(filePath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  const module = { exports: {} };

  vm.runInNewContext(output, {
    Date,
    module,
    exports: module.exports,
    require: (specifier) => dependencies[specifier] ?? require(specifier),
  });

  return module.exports;
};

const state = transpile(resolve(process.cwd(), "utils/rounds/state.ts"));
const homepageRounds = transpile(
  resolve(process.cwd(), "utils/rounds/homepage.ts"),
  { "./state": state }
);
const homepageSource = readFileSync(
  resolve(process.cwd(), "pages/index.tsx"),
  "utf8"
);
const sectionSource = readFileSync(
  resolve(process.cwd(), "components/rounds/HomepageActiveRounds.tsx"),
  "utf8"
);

const now = new Date("2026-01-10T12:00:00.000Z");
const round = (slug, overrides = {}) => ({
  slug,
  title: slug,
  image: "",
  status: "published",
  active: true,
  startsAt: "2026-01-01T00:00:00.000Z",
  submissionsOpenAt: "2026-01-01T00:00:00.000Z",
  votingStartsAt: "2026-01-20T00:00:00.000Z",
  votingEndsAt: "2026-01-30T00:00:00.000Z",
  ...overrides,
});

const tests = [];
const test = (name, run) => tests.push({ name, run });

test("selects only open rounds, preserves ordering, and caps the homepage at three", () => {
  const selected = homepageRounds.selectHomepageActiveRounds(
    [
      round("submissions-one"),
      round("upcoming", { startsAt: "2026-02-01T00:00:00.000Z" }),
      round("voting-one", { votingStartsAt: "2026-01-05T00:00:00.000Z" }),
      round("ended", {
        votingStartsAt: "2025-12-01T00:00:00.000Z",
        votingEndsAt: "2025-12-31T00:00:00.000Z",
      }),
      round("submissions-two"),
      round("voting-two", { votingStartsAt: "2026-01-05T00:00:00.000Z" }),
    ],
    true,
    now
  );

  assert.equal(selected.length, 3);
  assert.equal(
    selected.map(({ slug }) => slug).join(","),
    "submissions-one,voting-one,submissions-two"
  );
  assert.equal(selected[0].state, "submissions_open");
  assert.equal(selected[0].deadline, "2026-01-20T00:00:00.000Z");
  assert.equal(selected[1].state, "voting_open");
  assert.equal(selected[1].deadline, "2026-01-30T00:00:00.000Z");
});

test("returns no homepage rounds when the public feature gate is disabled", () => {
  assert.equal(
    homepageRounds.selectHomepageActiveRounds([round("open")], false, now)
      .length,
    0
  );
  assert.equal(
    homepageRounds.selectHomepageUpcomingRounds([round("upcoming")], false, now)
      .length,
    0
  );
});

test("selects the next two upcoming rounds in opening order", () => {
  const selected = homepageRounds.selectHomepageUpcomingRounds(
    [
      round("later", {
        startsAt: "2026-02-01T00:00:00.000Z",
        submissionsOpenAt: "2026-02-10T00:00:00.000Z",
      }),
      round("active"),
      round("first", {
        startsAt: "2026-01-15T00:00:00.000Z",
        submissionsOpenAt: "2026-01-18T00:00:00.000Z",
      }),
      round("second", {
        startsAt: "2026-01-20T00:00:00.000Z",
        submissionsOpenAt: "2026-01-25T00:00:00.000Z",
      }),
    ],
    true,
    now
  );

  assert.equal(selected.length, 2);
  assert.equal(selected.map(({ slug }) => slug).join(","), "first,second");
  assert.equal(selected[0].state, "upcoming");
  assert.equal(selected[0].deadline, "2026-01-18T00:00:00.000Z");
});

test("loads rounds defensively without changing homepage ISR", () => {
  assert.doesNotMatch(homepageSource, /getRoundsPublicEnabled\(\)/);
  assert.match(homepageSource, /listPublicRounds\(\)/);
  assert.match(
    homepageSource,
    /catch\s*\(error\)[\s\S]*console\.error[\s\S]*activeRounds\s*=\s*\[\][\s\S]*upcomingRounds\s*=\s*\[\]/
  );
  assert.match(homepageSource, /revalidate:\s*60/);
});

test("renders the active-round section between Hero and Description", () => {
  const hero = homepageSource.indexOf("<Hero />");
  const activeRounds = homepageSource.indexOf("<HomepageActiveRounds");
  const description = homepageSource.indexOf("<Description />");

  assert.ok(hero >= 0 && hero < activeRounds && activeRounds < description);
});

test("hides empty results and links cards plus the all-rounds action correctly", () => {
  assert.match(
    sectionSource,
    /if \(rounds\.length === 0 && upcomingRounds\.length === 0\) return null/
  );
  assert.match(sectionSource, /href=\{`\/rounds\/\$\{round\.slug\}`\}/);
  assert.match(sectionSource, /href="\/rounds"/);
  assert.equal((sectionSource.match(/View all rounds/g) || []).length, 1);
  assert.match(sectionSource, /id="upcoming-rounds-heading"/);
  assert.match(sectionSource, />\s*Next up\s*</);
  assert.equal(
    (sectionSource.match(/mx-auto w-full max-w-\[1180px\]/g) || []).length,
    2
  );
  assert.match(sectionSource, /grid gap-5 md:grid-cols-2/);
  assert.doesNotMatch(sectionSource, /xl:grid-cols-3/);
  assert.doesNotMatch(sectionSource, />Submit</);
  assert.doesNotMatch(sectionSource, />Vote now</);
  assert.doesNotMatch(sectionSource, />Coming soon</);
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

if (failures > 0) process.exitCode = 1;
