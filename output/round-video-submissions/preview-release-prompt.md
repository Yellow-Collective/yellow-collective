# Authorized preview release

## Goal and scope
Commit and push the reviewed Rounds video feature to the connected remote on a feature branch. Provision isolated Railway preview storage, validation worker and PostgreSQL; connect those resources only to the corresponding Vercel preview. Test the migration and real upload/validation/playback path, then deliver a READY preview URL for Deej's final testing. Do not release or promote to production.

## Execution prompt
Review the conversation, execution-prompt.md, setup.md and verification.md. Reinspect current source, Git dirty state, repository instructions, provider identity/configuration and tooling. Apply Railway/Vercel release and environment skills, secure-app-baseline and relevant engineering verification. The user explicitly authorizes feature-scoped commits, push to remote, preview infrastructure provisioning, preview-only configuration and migrations/test fixtures. Credentials may be transferred directly between authorized services, never printed or committed.

1. Preserve unrelated Nouns, voting and styling WIP. Isolate the feature commit from pre-existing changes sharing data/rounds.ts and pages/rounds/[slug].tsx. Use a non-production branch and verify connected repo/remote/team/project before push. No main push, production environment writes, merge or production promotion.
2. Provision a separate Railway preview environment in the existing Yellow project, private bucket, bounded ffprobe worker and isolated PostgreSQL. Never fork production data/secrets blindly. Establish environment/database identity before any schema changes or test fixture writes.
3. Review the additive video migration, apply and reapply in the isolated DB, verify legacy/image compatibility and concurrency with independent Postgres connections. Seed only clearly labeled preview test rounds/entries needed for final testing, no user-held signing or transactions.
4. Configure worker storage/auth and Vercel environment variables scoped to this feature's preview branch. Connect preview database/storage only, disable unrelated outbound jobs/notifications and transaction services. Build with video CSP origins configured and feature enabled. Transfer secrets in protected tooling without exposing raw values.
5. Push exact feature changes and deploy a preview from that revision. Verify worker success, preview READY and actual revision. Configure exact browser bucket CORS for the preview origin. Exercise presigned POST enforcement, Range playback, immutable publishing, accepted/rejected video fixtures, authentication/ownership and recoverable failures.
6. Fix provider compatibility and release blockers locally, retest, commit/push scoped corrections and redeploy preview as needed. Do not mark success from upload/exit alone. Record observed evidence separately from pending mobile/Farcaster/user-wallet final testing.
7. Return preview URL, branch/commit, infrastructure scope, checks and clear final-test steps. Stop before production release/promotion; leave existing production untouched.

Approval/account-auth prompts may be required by the runtime. Do not ask again for scope already authorized. If a tool/account blocks a necessary step, complete independent work and report the exact blocker. Do not invent an integration or a working deployment.
