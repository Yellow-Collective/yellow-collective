# Rounds video submissions: local verification

Verified 2026-10-09. Execution prompt: [execution-prompt.md](execution-prompt.md). Release setup: [setup.md](setup.md).

## Delivered

- One optional MP4 per project submission; existing separate image cover remains required. Defaults: 100 MiB, 120 seconds, H.264 with optional AAC audio, compatible pixel formats and bounded dimensions. Per-round overrides and transcoding are deferred.
- Signed direct POST uploads to private Railway-compatible storage, durable reservations, wallet/round ownership checks, daily quotas, concurrent admission locking, authoritative validation and atomic attachment.
- Isolated ffprobe worker streams to temporary disk and publishes the exact inspected bytes to a separate approved key using a conditional write. Unknown outcomes are quarantined.
- Upload progress, cancellation/retry, gallery badges, native click-to-open playback, expiring GET links and protected admin previews.
- Additive runtime/standalone schema; cleanup defaults to dry-run, validates namespaces and advances through attached staging batches. Existing image ZIP/CSV exports remain image-only.
- Official AWS SDK dependencies pinned to 3.1148.0 with lifecycle scripts disabled.
- Submission creation releases its database connection before the post-commit reread. Existing user voting fixes and unrelated dirty work were preserved.

## Observed checks

| Check | Result |
| --- | --- |
| Full `yarn test`, final code | Passed, including both new behavior/attachment suites and existing image/trait/voting checks |
| `yarn typecheck`, final code | Passed |
| `yarn lint` and build lint | Passed; existing image-element warnings in community pages and treasury TokenLogo |
| Production `yarn build` | Passed; all 16 static pages generated |
| `git diff --check` | Passed |
| Actual ffmpeg/ffprobe fixtures | Accepted H.264/AAC; rejected unsupported MPEG-4 codec, 121-second video and misleading header |
| Actual worker HTTP + AWS SDK against local synthetic S3 | Published inspected bytes; staging mutation could not alter accepted bytes; invalid codec did not publish; conditional replay failed without overwriting |
| Built Next.js runtime with videos/database disabled | GET capability returned false; extra upload fields returned 400; anonymous reserve returned 401; playback returned 503 |
| Cleanup fixtures | Dry-run performed no writes; invalid keys rejected; successful deletes marked; failed deletes retried; processing advanced beyond first 100 records |
| Attachment fixtures | Wrong owner/round, unready, expired, disabled and closed-round uploads rejected; consume/insert atomicity, replay denial and image reservation quota behavior passed |

The sandbox blocked subprocess spawning for ffmpeg and the initial production build. Both checks were rerun successfully with approved escalation. Production build/runtime commands explicitly blanked DATABASE_URL and DATABASE_PUBLIC_URL and disabled videos; no live schema initialization or uploads were exercised. The homepage's missing-database fallback diagnostic was expected in this isolated build. Temporary test files and the local runtime server were cleaned up/stopped.

## Remaining release evidence

- Real PostgreSQL schema compatibility, locking and concurrency across independent connections. Transaction test fixtures do not prove engine behavior.
- Real Railway presigned POST size-policy enforcement, CORS, Range support, virtual-host endpoint configuration and conditional `If-None-Match` writes.
- Worker Docker image build and resource measurements. Docker is unavailable in this workspace.
- Desktop/mobile/Farcaster UI and playback, wallet approval flow, full bucket-to-worker-to-submission integration and failure recovery.
- Enabled deployment must build with the configured storage origins so CSP permits upload/playback. Follow setup.md before activation.

No bucket/worker was provisioned, production migration executed, live data deleted, scheduled job registered, commit created, push performed or deployment made. No source notes, imported notes, .obsidian files, plugin configuration or memory were changed.
