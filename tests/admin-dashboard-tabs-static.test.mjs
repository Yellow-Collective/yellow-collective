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
const notificationsBranchIndex = source.indexOf('activeSection === "notifications"');
const notificationsPanelIndex = source.indexOf("<NotificationsAdminPanel");
const roundsPanelIndex = source.indexOf("<RoundsAdminPanel");

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
assert.ok(
  testingPanelIndex > roundsPanelIndex,
  "Testing settings should render below tab content instead of at the top."
);
assert.ok(
  testingPanelIndex > notificationsPanelIndex,
  "Testing settings should not render before the notifications panel."
);
assert.match(
  source,
  /activeSection !== "notifications"/,
  "Testing settings should not render on the notifications tab."
);
assert.ok(
  notificationsPanelIndex > notificationsBranchIndex,
  "Notifications panel must render inside the notifications tab branch."
);

assert.match(
  source,
  /const result = await sendAdminRequest\(\s*`\/api\/admin\/rounds\/\$\{encodeURIComponent\(round\.id\)\}`[\s\S]*const updatedRound = result\.round as Round \| undefined;/,
  "Round saves must read the updated round returned by the PATCH response."
);
assert.match(
  source,
  /current\.rounds\.map\(\(cachedRound\) =>[\s\S]*cachedRound\.id === updatedRound\.id[\s\S]*\? updatedRound[\s\S]*: cachedRound/,
  "Round saves must immediately replace the edited round in the local admin cache."
);

console.log("ok - admin dashboard static checks passed");
