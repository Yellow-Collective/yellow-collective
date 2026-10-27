# Vote comment Markdown rendering — 2026-10-27

Implemented and validated locally on `main`, starting at `be8bec90`. A subsequent
user request authorized committing and pushing these changes. No deployment,
provider mutation, database write, wallet connection, signing or transaction was
performed.

## Root cause and scope

`components/ProposalVoteList.tsx` put `vote.reason` directly inside a plain
paragraph. HTML collapsed the authored newlines and displayed list markers as
text. The Builder vote API passes `vote.reason` through, and Nouns vote mapping
uses `String(reason || "")`; neither needs a data transformation.

The shared list is used by `pages/vote/[proposalid].tsx` and
`pages/proposals/nouns/[proposalNumber].tsx`, so the fix applies to both.

## Changes

- Replaced the plain paragraph with the already installed ReactMarkdown,
  remark-gfm and rehype-sanitize packages. No dependency or lockfile change.
- Scoped existing `prose-skin` typography to vote comments, with paragraph/list
  spacing, preserved soft line breaks, theme-aware text/code colors, long-text
  wrapping and horizontal scrolling inside code blocks.
- Raw HTML is skipped, unsafe URL handling remains enabled, and links use
  `noopener noreferrer`. Markdown images display their alternative text rather
  than automatically fetching third-party images.
- Preserved comment source text, vote order, weights, support labels, wallet
  identity components, loading/empty states, card styles and all vote actions.
- Added `tests/proposal-vote-markdown.test.mjs` and included it in `yarn test`.

The reusable prompt is in `execution-prompt.md`; its template check and four
refinement passes are in `prompt-validation.md`.

## Verification

| Check | Result |
| --- | --- |
| New actual-render regression before the fix | FAIL, reproducing the missing Markdown structure |
| `node tests/proposal-vote-markdown.test.mjs` after the fix | PASS: 6 tests |
| `node tests/nouns-proposal-detail.test.mjs` | PASS: 4 tests |
| `yarn typecheck` | PASS |
| `yarn lint` | PASS; the existing three `no-img-element` warnings remain |
| `git diff --check` | PASS |
| Installed Edge browser, light/dark at 320/390/1440px | PASS: 6 viewport/theme combinations |

The browser fixture renders the actual component with inert data and the repo's
compiled Tailwind styles and local Pally font. The supplied comment renders as
two paragraphs around five real bullets. Computed list markers are `disc`, the
gap after the list is 12px, and comment line-height is 26px at 16px font size.
Long unbroken text stays inside the card; long code scrolls inside its block.
No page/comment horizontal overflow or image elements were observed, and no
network requests occurred. Desktop and mobile dark screenshots were inspected.

Regressions also cover ordered/nested lists, bold/italic/strikethrough, links,
quotes, inline/fenced code, GFM tables, hard breaks, plain text, empty reasons,
list loading/empty states, preserved visible vote metadata, and unsafe HTML/URLs.

`browser-checks.json` contains the measured results. `dark-1440.png` and
`dark-390.png` show the result, including an explicitly labeled stress fixture;
`before-dark-1440.png` shows the previous renderer with the same reference text.

This is local component and browser-fixture verification. A full production
build, connected proposal page, live vote submission, wallet signing, hosted
data/provider integration and production deployment were not exercised.

## Boundaries

Only the vote-list renderer, test command, focused regression and output
artifacts were changed. Existing site identity was retained; no broad UI audit
or redesign was performed. Applicable security control: C12, untrusted rich-text
rendering. Other auth/storage/database/contract controls were not changed.

The Obsidian prompt library was read only. Source notes, `.obsidian/`, plugin
configuration, imported notes, automation state and memory were not edited.
