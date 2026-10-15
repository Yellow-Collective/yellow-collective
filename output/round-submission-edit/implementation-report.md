# One-time owner edit: implementation evidence

Prompt: [execution-prompt.md](execution-prompt.md).

## Behavior
Connected owners get an Edit link on eligible public cards and a My submissions link on the round. The edit page requests a wallet signature to privately load either an owned entry or an owned summary list; pending entries are discoverable. No private submission data is serialized into SSR.

A visible warning explains the one-time allowance. Save edits asks for confirmation before signing or sending PATCH. Cancel leaves the draft intact. Saved entries become read-only; failed requests preserve the draft and offer signed reload to resolve uncertain outcomes. Wallet changes clear loaded data and block stale signed responses. A one-second clock updates deadline eligibility in the UI.

Projects support title, description, image gallery and URL edits. Existing video stays unchanged. Trait edits support title/description only; canonical generated SVG, link, identity and source payload remain unchanged. The existing Noundry generated-image validator verifies unchanged trait previews, while user-edited descriptions render directly instead of being hidden by the original auto-description flag.

## Authoritative data rules
| Invariant | Enforcement |
| --- | --- |
| Owner identity | Existing action/path/payload-bound signed request; derived wallet is a SQL predicate |
| Eligible entry | Approved/pending, nondeleted; hidden/rejected/deleted denied |
| Eligible round | Published, active, nondeleted; strict cutoff at voting_starts_at |
| One successful user edit | Nullable user_edited_at is updated atomically and required NULL on UPDATE |
| Concurrent saves / timing | Round FOR SHARE, submission FOR UPDATE, transaction-scoped timeouts; UPDATE repeats owner/status/NULL checks and clock_timestamp() deadline |
| Immutable fields | Strict field allowlist plus narrow UPDATE; no wallet/video/trait/source/status/vote changes |
| Admin behavior | Existing admin UPDATE neither consumes nor clears user_edited_at |
| Moderation | Existing auto-approved policy preserved; pending entries remain pending |
| Invalid/no-op request | Validation precedes UPDATE; rollback does not consume allowance |
| Privacy | Signed owner-only GET; no-store/private response headers and bounded summary list omitting image payloads |

Existing unchanged galleries survive metadata-only edits; changed media follows prior GIF/URL/count/size validation. Response recovery uses the returned saved row after COMMIT and signed reload; no mandatory post-commit reread or blind second consumption occurs.

## Files
- utils/rounds/submission-edit.ts: allowlist parser, eligibility and typed errors.
- data/rounds.ts: durable timestamp mapping, owner read and transactional edit functions; existing unrelated voting changes preserved.
- scripts/rounds-schema.sql: additive nullable user_edited_at column; existing request-time initialization also adds it consistently with repository conventions.
- utils/rounds/auth.ts: read/edit signed actions.
- pages/api/rounds/[slug]/my-submissions.ts and submissions/[submissionId]/edit.ts: authenticated owner endpoints.
- components/rounds/RoundSubmissionEditor.tsx and pages/rounds/[slug]/edit.tsx: private load, editing and confirmation flow.
- pages/rounds/[slug].tsx: owner Edit and My submissions links; existing dirty changes preserved.
- utils/noundry/round-trait-submission.ts: show owner-edited descriptions.
- tests/round-submission-edit.test.mjs and tests/round-submission-edit-ui.test.mjs: registered in npm test.
- Existing voting and video-attachment test loaders now resolve the new edit-policy import; their behavioral assertions and unrelated dirty work were preserved.

## Directly observed verification
- First policy test failed before implementation (missing policy module), then passed.
- `node tests/round-submission-edit.test.mjs`:9 groups passed. Tests use actual data/API functions with synthetic auth/fake PostgreSQL, including owner/cross-owner/wrong resource/status/deletion/deadline/at-UPDATE expiry/used edit/invalid/no-op denial, concurrent serialized fixture attempts with one winner, durable reload, admin allowance preservation and actual generated SVG trait regression.
- `node tests/round-submission-edit-ui.test.mjs`:4 runtime component tests passed. Main-owned controlled React hooks exercise cancel/no request, confirmation before signing/PATCH, success disabling another edit, failed-save draft recovery, wallet changes, deadline and trait controls.
- `npm run typecheck`: exit0 after implementation.
- `npm test`: final full suite passed with exit0 after updating the existing test loaders for the new module. Both new edit test scripts are included.
- `git diff --check`: exit0.
- `npm run lint`: passed with the three existing image-element warnings in community pages and treasury TokenLogo.
- `npm run build`: passed with database URL variables overridden to a closed loopback port, preventing live schema/data access. Static generation used existing fallbacks. A final display-label encoding correction was subsequently exercised by the component runtime tests.
- Actual browser tooling was unavailable: the current browser inventory was empty. A synthetic browser fixture was prepared but could not be exercised; its local server was stopped.

## Release and evidence limits
No live database, signatures, migrations, provider uploads, installs, commits, pushes or deployments were executed. PostgreSQL concurrency, lock scheduling, SQL compatibility and schema migration were not exercised against a real database; serialized fake-transaction tests verify intended decisions but do not prove database behavior. No query-plan or performance claim is made. A real browser/layout/accessibility review remains unverified.

The nullable timestamp is additive and old-code compatible. Rollback should leave it intact so used edit allowances cannot reappear; no down migration is supplied. Actual approved release must apply/verify the additive column before serving requests that select it. This repo also initializes schema during requests; that existing behavior was preserved, not exercised against live data.

Source notes, Obsidian settings, plugin configuration, imported notes and automation state were untouched. Relevant memory was read for workspace scope conventions; no memories were updated.
