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

const form = loadTsModule(
  resolve(process.cwd(), "utils/rounds/admin-round-form.ts")
);

const tests = [];
const test = (name, run) => tests.push({ name, run });

test("keeps a previously saved ISO value when the date input is unchanged", () => {
  const savedValue = "2026-06-15T14:30:45.123Z";

  assert.equal(
    form.dateInputToPreservedIso("2026-06-15T14:30", savedValue),
    savedValue
  );
});

test("converts a changed date input into an ISO value", () => {
  const input = "2026-06-16T09:45";

  assert.equal(
    form.dateInputToPreservedIso(
      input,
      "2026-06-15T14:30:45.123Z"
    ),
    new Date(input).toISOString()
  );
});

test("uses submissions open as the round start date in admin payloads", () => {
  const dates = form.getAdminRoundDatePayload(
    {
      submissionsOpenAt: "2026-06-15T14:30",
      votingStartsAt: "2026-06-20T14:30",
      votingEndsAt: "2026-06-25T14:30",
    },
    {
      startsAt: "2026-06-01T12:00:00.000Z",
      submissionsOpenAt: "2026-06-15T14:30:45.123Z",
      votingStartsAt: "2026-06-20T14:30:30.000Z",
      votingEndsAt: "2026-06-25T14:30:30.000Z",
    }
  );

  assert.equal(dates.startsAt, "2026-06-15T14:30:45.123Z");
  assert.equal(dates.submissionsOpenAt, "2026-06-15T14:30:45.123Z");
  assert.equal(dates.votingStartsAt, "2026-06-20T14:30:30.000Z");
  assert.equal(dates.votingEndsAt, "2026-06-25T14:30:30.000Z");
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
