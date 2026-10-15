# Execution prompt: one-time owner edits before round voting

Implement locally in this Next.js Pages Router/React18/TypeScript/PostgreSQL repository. User authorization includes crafting and executing this prompt, without a separate planning approval pause.

## Objective / acceptance
- A connected submission owner sees Edit on eligible public entries and a My submissions entry for authenticated discovery of own pending entries.
- Owners may successfully save edits once, strictly before rounds.voting_starts_at. Existing approved/pending entries eligible; hidden/rejected/deleted entries and inactive/unpublished/deleted rounds rejected. Preserve current auto-approved behavior and pending status.
- Only title, description, ordered images and URL can change. Trait identity/source, video, wallet ownership, votes, moderation and admin fields are immutable on this owner path.
- Show visible one-time warning, then explicit Save edits confirmation before wallet signing. Cancel, invalid requests, rejection and processing failures do not consume the edit. Success stores durable user_edited_at; administrative changes never consume/reset it.
- Reuse existing signed requests bound to chain/domain/action/method/path/payload: round:submission-read for private GET and round:edit for PATCH. Derive wallet server-side. Private reads return no-store headers. Never load private entries from SSR or unsafely cache by URL alone.
- Transaction locks round first (FOR SHARE), submission second (FOR UPDATE); validate authoritative rows and enforce ownership, eligible status, unused timestamp and clock_timestamp() < voting_starts_at again on UPDATE. Concurrent attempts have one winner. Admin field preservation uses narrow column UPDATE.
- Exact unchanged existing galleries can survive metadata-only edits; changed galleries obey existing GIF validation,10-image and payload budgets. No video replacement in this scope.

## Files / plan
1. tests/round-submission-edit.test.mjs: meaningful failing policy and route/data fixtures.
2. utils/rounds/submission-edit.ts: strict editable-field parsing and eligibility; data/rounds.ts + scripts/rounds-schema.sql: additive nullable timestamp, private owner read, atomic owner update.
3. pages/api/rounds/[slug]/my-submissions.ts + pages/api/rounds/[slug]/submissions/[submissionId]/edit.ts: authenticated GET/PATCH with4mb parser, bounded responses and stable errors.
4. pages/rounds/[slug]/edit.tsx and components/rounds/RoundSubmissionEditor.tsx: signed private loading, existing shared image picker, keyboard controls, loading/error/empty/success and immutable video notice. Detail page gains owner Edit and My submissions links.
5. Run focused tests, then full npm test/typecheck/lint/build via main owner. Browser exercise synthetic fixture if available.

## Conventions / commands
Use existing double-quoted TypeScript named exports, React hooks and Tailwind tokens. Example: `export const canEditRoundSubmission = (...) => ...;`. No dependency added. Commands: `node tests/round-submission-edit.test.mjs`, `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.

## Security / boundaries
Apply baseline C05/C06/C07/C19/C22 and parameterized SQL. Tests use fake PostgreSQL/auth and synthetic identities; disclose that fake locking cannot prove PostgreSQL concurrency. No live migration, DB writes, wallet signatures, commits, pushes, deployment, installs or external actions. Preserve existing dirty voting, nouns, detail and stylesheet edits. Additive schema column is compatible with older code; code rollback leaves the edit timestamp intact. Do not drop it or erase consumed edits.

## Trait qualification from repository evidence
Noundry entries use a server-generated inline SVG and canonical trait link, which are not interchangeable with arbitrary uploaded images. Owner trait edits therefore change title/description only; canonical artwork/link remain immutable. Reuse validateDerivedRoundTraitSubmission with stored canonical media and preserve original source payload. Once userEditedAt is set, render the saved description directly rather than treating it as an original automatic description.
