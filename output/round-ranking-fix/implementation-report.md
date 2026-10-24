# Automatic round ranking after vote removal

## Root cause

`listRoundSubmissions` ordered entries by persisted `round_winners.winner_position` before current aggregate vote totals. Those winner records are finalized once, so later vote deletions could leave the public page in its original order. The browser refreshed media, but not standings.

## Implemented

- `data/rounds.ts`: current vote totals determine submission ordering. Ties use creation time descending, then submission ID ascending. Current approved entries precede historical visible but ineligible entries. Added a single-statement, SELECT-only public standings read; existing award/winner records are preserved.
- `utils/rounds/standings.ts`: overlays current totals/status on existing entry metadata and sorts without mutating the original response. Handles missing data, empty results and mismatched round responses.
- `pages/api/rounds/[slug]/standings.ts`: public GET for active published rounds; no-store response; only round ID, aggregate total, submission IDs/status/counts. No media or voter identities. Other methods and missing rounds are rejected; failures return a generic message.
- `pages/rounds/[slug].tsx`: refreshes standings every 15 seconds while visible and on focus/reconnect. Current winner badges follow approved entries. Failed standings refresh retains the last available data with a warning; failed image refresh does not revert current rankings. Successful voting also requests fresh standings.
- `tests/round-standings.test.mjs`: regression and endpoint/data-boundary coverage.
- Public endpoint inventory updated for the new route; unrelated API/privacy work preserved.

This applies to all applicable rounds, including ended rounds. No hardcoded Propaganda fix or manual winner-row recalculation is needed for the page's current standings.

## Verification

Passed:

- `node tests/round-standings.test.mjs`
- `node tests/round-media-contract.test.mjs`
- `node tests/round-vote-response.test.mjs`
- `node tests/api-privacy.test.mjs`
- `node tests/admin-round-votes.test.mjs`
- `node tests/round-detail-ssr-image-size.test.mjs`
- `npm run typecheck`
- Focused Next lint on the data module, round page, standings API and standings helper: no warnings/errors.
- Scoped `git diff --check`.

The new regression failed against the original stale-order behavior and passed after the fix. Reversing the sort direction also made it fail, then restoring the correct implementation returned it to green. Tests use synthetic data and stubbed database boundaries; they do not delete live votes. The regression is included in the existing package test chain, preserving prior edits.

## Release status

Implemented locally. Not committed, pushed or deployed. The live website will use this behavior after deployment. Production votes, winner records, awards and payouts were not changed.

Full production build/browser verification was not run; disk space was limited. No new dependency was added. Source code was changed only within the ranking feature and its adjacent checks. Obsidian/source notes, plugin configuration, automation state and memories were not edited; memory was read for context.

[Executed prompt](prompt.md) · [Prompt validation](prompt-validation.md).
