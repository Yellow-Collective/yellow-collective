import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
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

const proposalRouting = loadTsModule(
  resolve(process.cwd(), "utils/proposal-routing.ts")
);
const governorSource = readFileSync(
  resolve(process.cwd(), "data/nouns-builder/governor.ts"),
  "utf8"
);
const proposalListSource = readFileSync(
  resolve(process.cwd(), "pages/proposals.tsx"),
  "utf8"
);
const proposalDetailSource = readFileSync(
  resolve(process.cwd(), "pages/vote/[proposalid].tsx"),
  "utf8"
);

const proposals = [
  { proposalId: "0xabc", proposalNumber: 29 },
  { proposalId: "0xdef", proposalNumber: 28 },
];

test("builds canonical Yellow proposal URLs from proposal numbers", () => {
  assert.equal(
    proposalRouting.getYellowProposalPath(proposals[0]),
    "/proposals/29"
  );
});

test("resolves numbered proposal routes and keeps legacy hash routes working", () => {
  assert.equal(
    proposalRouting.findProposalByRouteParam(proposals, "29"),
    proposals[0]
  );
  assert.equal(
    proposalRouting.findProposalByRouteParam(proposals, "0xDEF"),
    proposals[1]
  );
});

test("loads proposalNumber from the subgraph and uses it in proposal pages", () => {
  assert.match(
    governorSource,
    /proposals\(first: 100, orderBy: proposalNumber,[\s\S]*proposalId\s+proposalNumber/
  );
  assert.match(proposalListSource, /href=\{getYellowProposalPath\(proposal\)\}/);
  assert.match(
    proposalDetailSource,
    /findProposalByRouteParam\(proposals, proposalid\)/
  );
  assert.match(
    proposalDetailSource,
    /router\.replace\(`\/proposals\/\$\{proposal\.proposalNumber\}`/
  );
});
