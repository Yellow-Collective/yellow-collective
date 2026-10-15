# Video preview release

Completed 2026-10-13. Production has not been released or promoted.

## Review and testing URL

https://yellow-collective-6u2f9swtj-satori-ffbfc349.vercel.app/rounds/video-preview-test

Vercel authentication protects this preview. A deployment-scoped share link is delivered privately in the chat; the bypass token is intentionally excluded from versioned documentation. Seeded preview data includes an existing image entry and a real validated two-second video. This round has no prizes and accepts test entries only.

## Git and deployment

- Remote: Yellow-Collective/yellow-collective, branch feat/round-video-preview.
- Commits: 551b58f9 (feature and guarded migration harness), 20d4ad58 (required shared database-helper export).
- Tested source revision: 20d4ad58f0b706819f8b7e3c94515df2272a14b9.
- Vercel deployment: dpl_4zfYk5isshj9958cxf8ds6pfUcvB, target preview, observed READY.
- Existing unrelated Nouns, voting and CSS work is preserved and remains uncommitted.

## Isolated backend

- Railway project yellowcollective: 53f4c7af-c783-4270-a926-cc21f92604f5.
- Preview environment round-video-preview: ebd9d175-85ba-4bea-8cd7-d5986ed03be2; created without copying production data.
- Private bucket: round-video-preview, iad, 47a58255-8636-493a-82d4-74a7336f429f.
- Preview PostgreSQL service: Postgres--vBH, 42b2eb68-78e2-4738-9dbb-5d18b168db20, PostgreSQL 18.6. Public TLS TCP endpoint supports Vercel access; test marker/fingerprints enforce preview identity.
- Validation worker: round-video-worker, 12215075-e46d-4b54-bafe-33ca7052e340. Deployment a410aa43-d246-4f45-8f03-171c13347758 observed SUCCESS; deployed worker files are unchanged by the subsequent web-only export fix.
- Worker endpoint: https://round-video-worker-round-video-preview.up.railway.app/validate. Bearer authentication required.
- Bucket/database/worker settings are configured only for the feature branch's Vercel Preview target. Production variables were not changed.
- CORS allows the exact deployment and branch-preview origins. Storage/worker credentials and share tokens are excluded from Git and this report.

## Observed verification

- Clean archive of committed 20d4ad58: full yarn test and typecheck passed; hosted build passed.
- Actual PostgreSQL migration and reapplication preserved image entries and text foreign keys. Actual application reservation and attachment functions were tested through independent connections for wallet locks, parallel quota attempts, ownership, image/video slot races and video reuse. Storage calls were stubbed for this database-specific rehearsal.
- Real Railway bucket POST accepted a small valid fixture and rejected an upload over its signed size boundary. Exact-origin upload CORS configured and read back.
- Deployed ffprobe worker accepted H.264/AAC and rejected an unsupported codec. Conditional promotion prevented overwriting the approved object on replay; byte Range reads succeeded.
- Deployed Vercel capability, round/image/video metadata and signed playback endpoints passed. Anonymous upload denied with 401; missing video denied with 404; CSP included the actual bucket playback origin.
- Browser round rendered both image and video fixtures. Video played to completion (duration/currentTime 2 seconds, readyState 4, no media error). Submission form displayed the optional video input and correct limits; it remained disabled until wallet connection.
- GET Range responses did not include an Access-Control-Allow-Origin header in the Node probe. The implemented native video player uses no crossorigin attribute and played successfully. Future JavaScript cross-origin media processing would require separately verifying GET CORS.

## Final user testing and production gate

Use the shared preview link, open Submit entry, connect the intended wallet, add a cover image and an MP4 under 100 MiB/two minutes, approve the upload/validation/submission message signatures, and verify the submitted video appears and plays. Test cancellation/retry and mobile/Farcaster separately. No onchain transaction is required for submission.

The user-held wallet flow, mobile Safari and Farcaster are deliberately left for final acceptance. Production bucket/worker/database configuration and migration are still separate from this isolated preview. A production rollout must use its own verified configuration, reviewed migration and explicit release/promotion authorization; do not promote this preview with its preview database credentials.

New preview resources incur normal Railway storage/compute and Vercel preview build usage until retained or removed. No recurring cleanup job was scheduled. No production services, production data, vault files, plugin settings, automations or memory were modified.
