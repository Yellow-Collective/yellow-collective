# Private round image storage and migration

This is a local implementation. No bucket was provisioned, credentials changed, production database read, upload sent, or production migration run. The adapter reuses installed AWS SDK S3 APIs; it does not reuse the video bucket or Pinata. A dedicated private S3-compatible image bucket and separately scoped credentials are prerequisites. Compatibility and access policy must be verified against that provider before enabling writes. No paid image transformation service is introduced.

## Configuration and access

All settings are server-only. Disabled storage is the default. Required configuration names are:

```dotenv
ROUND_IMAGES_ENABLED=false
ROUND_IMAGE_WRITES_ENABLED=false
ROUND_IMAGE_S3_ENDPOINT=https://your-reviewed-s3-compatible-endpoint
ROUND_IMAGE_S3_REGION=your-region
ROUND_IMAGE_S3_BUCKET=your-dedicated-private-image-bucket
ROUND_IMAGE_S3_ACCESS_KEY_ID=placeholder
ROUND_IMAGE_S3_SECRET_ACCESS_KEY=placeholder
ROUND_IMAGE_S3_FORCE_PATH_STYLE=false
```

`imageStorageReadiness()` distinguishes disabled/unconfigured/ready and reports the write gate independently. It performs no network probe and does not establish provider readiness. Calls fail with recoverable errors when configuration is unavailable; callers must preserve the existing inline write path when controlled image storage is disabled. Do not silently accept a partial gallery on a storage failure.

Before hosted activation, separately approve configuration/provisioning and verify: the bucket is private; anonymous GET/list/PUT are denied; public ACLs/policies cannot override intended privacy; credentials access only the dedicated image namespace; no generic public website/CDN mapping exposes keys; provider supports conditional PUT (`If-None-Match: *`), checksum verification and signed GET response overrides. Do not enable an unsupported provider by removing these checks. Deletion permission is unnecessary for the request-serving credentials.

Server-validated originals and static WebP previews use keys:

```text
round-images/v1/{roundId}/{submissionId}/{index}-{sha256}.{png|jpeg|gif|webp}
round-images/v1/{roundId}/{submissionId}/{index}-{sha256}.preview.webp
```

IDs are validated path segments and indices are 0–9. Keys are durable identifiers, never authorization. Only trusted server code creates keys; attachment routes must verify authenticated ownership/round scope and store the metadata returned by `storeRoundImage`. Clients cannot attach arbitrary keys or claim upload success. Readers must recheck actual round publication/activity, entry approval/winner/owner/admin visibility and deletion before invoking `signRoundImage`; the same checks apply to originals and previews. The adapter itself has no wallet/round context.

New project submissions and changed owner/admin image galleries use controlled metadata writes while retaining original inline fields. `validateRoundImageUploads` validates new/changed inline raster content even with object writes disabled; trusted derived SVG trait paths retain their separate server policy. With writes enabled, `storeRoundImage` performs that validation itself. Unchanged galleries do not require repeated processing. No preview is downloaded by validation.

The persisted `imageAssets` array maps to `round_submissions.image_assets` with the same ordering as `images`. Each raster asset contains `key`, `previewKey`, `sha256`, `bytes`, `mime`, `width`, `height`, `frames`, and `previewBytes`; null slots retain legacy external/SVG/unsupported assets. No signed URL is persisted. Keep `image`, `images`, source metadata, captions, and traits intact through the compatibility period. Existing SVG trait rendering stays on its existing path.

## Processing and byte integrity

The adapter accepts inline raster bytes only; it never fetches a supplied URL. Actual PNG/JPEG/WebP/GIF magic and parser format must match the declared type. The input limit is 8 MiB, with the existing 1 MiB GIF limit; limits are 40 million pixels per frame, 80 million decoded pixels across all frames, and 120 frames. Complete decoding rejects malformed/truncated frames. Native operations have five-second processing limits and a process-local maximum of two concurrent decodes. This does not establish a global multi-instance quota; request admission/rate controls remain the enclosing endpoint's responsibility.

Original buffers are stored unchanged, including GIF animation and metadata. Originals and previews are SHA-256 verified by reading stored bytes before returning attachment metadata. Stored preview generation uses the first frame, bounded inside 640×640 without enlargement, encoded as WebP quality 80, capped at 1 MiB. Grid delivery uses static previews for still images and the original GIF for animated artwork, with lazy loading for both. Existing GIF still previews remain stored for compatibility; readers select the original GIF key without a migration or re-encode. Change the key format version before changing stored preview transformation rules, since preview keys are immutable by content identity plus processing version.

The legacy `image/jpg` data-URL alias is accepted and normalized to `image/jpeg` metadata and object suffixes without changing any original bytes. Delivery, preview generation, migration and reruns cover this alias.

Existing JPEG stills cannot recover GIF animation without the original GIF files. Migration cannot restore bytes already discarded by historical browser JPEG conversion. No additional lossy encode is applied to migrated originals.

## Cache, expiry, and moderation

| Layer | Setting |
| --- | --- |
| Original/preview object Cache-Control | `private, max-age=0, no-store` |
| Signed GET response override | `private, max-age=0, no-store` |
| Browser TTL for object response | zero; no-store |
| CDN TTL for object response | zero; private/no-store; provider enforcement requires hosted verification |
| Signed link lifetime | 60 seconds from issuance |
| Signed link refresh | reacquire through the authorized application asset endpoint; never persist or log query strings |

Public manifest freshness is a separate application policy and must be shorter than signed-link lifetimes if it contains links. The preferred compact manifest carries application asset routes, allowing each actual image request to recheck eligibility before issuing a fresh link. Signing is local cryptography, not an S3 object read.

A new key does not revoke an old signed link. Hiding/rejection/deletion/unpublishing/deactivation prevents **new** links after the authoritative eligibility check sees the change. An already issued direct link can remain usable for up to 60 seconds, plus any provider clock/enforcement discrepancy to be measured in hosted checks. Already decoded pixels in open tabs, downloaded copies, screenshots, and noncompliant intermediary caches cannot be revoked. UI revalidation controls removal from an open gallery separately. Immediate revocation is not claimed. Never apply public immutable caches to these revocable assets.

## Safe rollout order

1. Separately authorize and apply the additive `image_assets` JSONB schema (empty array default; array slots may be null); deploy compatible readers/asset endpoints before new writes. Verify legacy clients can still read original inline fields.
2. Configure and verify the dedicated private provider with reads enabled and writes disabled. Exercise signed expiry, access denials and byte checks against approved nonproduction data. Enable controlled writes only after those checks. Existing originals are dual-retained during compatibility. Keep image and video flags independent.
3. Migrate explicitly selected records in bounded batches. Start with dry runs. Retain all inline originals and null compatibility slots. Verify each stored object before the conditional reference update. Journal orphan uploads and conflicts for reconciliation, never delete shared objects automatically.
4. Separately approve every hosted database read/write, provider upload, and later legacy retirement. Old open tabs and cached clients must continue to work during a partial rollout. The PostgreSQL/private-S3 adapter is prepared and tested with injected local fakes; it has never been executed against a real database/provider. Matching-engine and hosted validation remain prerequisites.

The prepared PostgreSQL adapter selects explicit record IDs and snapshots `round_id`, `updated_at`, `images`, `image`, and `image_assets`. Its bound UPDATE changes only `image_assets` when every snapshot still matches. `updated_at` is retained because only delivery references change; stable asset routes resolve the current references. Timestamp snapshots preserve all six fractional digits in a canonical UTC string, and record fingerprints sort object keys so PostgreSQL JSONB key ordering cannot create false rollback conflicts. The contract is:

```sql
UPDATE round_submissions
SET image_assets = $1::jsonb
WHERE id = $2
  AND updated_at = $3
  AND images IS NOT DISTINCT FROM $4::jsonb
  AND image IS NOT DISTINCT FROM $5
  AND image_assets IS NOT DISTINCT FROM $6::jsonb
RETURNING id;
```

The actual adapter additionally compares `round_id`. The local schema declares `images` as JSONB; verify the deployed schema agrees before activation. Zero returned rows means conflict; preserve the newer edit and reconcile the journal. This SQL has not been executed against production. A matching local PostgreSQL concurrency test remains required before hosted execution; fixture CAS tests do not establish database locking behavior.

## Prepared hosted commands — authorization required before execution

The `--adapter postgres-s3` mode has no dependency on application startup, schema initialization, or implicit `.env` loading. Supply the separately reviewed connection through a named server environment variable, e.g. `ROUND_IMAGE_MIGRATION_DATABASE_URL`; verify its actual database/host belongs to the intended environment before authorization. Set `ROUND_IMAGE_MIGRATION_ENVIRONMENT` to `staging` or `production`, matching `--environment`. No URL or credential value is printed. Dry-run uses a read-only transaction, selects only explicit IDs with a bounded SQL LIMIT, performs local validation/preview generation, and writes no database records, provider objects, journals, or lock files. Even read-only production access still requires authorization.

These commands are exact templates; replace `APPROVED_ID` and use the approved environment. They have **not** been executed:

```powershell
# After separate authorization for this environment's read-only database access:
node scripts/round-image-migrate.mjs --adapter postgres-s3 --environment staging --database-env ROUND_IMAGE_MIGRATION_DATABASE_URL --ids APPROVED_ID --batch 1 --concurrency 1

# After separate authorization for provider/database writes, reviewed private bucket configuration,
# matching ROUND_IMAGE_MIGRATION_ENVIRONMENT, and ROUND_IMAGE_MIGRATION_ALLOW_WRITES=true:
node scripts/round-image-migrate.mjs --adapter postgres-s3 --environment staging --database-env ROUND_IMAGE_MIGRATION_DATABASE_URL --ids APPROVED_ID --batch 1 --concurrency 1 --apply --confirm-environment staging --journal /approved-durable-path/round-images-staging.json

# Repeat the same explicit IDs to reconcile partial failures; unchanged references skip object work.
# Separately approved rollback uses the same target-bound journal and conditional guards:
node scripts/round-image-migrate.mjs --adapter postgres-s3 --environment staging --database-env ROUND_IMAGE_MIGRATION_DATABASE_URL --ids APPROVED_ID --batch 1 --concurrency 1 --apply --confirm-environment staging --rollback --journal /approved-durable-path/round-images-staging.json
```

The private-S3 write adapter uses only dedicated `ROUND_IMAGE_*` credentials, conditional object creation and checksum-verified readback. Dry-run never constructs it. Apply requires both normal image flags, the migration-specific write gate, matching explicit environment confirmation, and an explicit journal path. Rollback needs database access and the migration gate but does not contact storage or require storage write flags. Batch size is 1–25, up to 100 IDs per selection, concurrency is exactly one, database pool size is one, and connection/query timeouts are bounded. The CLI loads only one explicitly selected legacy gallery at a time, keeping large inline galleries from accumulating across a batch. Supply the next explicit selection to resume beyond one batch. No schema changes, automatic retries of conflicting references, original-byte removal, or object deletion are implemented.

Use a restricted, durable operator filesystem for the journal, not a function scratch directory. Journals contain keys, hashes, metadata and prior references; they contain no image bytes, database URLs, credentials or signed URLs. A journal is bound to its environment label and a hash of database host/name. File contents are fsynced before atomic rename; an exclusive `.lock` prevents concurrent operators sharing one journal. After an abrupt process termination a stale lock may remain: verify the recorded process is gone and journal/object/database state before separately removing that lock and rerunning. Filesystem power-loss semantics and PostgreSQL/provider behavior still require operator verification. Do not reuse a journal for another target.

## Isolated fixture tooling and rollback

The default fixture mode accepts a local JSON array and requires `--environment fixture`, explicit `--input`, and explicit `--ids`. Dry-run is the default, with no database/provider/file writes. `--batch` defaults to 10 and is bounded at 25; at most 100 IDs can be selected, with sequential processing (concurrency one). Repeated runs select the next explicit IDs rather than using an implicit global scan. Unsupported external/SVG sources retain null slots; URLs are never fetched.

Create a bounded synthetic fixture locally, then run dry-run/apply/rerun/rollback:

```powershell
node --input-type=module -e 'import sharp from "sharp"; import fs from "node:fs"; const image = await sharp({create:{width:800,height:600,channels:3,background:"#ffcc00"}}).png().toBuffer(); fs.mkdirSync("output/round-image-fixture",{recursive:true}); fs.writeFileSync("output/round-image-fixture/records.json",JSON.stringify([{id:"sample1",roundId:"round1",images:["data:image/png;base64,"+image.toString("base64")]}]));'
node scripts/round-image-migrate.mjs --environment fixture --input output/round-image-fixture/records.json --ids sample1 --batch 1
node scripts/round-image-migrate.mjs --environment fixture --input output/round-image-fixture/records.json --ids sample1 --batch 1 --apply --objects output/round-image-fixture/objects --journal output/round-image-fixture/journal.json
node scripts/round-image-migrate.mjs --environment fixture --input output/round-image-fixture/records.json --ids sample1 --batch 1 --apply --objects output/round-image-fixture/objects --journal output/round-image-fixture/journal.json
node scripts/round-image-migrate.mjs --environment fixture --input output/round-image-fixture/records.json --ids sample1 --apply --rollback --journal output/round-image-fixture/journal.json
node tests/round-image-storage.test.mjs
```

Object keys/checksums make retries deterministic; unchanged references skip object writes/readbacks. A prepared journal is persisted before each object write and before the conditional reference update. Upload-success/reference-failure leaves unreferenced private objects for a later retry/reconciliation; legacy bytes remain valid. Local record updates compare a whole-record fingerprint so concurrent edits produce conflicts. The fixture path is a single-operator test tool; its local read/compare/rename is not a multi-process transaction and must not be represented as PostgreSQL concurrency proof.

Rollback accepts committed, prepared, or failed entries whose recorded `after` fingerprint matches the current record (covering interruption or uncertain completion after the update). It restores only prior `imageAssets` and preserves original bytes. Newer edits produce conflicts; rerunning a completed rollback reports `already-rolled-back`. Objects are retained, including objects shared by reruns; garbage collection and legacy retirement need separate authorization. Retain the journal and fixture backup until verification finishes. Production code rollback should first disable controlled writes while preserving compatible readers/schema and all original fields; do not drop `image_assets` or delete objects during rollback.

## Costs and limits

Each newly stored raster image adds one unchanged original and one small static preview: two PUTs and two verification GETs, plus storage for both. On-demand original viewing adds its direct object GET/egress; grids transfer requested still-image previews and full GIF bytes so animation remains visible. Each link renewal adds an application authorization read/signing operation; migrated byte delivery bypasses the function. Legacy GIFs use bounded per-entry function delivery without a thumbnail decode. Existing inline bytes remain in the database during rollout, so total storage temporarily increases. Preview processing uses current Node/native sharp CPU and memory, not a paid transform service. Exact storage/request/egress rates depend on the separately chosen existing S3-compatible provider, region, retention and usage; no numeric cost or production savings are claimed from local fixtures.

Hosted prerequisites still include actual bucket privacy, conditional/checksum support, signed-link length/expiry, response headers, clock behavior, egress billing and comparable production traffic measurements. No Vercel build/billing setting was changed.
