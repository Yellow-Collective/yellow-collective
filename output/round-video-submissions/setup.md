# Video submissions: release setup

Local implementation is disabled by default. No bucket, worker, migration, upload, or cleanup was executed against production.

## Configuration

Set these server-only variables on the web service and worker. Never use `NEXT_PUBLIC_` names or put real credentials in versioned files.

```dotenv
ROUND_VIDEOS_ENABLED=false
ROUND_VIDEO_S3_ENDPOINT=https://storage.example.invalid
ROUND_VIDEO_S3_REGION=provider-region
ROUND_VIDEO_S3_BUCKET=private-video-bucket
ROUND_VIDEO_S3_ACCESS_KEY_ID=REPLACE_ON_SERVER
ROUND_VIDEO_S3_SECRET_ACCESS_KEY=REPLACE_ON_SERVER
ROUND_VIDEO_S3_FORCE_PATH_STYLE=false
ROUND_VIDEO_WORKER_URL=https://worker.example.invalid/validate
ROUND_VIDEO_WORKER_TOKEN=REPLACE_WITH_RANDOM_SECRET_AT_LEAST_32_CHARACTERS
```

Use Railway bucket connection details verbatim. New buckets use virtual hosted URLs; set path style only if required by the bucket's connection details. The worker accepts the same shared secret and storage variables, plus `PORT` (default 8080). Worker URL supports HTTPS or HTTP to a `.railway.internal` host only. The flag is needed only by the web service.

1. With separate approval, provision a private Railway bucket. Configure browser CORS for exact site origins (and explicitly allowed local/staging origins), methods POST, GET and HEAD, request headers Content-Type and Range, exposed response headers Content-Length, Content-Range, Accept-Ranges and ETag. No cookies are required. Verify actual provider POST policy and range support.
2. With separate approval, apply `scripts/rounds-schema.sql` to the selected database. Runtime initialization mirrors this additive schema, consistent with the existing app. Review this migration before first enabling deployment. Keep database credentials server-only.
3. Build the isolated worker from repository root with `docker build -f workers/round-video/Dockerfile -t round-video-worker .`. Deploy with one worker instance, limited memory/CPU and ephemeral disk; recommended starting cap 512 MiB memory and 1 CPU, then measure. One active job per process; requests beyond that are rejected. Restrict worker access to the app where provider networking permits. The shared bearer token authenticates every validation request. Docker is not installed in the inspected workspace; image build is a release prerequisite.
4. Configure web/worker variables with the flag still false. Perform the following release checks in an explicitly approved staging deployment built with `ROUND_VIDEOS_ENABLED=true`; that build adds the configured endpoint and bucket origin to its CSP. After checks pass, the final production build/deployment must also use `ROUND_VIDEOS_ENABLED=true`. Changing only a runtime flag after a disabled build is insufficient because the existing app builds response headers from `next.config.js`.
5. Test a real direct POST upload, provider-enforced oversized rejection, accepted H.264/AAC MP4, HEVC/MOV rejection, ownership denial, overwritten staging isolation, worker timeout recovery, and native playback/seek on desktop, mobile Safari and Farcaster. Confirm `If-None-Match: *` is enforced by the bucket for immutable final promotion. Do not enable if unsupported without an equivalent immutable publishing mechanism.

## Lifecycle and controls

One optional video per project entry; a separate existing cover image remains required. Defaults are 100 MiB, 120 seconds, H.264 with optional AAC, 4:2:0 pixels, maximum 4096 × 4096. Per-round overrides are deferred. No transcoding or arbitrary phone MOV/HEVC support.

Wallet signatures bind operation, route and payload through existing signed-request authentication. Postgres serializes reservations globally and per wallet. Limits: one outstanding reservation per wallet/round, ten upload reservations per wallet per day, 500 globally per day, and available round submission slots including outstanding reservations. Image creation shares the wallet lock and counts outstanding reservations. These intentionally conservative limits are fixed in code for this version.

Presigned POST expires after five minutes and is replayable during that window. Files land in isolated staging keys. Reservations expire after thirty minutes. The worker streams at most 100 MiB to ephemeral disk, limits probing to twenty seconds with bounded probe/output sizes, accepts local-file protocol only, then streams exactly the inspected file into a distinct approved object key using a conditional write. The web function handles metadata only. No video bytes enter Postgres or web API bodies.

`pending → validating → ready → attached` is durable. Deterministic invalid videos become rejected. Unknown network/provider outcomes remain validating and cannot be attached; cancel or allow expiry and cleanup before retrying. Cancellation removes the entry reference immediately and releases its reservation; issued POST credentials can remain usable until expiry, which cleanup accounts for. Finalize is idempotent while ready; attachment consumes readiness atomically in the submission transaction. Round state is checked again at attachment.

Public playback resolves only approved, undeleted submissions in public active rounds. Admin previews use existing administrator permission checks and can preview hidden submissions. Object GET URLs last fifteen minutes; native players support Range requests directly to storage. The Refresh playback control generates a new URL after expiry/errors. Playback does not eagerly load in gallery cards and does not autoplay.

## Cleanup and retention

```powershell
node scripts/round-video-cleanup.mjs
# Only after explicit deletion approval:
node scripts/round-video-cleanup.mjs --apply
```

Default is dry-run and only reports counts. Batches are limited to 100 rows. Cleanup waits two hours beyond reservation expiry so upload credentials and worker execution have finished. Unattached/rejected/cancelled/unknown-outcome objects are deleted; attached staging copies are removed while final videos remain. `staging_cleaned_at` records each successful staging deletion so subsequent batches advance. Failed deletions remain eligible for retry. Deleted submission videos receive a 24-hour grace period. Audit rows remain. No recurring job was scheduled. This implementation uses single POST uploads, so no multipart upload sessions require aborting. Operator retention, backups, and any historical orphan sweep require separate review. Keep the reservation rows when archiving/deleting data so ownership and cleanup remain traceable.

Exports deliberately retain existing image ZIP/CSV behavior. Videos are excluded from ZIP downloads to avoid unbounded archives; retrieve them through approved admin playback individually. No expiring media links are added to CSVs.

## Local verification

```powershell
node tests/round-video-submissions.test.mjs
node tests/round-video-attachment.test.mjs
node tests/round-video-worker-runtime.test.mjs # ffmpeg/ffprobe prerequisite
npm run typecheck
npm run lint
npm test
npm run build
```

Stubs verify lifecycle rules; generated local MP4 fixtures verify parser decisions. Neither verifies Railway POST policies, S3 conditional writes, private networking, CORS, real DB lock behavior or mobile playback. Production credentials and provisioning are separate release requirements. AWS SDK dependencies are maintained official SDK modules, pinned to 3.1148.0, installed without lifecycle scripts. Docker currently installs the full existing production dependency tree; a smaller dedicated worker dependency manifest is a future packaging improvement.
