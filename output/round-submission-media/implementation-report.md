# Round submission media: local implementation evidence

Execution prompt: [execution-prompt.md](execution-prompt.md).

## Implemented
- GIF uploads retain their original bytes instead of canvas JPEG conversion. Existing PNG/JPEG/WebP conversion remains. GIF limit: 1MiB; existing other-file input limit: 8MiB. Image processing times out after 15 seconds and exposes retryable errors.
- Shared ordered image picker supports file uploads and safe URLs in both public submission and admin submission editing. Admins can append images/GIFs, preview pending edits, remove images and save. The original cover stays first when appending. At least one image remains required; save/moderation controls pause during image processing.
- Data validation enforces ten images, 2.5MiB aggregate encoded-image budget, and 3.75MiB including a duplicated cover. Both submission API parsers allow 4MiB bodies. GIF validation checks signature, dimensions, tables, image descriptors, bounded sub-block framing and trailer, without decoding/rasterizing animation.
- Existing admin session and rounds permission guards remain authoritative. Metadata-only saves omit unchanged image bytes; existing unchanged galleries above the new budget remain editable. Admin save performs one update. Invalid media yields400; unexpected errors return a generic500.
- Existing ordered images schema/storage reused; no schema or provider change. Voting, video metadata, trait metadata and unrelated dirty edits preserved.

## Directly observed checks
- Initial GIF preservation and GIF-size tests failed against original code, then passed after implementation.
- `node tests/round-image-upload.test.mjs`: passed8 cases, including exact GIF bytes, size/type rejection, timeout and failed read.
- `node tests/round-submission-images.test.mjs`: passed11 cases including complete multiple-frame GIF framing and malformed/truncated GIF rejection.
- `node tests/admin-round-submission-media.test.mjs`: passed synthetic route plus real data-function tests. Covered401/403/405, one successful round-scoped update, unchanged cover/video/votes, malformed/empty/non-array/nonstring/oversized/excessive400, wrong-round404 and legacy gallery metadata editing. PostgreSQL was replaced by an in-memory fake; auth/session inputs were synthetic.
- `npm run lint`: exit0, existing no-img warnings in community pages and treasury TokenLogo.
- `npm test`: full suite passed after implementation. Final focused media tests were rerun after the last source edits and passed.
- `npm run typecheck`: final check after all source edits passed with exit0.
- `npm run build`: completed with exit0 after a sandbox worker-spawn restriction required an approved retry. Both database URL variables were overridden to an unavailable loopback address, so static generation used fallback behavior and did not connect to the live database. Existing lint warnings remained.
- Isolated browser fixture rendered the real shared picker with synthetic local GIF data. Adding a GIF changed gallery count from one to two; removing the cover left the remaining image labeled as cover. This verifies component interactions with fixture styling, not integrated authenticated admin layout. Evidence: [browser-fixture.png](browser-fixture.png). Fixture server stopped after checking.
- `git diff --check`: exit0.

## Remaining evidence boundaries
No live database, wallet signature, provider upload, production publication, deployment, commit or push occurred. GIF block checks do not decode or validate the full LZW pixel stream. Remote image URLs are validated as safe URLs and rendered publicly; their remote contents are not fetched or validated server-side. Existing inline-gallery response size remains an architectural limit for large galleries. Actual authenticated end-to-end upload/save remains unverified against a running database.

No source notes, Obsidian settings, plugin configurations, imported notes, automations or memories were changed. Relevant memory was read and current source behavior verified.
