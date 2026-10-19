# Round media bandwidth: local rollout contract

This change is local implementation and synthetic evidence. It has not been deployed, provisioned, or measured against production. The historical October 19 observation (2.8 GB over 161 media requests and 90.51 MB over five vote requests in a recent 12-hour window) is rounded request aggregation, not visitor counts or a reproducible benchmark.

## Contracts and read paths

- `/api/rounds/:slug/media?v=2` returns `{version:2, revision, roundImage, submissionImageSets}`. Each ordered image occurs once. A grid uses index 0's preview; the gallery substitutes `variant=original` for its active image only. Remaining gallery originals are URLs, not downloaded image bytes.
- The existing unversioned media endpoint retains its two legacy fields for old open clients, including the duplicate first reference, but replaces inline bytes with eligibility checked image URLs. Its first image uses the original so old gallery code still animates GIFs. Old clients may transfer larger originals until refreshed; their cost is separate from v2 grid savings.
- Public detail/refresh/submit/list/home props use lightweight SQL projections; the public submission projection allowlists trait metadata needed by the trait card. Explicit serializers strip inline media recursively from copies, including nested source payload fields. Domain objects used by exports, owner reads, and administrator views retain originals and trait data.
- The media SQL does not select original JSON, source payload, vote history, or per-wallet state. Legacy JSON indexing in the asset query selects only the requested image. PostgreSQL may still detoast a legacy JSON document internally; retirement is a separate approval and is needed to remove that retained storage cost.
- `/api/rounds/:slug/asset?id=:id&index=:index&variant=preview|original` rechecks published status, active flag, deletion and approved-or-winner visibility on every request. Ended round readers retain winner finalization. No client object key or remote URL is fetched by this endpoint.
- Migrated assets use a 302 redirect to the private object store. Bytes bypass the application function. Private storage is enabled with independent `ROUND_IMAGE_*` settings; neither Pinata's public persistence nor the video bucket is assumed suitable. See [storage setup](round-image-storage.md).
- Unmigrated assets return one original or one bounded 640px preview. Legacy previews use an authorization-independent in-process byte cache capped at 16 MiB. One decode runs at a time with at most 32 pending requests; overload yields a recoverable 503 with Retry-After. This fallback still incurs application processing and database reads, and is not equivalent to a completed migration.
- GIFs animate directly on the grid using their unchanged original bytes through the same eligibility-checked preview URL. Migrated GIFs sign the original key even when an existing static preview is present; legacy GIFs bypass still-thumbnail processing. Static artwork retains bounded previews, and hidden gallery images remain on demand. Existing stored GIF still previews are retained for compatibility, but are not selected for grid delivery. Previously converted JPEG stills cannot recover their original GIF animation without the original files.
- The prepared private-storage migration and controlled object writes cover submission galleries. Round cover images use the bounded legacy preview route or their existing external URL; this implementation does not migrate inline round covers to private storage. Their fallback database/processing cost is included separately in the benchmark model.
- Canonical Noundry SVG traits remain vectors and use their server-generated stored bytes, `nosniff`, and a sandbox/default-src-none CSP. The legacy delivery route does not parse SVG or fetch embedded references.

## Freshness and moderation

| Layer | Policy |
| --- | --- |
| Public manifest browser TTL | 15 seconds, must revalidate |
| Public manifest CDN TTL | 15 seconds, no stale-while-revalidate allowance |
| Manifest client refresh | 15 seconds while active; reconnect/focus recovery retained |
| Asset gateway redirects/errors | private, no-store, max-age=0 |
| Signed object link | 60 seconds |
| Object response | private, max-age=0, no-store |
| Vote POST, private owner/admin responses, errors | no-store |

Manifest bodies are wholly public and independent of cookies, wallet and administrator state. No personalized or pending body is CDN cached. Vote counts have separate refresh behavior and do not change image revision URLs. The one-second round countdown remains local UI state.

Next.js also emits a manifest ETag. Local production-server conditional requests returned 304 with an empty body and the same public TTL. Eligibility/manifest queries still run before that response; this saves response bytes, not database work.

Every asset request checks current visibility even if the manifest is warm. Hiding/rejection/deletion/unpublishing/deactivation prevents new links immediately after the database state changes. The existing approved-or-winner rule is deliberately preserved: a finalized winner remains publicly eligible according to the existing product rule, even if its status subsequently changes. Changing that rule needs separate product authorization.

Existing signed URLs remain usable for up to 60 seconds after issue. New version URLs do not revoke old URLs. Already downloaded bytes cannot be recalled. An already-open active tab removes ineligible entries on the next successful fresh manifest refresh. A 15-second cached response plus a 15-second client interval permits up to approximately 30 seconds of metadata staleness, plus network latency, under normal active-tab operation. Background/suspended tabs can retain displayed pixels until reactivation, with no finite bound while suspended. On manifest refresh errors the updated client clears artwork and closes the gallery, preserving retry. No claim of immediate browser pixel revocation is made. Existing external public URLs retain their provider's access/cache behavior indefinitely and cannot be revoked by this application.

## Controlled writes and failures

Uploads retain the existing signing and wallet/resource authorization paths. New/changed inline rasters are validated from actual bytes with format signature and bounded native parser checks, including dimensions, total decoded pixels and frame limits. Filenames and MIME declarations are insufficient. Gallery count and aggregate request limits remain enforced. SVG project uploads remain unsupported; trusted Noundry derivation has its existing path.

`ROUND_IMAGE_WRITES_ENABLED` defaults off. With writes off, valid existing inline uploads continue without provider contact. With writes enabled, required private storage must be ready; verified byte storage and preview generation complete before attachment metadata is committed. Failures return recoverable submission errors and retain old data. Original compatibility bytes remain in image/images until retirement is separately approved. Changed galleries clear obsolete asset references; unchanged metadata/trait edits preserve galleries and asset references. Successful object upload followed by database rollback can leave an unreferenced private object; no shared object is automatically deleted. Use migration journals and inventory review to reconcile these orphans.

## Authorized rollout order

1. Review and separately authorize schema/environment/provider/deployment work. Create a dedicated private image namespace with public access blocked, least privilege, required checksum/conditional-write support, appropriate CORS if necessary, and the documented response cache behavior. Verify provider semantics with synthetic staged images. Do not change Vercel build/billing settings.
2. Apply the additive `image_assets jsonb NOT NULL DEFAULT '[]'::jsonb` schema through the approved migration process. Deploy compatible readers and v1/v2 contracts first, with image writes off. Retain image/images/source payload data. The app's existing lazy schema initializer includes the additive column; an approved explicit schema migration should precede serving traffic.
3. Verify public/private/owner/admin/moderation/winner flows and effective headers in a separately authorized hosted environment. Test an existing open old client and a new client, warm CDN responses, expiry, GIF animation and galleries. Verify the image CSP permits only the configured storage origin.
4. Enable the separately approved dedicated image read configuration, then the writes flag. Test controlled synthetic writes before general use. Do not persist signed URLs; persist keys/metadata only.
5. Run a selected-record, bounded dry run. Review exact IDs, checksums, estimated original/preview bytes, and journal location. Separately approve the selected real apply operation. Tooling retains originals, verifies stored bytes before CAS attachment, protects concurrent edits, journals partial work, and supports idempotent reruns. See exact commands and adapter controls in [storage and migration runbook](round-image-storage.md).
6. Compare equivalent hosted windows and request sets before claiming production savings. Capture effective CDN/browser headers, signed URL length and expiry, network original/preview bytes and storage request counts.
7. Consider legacy retirement only under a new explicit authorization after cached clients/open tabs and rollback retention have been addressed. This implementation does not remove legacy originals.

## Rollback

1. Turn off new image writes through separately approved environment management. Keep compatible readers and the additive schema deployed.
2. Use each migration journal's rollback mode; it conditionally restores only the exact metadata written by that migration. Conflicting later edits are held for review. Rollback never deletes objects or overwrites unrelated edits.
3. Disable image reads only after confirming retained legacy image/images bytes cover every affected record. The gateway then falls back to retained legacy bytes with `X-Round-Media-Fallback: legacy-storage-unavailable`; never retire those bytes first.
4. If reverting the client, retain the compatible unversioned media contract and gateway. Old clients receive originals and preserve GIF animation. Do not drop image_assets/schema or delete private objects as part of rollback.

## Evidence and remaining hosted prerequisites

Run `node scripts/run-isolated.mjs test`, `typecheck`, `lint`, and `build`. The wrapper clears provider/database configuration, blocks dotenv files, and denies nonloopback network. Focused behavioral tests include `tests/round-media-contract.test.mjs`, `tests/round-image-delivery.test.mjs`, `tests/round-image-storage.test.mjs` and the existing vote/submission/media/database lifecycle suites. The deterministic benchmark script records raw/gzip/Brotli bytes using the same corpus before and after; see the [local verification results](round-media-verification.md).

Local fixtures establish serializer, byte-integrity, selected-image, failure and rollback behavior. Fake database/store tests do not prove PostgreSQL isolation or provider/CDN configuration. Hosted private-access checks, signed-link expiry, real provider costs/egress, CDN behavior, and equivalent production telemetry remain separately authorized prerequisites. No paid transform service is required. The already installed/locked sharp 0.35.4 is now an explicit runtime dependency; no new package version was installed. During compatibility retention, storage temporarily contains database originals plus object originals and previews; migrated grid reads add gateway checks and object GETs, while provider byte delivery bypasses function transfer. New writes cost up to two PUTs and two verification GETs per raster; subsequent migration reruns and gateway signing behavior are specified in the storage runbook.

The Vercel CLI is unavailable in this session. For later authorized hosted verification, installing it with `npm i -g vercel` is strongly recommended for environment, deployment and log commands. This task did not install it or change Vercel build or billing settings.
