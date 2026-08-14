import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const pageSource = readFileSync(
  resolve(process.cwd(), "pages/noundry/traits/[id].tsx"),
  "utf8"
);
const globalStyles = readFileSync(
  resolve(process.cwd(), "styles/globals.css"),
  "utf8"
);

const tests = [];
const test = (name, run) => tests.push({ name, run });

test("round submission modal keeps its text dark in dark mode", () => {
  const dialogStart = pageSource.indexOf('aria-labelledby="submit-trait-round-title"');
  const dialogEnd = pageSource.indexOf("const RoundTraitPreviewGrid", dialogStart);
  const dialogSource = pageSource.slice(dialogStart, dialogEnd);

  assert.ok(dialogStart >= 0, "expected the round submission dialog");
  assert.match(
    dialogSource,
    /className="[^"]*yc-dark-noundry-submit-text[^"]*max-h-\[90vh\]/
  );
  assert.match(
    globalStyles,
    /\[data-theme="dark"\] \.yc-dark-noundry-submit-text[\s\S]*?color: #212529 !important;/
  );
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
