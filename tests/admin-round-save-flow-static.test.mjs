import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const dashboardSource = readFileSync(
  resolve(process.cwd(), "pages/admin/dashboard.tsx"),
  "utf8"
);

const roundEditorStart = dashboardSource.indexOf("const RoundEditor =");
const roundSubmissionsStart = dashboardSource.indexOf(
  "const RoundSubmissionsManager ="
);

assert.notEqual(roundEditorStart, -1);
assert.notEqual(roundSubmissionsStart, -1);

const roundEditorSource = dashboardSource.slice(
  roundEditorStart,
  roundSubmissionsStart
);

assert.match(
  roundEditorSource,
  /\/api\/admin\/rounds\/\$\{encodeURIComponent\(round\.id\)\}/,
  "round saves should safely address the selected round id"
);
assert.match(
  roundEditorSource,
  /const result = await sendAdminRequest/,
  "round saves should keep the PATCH response"
);
assert.match(
  roundEditorSource,
  /const updatedRound = result\.round as Round \| undefined/,
  "round saves should read the updated round from the API response"
);
assert.match(
  roundEditorSource,
  /cachedRound\.id === updatedRound\.id[\s\S]*\? updatedRound[\s\S]*: cachedRound/,
  "round saves should replace stale cached draft data with the saved round"
);
assert.match(
  roundEditorSource,
  /\{ revalidate: false \}[\s\S]*await mutate\(\)/,
  "round saves should update local admin state before revalidating"
);
