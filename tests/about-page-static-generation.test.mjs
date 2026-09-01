import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const aboutPage = readFileSync(
  resolve(process.cwd(), "pages/about.tsx"),
  "utf8"
);

assert.match(
  aboutPage,
  /process\.env\.NEXT_PHASE === "phase-production-build"[\s\S]*contract: getFallbackContract\(\)[\s\S]*addresses: getFallbackAddresses\(\)[\s\S]*founders: \[\][\s\S]*delegates: \[\][\s\S]*treasuryBalance: null[\s\S]*revalidate: 1/,
  "Production builds must render complete About fallbacks and defer external data loading to ISR."
);

const buildGuardIndex = aboutPage.indexOf(
  'process.env.NEXT_PHASE === "phase-production-build"'
);
const contractRequestIndex = aboutPage.indexOf(
  "contract = await getContractInfo",
  aboutPage.indexOf("export const getStaticProps")
);

assert.ok(buildGuardIndex >= 0, "About page must guard production builds.");
assert.ok(
  buildGuardIndex < contractRequestIndex,
  "The production-build guard must run before About starts external requests."
);

assert.match(
  aboutPage,
  /return \{[\s\S]*props: \{[\s\S]*contract,[\s\S]*addresses,[\s\S]*founders: foundersWithDisplayNames,[\s\S]*delegates: delegatesWithDisplayNames,[\s\S]*treasuryBalance,[\s\S]*revalidate: 60/,
  "ISR must keep the live About data path after deployment."
);

console.log("ok - about page defers external data loading until ISR");
