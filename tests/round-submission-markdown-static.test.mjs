import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../pages/rounds/[slug].tsx", import.meta.url),
  "utf8"
);

test("round submission descriptions render GitHub-flavored Markdown", () => {
  assert.match(source, /import ReactMarkdown from "react-markdown";/);
  assert.match(source, /import remarkGfm from "remark-gfm";/);
  assert.match(
    source,
    /<ReactMarkdown[\s\S]*remarkPlugins=\{\[remarkGfm\]\}[\s\S]*\{visibleBlocks\.join\("\\n\\n"\)\}[\s\S]*<\/ReactMarkdown>/
  );
});

test("round submission Markdown keeps list and heading typography scoped", () => {
  assert.match(source, /prose-headings:font-heading/);
  assert.match(source, /prose-ul:my-0/);
  assert.match(source, /prose-ol:my-0/);
  assert.doesNotMatch(source, /const heading = block\.match/);
});
