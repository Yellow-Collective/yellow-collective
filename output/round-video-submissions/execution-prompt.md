# Rounds video submissions

## Goal
Implement and locally verify video submissions in Yellow Collective Rounds with authenticated direct uploads to Railway S3-compatible buckets. Preserve existing images, traits, voting and unrelated working-tree edits.

## Plan
1. Audit current schema, signed requests, submission UI, gallery/detail/admin rendering, CSP, exports and tests. Record the existing dirty files and preserve their changes.
2. Define backward-compatible video metadata and an upload reservation/finalization lifecycle. Add authoritative validation, bounded upload quotas, ownership checks and abandoned-upload cleanup.
3. Implement direct browser upload to Railway buckets using temporary scoped URLs and server-only credentials. Store permanent object keys; generate temporary playback URLs on demand. Do not proxy video bytes through the web app.
4. Add upload progress, cancellation/retry, cover image, video badge and click-to-play controls to the existing submission experience. Keep existing image-only submissions unchanged.
5. Verify security boundaries, image/trait/voting regressions, typecheck, lint and applicable build/runtime behavior. Document setup, cleanup, limitations and release checks.

## Execution prompt
You own implementation of video submissions in C:/Users/Deej/Documents/GitHub/yellowcollective. Begin with the installed using-agent-skills meta-skill; choose the smallest relevant engineering skills. Apply secure-app-baseline and its full controls reference for uploads, storage, signed requests and quotas. Railway use-railway and evidence-research were read during investigation; verify current provider-specific APIs against official docs.

Requirements:
- One optional video per project submission, alongside existing images. Use the existing image cover requirement for the first version, and clearly explain it in the UI. Preserve existing image-only and trait entries.
- MP4 containing H.264 video and, if present, AAC audio. Maximum 100 MiB and 120 seconds. Centralize these defaults and allow safely validated per-round overrides only if the existing admin/schema pattern makes that a small coherent change; otherwise document defaults and defer overrides explicitly.
- Browser uploads directly to a private Railway bucket. Credentials stay server-side. Use short-lived scoped upload URLs, generated isolated keys, and object ownership bound to the verified wallet and round.
- Before issuing an upload URL, enforce round state, authentication, pending/active quotas and resource bounds. Prevent arbitrary uploads, overwrite, replay, cross-wallet object attachment and concurrent quota bypass.
- Finalize only after authoritative validation of stored size, MP4 structure, codecs and duration. Client MIME, extension and duration are not trusted. Use a bounded parser/worker appropriate to the stack; do not download a 100 MiB file into a web function or ship unbounded custom parsing. Choose minimal maintained dependencies if needed, justify them, and request tool escalation for required installations. If full verification needs a worker, implement that isolated worker and its tested protocol/config locally rather than weakening validation.
- Store object key and safe metadata, not expiring signed URLs or base64 video. Playback endpoints resolve only approved submission objects. Generate fresh temporary GET URLs/redirects; account for seeking and URL expiry. Avoid eager loading videos in the gallery.
- Provide upload progress, useful errors, retry/cancel states, video badge, poster/cover and native accessible click-to-play controls. Accommodate mobile and Farcaster embeds. Extend admin previews and keep image exports compatible; document a deliberate bounded video-export policy.
- Add cleanup for expired upload reservations and abandoned objects, with dry-run default for operator tooling. Account for partial multipart uploads if used. Do not execute deletion or schedule a live job during this task.
- Update scripts/rounds-schema.sql with the runtime schema. Add sanitized environment documentation and narrow CSP/CORS requirements. Leave the feature safely disabled when required configuration is absent, while keeping image submissions functional.

Acceptance:
- Existing images, legacy rows, traits, voting and admin operations retain their behavior.
- Tests cover auth, ownership, expiry/replay, round closure, size/type/codec/duration rejection, concurrency quotas, finalize idempotency, cleanup, signed playback and upload failure recovery using local fixtures/stubs.
- Run focused tests, typecheck and lint; run broader checks where applicable. Verify local runtime with available tooling and report external bucket/browser checks that cannot be performed without provisioning.
- Provide concise changed-file and validation evidence plus exact release setup steps. Do not call local stubs proof of a working Railway integration.

Boundaries:
- You are not alone in this codebase. Preserve all existing dirty work, particularly data/rounds.ts and pages/rounds/[slug].tsx. Do not revert others' edits.
- Own only files necessary for Rounds videos, its worker if required, tests and documentation under output/round-video-submissions plus relevant README/env guidance.
- No commits, pushes, production deployment, bucket provisioning, live database migrations, live uploads, billing changes, secret printing, signing or transactions. Local edits and verification are authorized. No memory writes, vault edits or new scheduled jobs.
- Return implementation, verification evidence, remaining prerequisites and material risks. Continue through routine problems; report concrete blockers honestly.
