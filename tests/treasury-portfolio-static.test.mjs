import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const readSource = (path) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

const treasuryPage = readSource("pages/treasury.tsx");

const tests = [];
const test = (name, run) => tests.push({ name, run });

test("treasury page keeps Pages Router data flow and portfolio components", () => {
  assert.match(treasuryPage, /export const getStaticProps/);
  assert.match(treasuryPage, /revalidate:\s*60/);
  assert.match(treasuryPage, /from "components\/treasury\/TreasuryDonut"/);
  assert.match(treasuryPage, /from "components\/treasury\/TokenLogo"/);
  assert.match(treasuryPage, /from "components\/treasury\/TreasuryTransactions"/);
});

test("treasury page does not render the NFT placeholder panel", () => {
  assert.doesNotMatch(treasuryPage, /TreasuryNftGrid/);
  assert.doesNotMatch(treasuryPage, /TreasuryNftItem/);
});

test("treasury token type includes raw balance metadata for the new UI", () => {
  assert.match(treasuryPage, /address:\s*string/);
  assert.match(treasuryPage, /balanceRaw:\s*string/);
  assert.match(treasuryPage, /decimals:\s*number/);
  assert.match(treasuryPage, /balanceLabel:\s*string/);
});

test("treasury page uses existing explorer and env boundaries", () => {
  assert.match(treasuryPage, /ETHERSCAN_BASEURL/);
  assert.doesNotMatch(treasuryPage, /NEXT_PUBLIC_ALCHEMY_API_KEY/);
  assert.doesNotMatch(treasuryPage, /from "lucide-react"/);
  assert.doesNotMatch(treasuryPage, /components\/ui/);
});

test("treasury header starts directly with the page title", () => {
  assert.doesNotMatch(treasuryPage, /Allocation \/ live/i);
  assert.doesNotMatch(treasuryPage, /<h1 className="mt-2/);
});

test("treasury light cards force readable text in dark mode", () => {
  const lightSurfaceSources = [
    treasuryPage,
    readSource("components/treasury/TreasuryDonut.tsx"),
    readSource("components/treasury/TreasuryTransactions.tsx"),
  ];

  for (const source of lightSurfaceSources) {
    for (const [, className] of source.matchAll(/className="([^"]*)"/g)) {
      if (!className.includes("bg-white")) continue;
      assert.match(className, /yc-force-white/);
    }
  }
});

test("treasury components exist with expected implementation details", () => {
  const componentPaths = [
    "components/treasury/TreasuryDonut.tsx",
    "components/treasury/TokenLogo.tsx",
    "components/treasury/TreasuryTransactions.tsx",
  ];

  for (const path of componentPaths) {
    assert.equal(existsSync(resolve(process.cwd(), path)), true, path);
  }

  const donut = readSource("components/treasury/TreasuryDonut.tsx");
  const tokenLogo = readSource("components/treasury/TokenLogo.tsx");

  assert.match(donut, /useState/);
  assert.match(donut, /<svg/);
  assert.match(donut, /strokeDasharray/);
  assert.match(tokenLogo, /import \{ getAddress \} from "viem"/);
  assert.doesNotMatch(tokenLogo, /require\("viem"\)/);
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
