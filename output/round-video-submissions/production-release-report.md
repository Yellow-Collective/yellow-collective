# Rounds video production release

Released 2026-10-13 with user authorization after preview acceptance.

- Approved source: `17e4bb3280e6f4df85e887dca1396da7c2831043` on `feat/round-video-preview`.
- Vercel production deployment: `dpl_3jZUiy2r6cqK6xKuBZGwPE1XRyR9`. Built with production settings before live domain assignment; observed Ready and promoted successfully.
- Live site: https://www.yellowcollective.art/rounds
- Railway production environment: `2ea8adec-f23c-4f7b-9352-1b5c44385d63` in project `53f4c7af-c783-4270-a926-cc21f92604f5`.
- Private production bucket: `ec297c5d-e407-4c59-986b-b4f20f4843b9`, separate from preview. Upload CORS configured for existing production aliases and read back.
- Production validation worker: `dafd9c2e-8fe2-46d3-8b5e-6066a59f63ba`, deployment `ca38c953-38f0-45f0-a44e-12333359446c`, observed Success. Separate production authentication token and storage credentials.
- Existing production database retained. Additive video migration applied and replayed. Existing 7 database rounds and 16 database submissions remained unchanged by fingerprint. Pre-migration row backup retained locally in ignored `.codex-tmp/round-video-production-backup.json`.
- No preview marker or temporary video test rounds found in production. Live Rounds page confirmed without video test fixtures; `/rounds/video-preview-test` visibly returned 404 after promotion. Historical Future Yellow Rounds contest preserved.
- Real production bucket/worker checks passed: signed POST size denial, valid H.264/AAC acceptance, unsupported codec rejection, Range reads, conditional immutable object publishing. Temporary fixture objects removed; no rounds/submissions were created by these checks.
- Live submission form visibly showed Optional video and format/size/duration limits after hydration. Real user wallet submission was accepted in preview by the user; no new production wallet submission was performed during release.
- Temporary production configuration/credential files removed. Unrelated local changes preserved. No vault, plugin, automation or memory files changed.
- Previous production deployment retained for recovery: `dpl_DRwYW3qhiuqYqw5uZdYUZ2R6Y5kT`. Rolling back web code does not reverse the additive migration.

The source branch was deployed directly; this release did not merge the feature branch into main. Production uses its own configuration and database rather than the preview artifact's database settings.
