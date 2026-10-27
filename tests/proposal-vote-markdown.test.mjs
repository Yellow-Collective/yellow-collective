import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const ts = require("typescript");
const overrides = {
  "@/components/WalletIdentityLink": { __esModule: true, default: ({ address }) => React.createElement("span", null, address) },
};
for (const name of ["react-markdown", "remark-gfm", "rehype-sanitize"]) {
  overrides[name] = { __esModule: true, default: (await import(name)).default };
}
const module = { exports: {} };
vm.runInNewContext(ts.transpileModule(readFileSync("components/ProposalVoteList.tsx", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText, { module, exports: module.exports, require: name => overrides[name] || require(name) });
const VoteList = module.exports.default;
export const renderVoteList = props => renderToStaticMarkup(React.createElement(VoteList, props));
const vote = reason => ({ voter: "satori.wtf", support: 1, weight: "50", reason });
const renderReason = reason => renderVoteList({ votes: [vote(reason)] });

export const sampleReason = `I have some reservations here:

- Only 71 people have played trivia in the 8 months since the app went live
- The system for determining Yellow membership hasn't been figured out
- There are no details on the prizes allocated for Yellow holders
- The prop says all funds will go to prizes but then also says 60% will go to prizes (assuming this was likely an accident left in from an earlier draft?)
- It isn't really art related so doesn't feel very aligned with what I consider the mission of Yellow to be

That being said, the ask is modest enough that I feel it may be worth a shot so I'm voting For. But I don't think I'd support a prop like this again for ETH, would potentially be a good use for DAO owned $yellow though 😊`;

test("vote comment renders screenshot-shaped paragraphs and five actual bullet items", () => {
  const html = renderReason(sampleReason);
  assert.equal((html.match(/<ul>/g) || []).length, 1);
  assert.equal((html.match(/<li>/g) || []).length, 5);
  assert.match(html, /<p>I have some reservations here:<\/p>/);
  assert.match(html, /<p>That being said,[\s\S]*😊<\/p>/);
  assert.ok(!html.includes("- Only 71"));
  assert.match(html, /satori\.wtf/);
  assert.match(html, /50 votes/);
  assert.match(html, />For</);
});

test("ordered/nested lists, emphasis, safe links, quotes and code render semantically", () => {
  const html = renderReason("1. **First**\n   - *Nested*\n2. ~~Second~~ and `code`\n\n[Details](https://example.com)\n\n> Quote\n\n```js\nconst value = 1;\n```");
  for (const tag of ["ol", "ul", "strong", "em", "del", "blockquote", "pre", "code"]) assert.ok(html.includes(`<${tag}`), tag);
  assert.match(html, /href="https:\/\/example.com"/);
  assert.match(html, /rel="noopener noreferrer"/);
});

test("GFM tables and hard line breaks remain available", () => {
  const html = renderReason("| Option | Votes |\n| --- | --- |\n| For | 50 |\n\nFirst line  \nSecond line");
  assert.match(html, /<table>/);
  assert.match(html, /<th>Option<\/th>/);
  assert.match(html, /<br\/>/);
});

test("untrusted HTML and unsafe link schemes cannot create active content", () => {
  const html = renderReason('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[Bad](javascript:alert%281%29)\n\n[Data](data:text/html,unsafe)\n\n<iframe src="https://example.invalid"></iframe>');
  assert.doesNotMatch(html, /<script|<iframe|<img|onerror=|href="(?:javascript:|data:)/i);
});

test("Markdown image alternative text is visible without image requests", () => {
  const html = renderReason("![Example image](https://example.invalid/tracker.png)");
  assert.ok(html.includes("Example image"));
  assert.doesNotMatch(html, /<img|src=|tracker\.png/);
});

test("plain text, empty reasons and list states preserve their existing behavior", () => {
  assert.match(renderReason("Plain vote comment"), /<p>Plain vote comment<\/p>/);
  const noReason = renderReason(null);
  assert.match(noReason, /50 votes/);
  assert.ok(!noReason.includes("prose"));
  assert.match(renderVoteList({ isLoading: true }), /Loading votes/);
  assert.match(renderVoteList({ votes: [] }), /No individual votes or comments/);
});
