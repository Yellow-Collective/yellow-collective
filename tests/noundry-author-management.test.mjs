import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const loadTypeScriptModule = (relativePath) => {
  const filePath = resolve(process.cwd(), relativePath);
  const source = readFileSync(filePath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  });
  const module = { exports: {} };

  Function(
    "require",
    "module",
    "exports",
    transpiled.outputText
  )(require, module, module.exports);

  return module.exports;
};

const submissions = loadTypeScriptModule("data/noundry/submissions.ts");

assert.equal(
  typeof submissions.validateNoundryAuthorMetadata,
  "function",
  "Noundry author metadata validation must be exported."
);
assert.equal(
  submissions.validateNoundryAuthorMetadata({
    title: "  Updated trait  ",
    traitType: "heads",
  }),
  undefined
);
assert.match(
  submissions.validateNoundryAuthorMetadata({ title: "", traitType: "heads" }),
  /name is required/i
);
assert.match(
  submissions.validateNoundryAuthorMetadata({
    title: "Updated trait",
    traitType: "",
  }),
  /type is required/i
);

const endpoint = readFileSync(
  resolve(process.cwd(), "pages/api/noundry/submissions/[id].ts"),
  "utf8"
);
assert.match(endpoint, /verifySignedRequest/);
assert.match(endpoint, /expectedWalletAddress:\s*submission\.artist/);
assert.match(endpoint, /updateNoundrySubmissionMetadata/);
assert.match(
  endpoint,
  /updateNoundrySubmissionMetadata\([\s\S]*walletAddress[\s\S]*\)/,
  "The metadata write must re-check the signed author in SQL."
);
assert.match(
  endpoint,
  /removeNoundrySubmissionByAuthor\(id, walletAddress\)/,
  "Deletion must re-check the signed author in SQL."
);
assert.doesNotMatch(
  endpoint,
  /updateNoundrySubmission\(/,
  "The author endpoint must not expose the unrestricted admin update helper."
);

const traitPage = readFileSync(
  resolve(process.cwd(), "pages/noundry/traits/[id].tsx"),
  "utf8"
);
assert.match(traitPage, /isCreator\s*&&[\s\S]*?>\s*Edit\s*</);
assert.match(traitPage, /EditTraitModal/);
assert.match(traitPage, /Save metadata/);
assert.match(traitPage, /Delete trait/);
assert.match(traitPage, /Only the name and trait type can be changed/);
assert.match(traitPage, /bg-\[#1d9bf0\][\s\S]*Artist profile/);
assert.match(traitPage, /bg-\[#d63230\][\s\S]*Remix in studio/);

console.log("ok - Noundry authors can securely manage metadata only");
