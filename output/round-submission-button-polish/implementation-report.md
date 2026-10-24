# Submission button polish — local result

Implemented the execution prompt in three source files:
- pages/rounds/[slug].tsx: raised card Edit links; blue raised My submissions control grouped directly left of the counter, with the pair wrapping together.
- components/rounds/RoundSubmissionEditor.tsx: blue raised explicit load control, including disabled treatment.
- pages/rounds/[slug]/edit.tsx: raised circular back arrow next to the round-return text. Both share the parent round destination.

Automatic loading was deliberately omitted under the requested fallback: pages/api/rounds/[slug]/my-submissions.ts verifies a signed owner read, and the client requests a fresh bounded signature for GET. Connecting a wallet alone does not authorize that protected request. No automatic signature prompts or authentication changes were introduced.

Verification:
- TypeScript check passed.
- Targeted lint passed without warnings/errors.
- Existing editor UI tests: 10 passed.
- Existing editor/API checks: 9 passed.
- Existing wallet UI tests: 5 passed.
- git diff --check passed.
- Browser fixture inspected desktop toolbar/editor and 375px toolbar wrapping; blue raised load/My submissions, raised Edit, and return-arrow appearance confirmed. Fixture uses synthetic data, wallet and signing responses and a partial site shell; it does not prove full-route, real-wallet or production behavior.

Local source only. No commit, push, deployment, production writes, signatures or transactions. Unrelated artwork preserved. No source notes, Obsidian settings, plugin configuration, imported notes or automation state changed. Relevant prior authentication memory was read and verified against current source; memory was not updated.

Production build: passed; all 16 static pages generated. Existing unrelated image-element lint warnings remain. Initial sandbox worker spawn failed with EPERM; authorized local retry succeeded.
