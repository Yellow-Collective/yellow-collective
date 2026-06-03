import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(
  resolve(process.cwd(), "pages/admin/dashboard.tsx"),
  "utf8"
);

assert.match(
  source,
  /id:\s*"access",\s*label:\s*"Admin Access"/,
  "Admin Access must be represented as its own dashboard tab."
);

const accessBranchIndex = source.indexOf('activeSection === "access"');
const accessPanelIndex = source.indexOf("<AdminAccessPanel");
const testingPanelIndex = source.indexOf("<TestingSettingsPanel");

assert.notEqual(
  accessBranchIndex,
  -1,
  "Dashboard render logic must include an active access section branch."
);
assert.ok(
  accessPanelIndex > accessBranchIndex,
  "AdminAccessPanel must render inside the access tab branch, not before every section."
);
assert.ok(
  accessPanelIndex < testingPanelIndex,
  "Testing settings should remain outside the scoped access tab branch."
);

console.log("ok - admin access renders as its own dashboard tab");
