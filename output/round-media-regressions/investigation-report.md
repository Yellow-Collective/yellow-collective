# Round video and GIF regression investigation

Execution prompt: [execution-prompt.md](execution-prompt.md). Public production evidence: [production-evidence.json](production-evidence.json).

## Confirmed production behavior

Observed on 2026-10-15 at https://www.yellowcollective.art, checking the `propoganda` round:

- Submission page responds 200; build ID `aJjQv3ZsOn3lc_g52J7P_`, asset deployment marker `dpl_5MSHEGqSxfLUFZY1nU9xNTp7YnJo`.
- `/api/rounds/propoganda/videos` responds 404 with the Next.js error page. The deployed submission bundle contains neither the video uploader nor its capability request. This is missing deployed functionality, rather than merely a hidden wallet control or a false capability flag.
- The deployed image uploader accepts GIF MIME types but routes all files through an image/canvas JPEG encoder. It lacks the local GIF-preservation branch. Rasterizing into JPEG discards every animation frame after the selected still frame.
- The checked public media response contains 14 submissions and 27 images, all `data:image/jpeg`. These stored JPEGs cannot yield the original GIF animation. This observation covers one round; it does not establish the original format of every image or audit all rounds.

Current local source contains the video route/uploader and GIF-preserving upload implementation. The production deployment does not contain those features. The prior release report says video was deployed directly from `feat/round-video-preview` without merging it into main. A subsequent release from a branch without those changes is a plausible explanation; exact deployment Git metadata remains unverified because the Vercel connector returns 403 for this project.

## Local changes in this task

- `components/rounds/RoundVideoUpload.tsx`: distinguish loading, explicit server disable, enabled and failed availability checks. Failed HTTP/JSON/network requests expose a retry button instead of silently removing video. Add a ten-second timeout, no-store request and stale-response/unmount protection. Explicit disable still wins; no upload/signing/storage guard is relaxed.
- `tests/round-media-regressions.test.mjs`: execute real component effects with synthetic network responses; cover missing route, invalid responses, retry recovery, timeout, stale responses and wallet gating. Preserve exact bytes of a two-frame GIF through real upload, GIF validation, persisted JSON serialization, deferred media payload and hydration functions. No canvas is permitted for the GIF fixture.
- `scripts/round-media-readonly-smoke.mjs`: reusable read-only deployed-route and compiled-feature checks. These are release indicators, not browser-animation or wallet-upload proof.
- Added the regression test to the existing `package.json` test command, preserving its pre-existing changes. Another concurrent workflow committed that package change while this investigation was running; this task made no commit. Its new test file must accompany that test-command reference in any release.

The local GIF-preservation implementation was already present at task start; it was verified and reused, not rewritten. No production database or image file was modified. Large downloaded public HTML/media copies were removed after producing the compact evidence summary.

## Verification

- Regression test against the previous video component fails because it renders null while discovering availability; the patched component passes.
- New combined regression tests pass, including exact preservation of both GIF frames.
- Existing image upload, submission image validation, deferred media, video lifecycle and attachment suites pass.
- Full `npm test` passes, including the new tests.
- `npm run typecheck` passes.
- Focused component lint passes without warnings.
- `git diff --check` passes for the changed tracked source.
- Read-only production smoke correctly fails the video endpoint, video-uploader presence and GIF-preservation presence checks; submission page availability passes.
- Production build passes with exit 0; see build.log. Database URLs were overridden with an unavailable loopback fixture so static generation used fallback behavior instead of connecting to production. Existing unrelated no-img lint warnings remain. Initial sandbox build hit worker-spawn EPERM; the permitted retry allowed compiler workers.

Synthetic tests do not prove a real authenticated upload or database save. No live uploads, signatures or transactions were performed.

## Release requirements

1. Build a scoped release containing the complete video feature and committed GIF-preservation changes, plus this task's uploader/test/check changes. Preserve and exclude unrelated dirty work. Ensure the new test file accompanies the test-command reference. Avoid deploying an older main branch that lacks the media features.
2. Obtain explicit deployment approval, as required by the supplied AGENTS instructions. Verify production video environment settings through an authorized provider connection; do not expose their values. The current connector cannot inspect this team/project (403). The Vercel CLI is unavailable; installing `npm i -g vercel` is recommended for authenticated deployment inspection, deployment and logs. No installation was performed.
3. After the approved release reaches Ready, run `node scripts/round-media-readonly-smoke.mjs https://www.yellowcollective.art propoganda`. Expect all checks to pass. Verify the hydrated uploader in a browser and test an original animated GIF in an approved test submission/admin workflow.
4. Re-upload original GIF files for entries previously flattened into JPEG. The existing admin gallery editor can replace media when separately authorized. Do not attempt to fabricate animation from the saved stills.

No commit, push, deployment, provider/environment mutation, production database write, source-note edit, imported-note edit, Obsidian/plugin configuration change or automation change was performed by this task. Relevant memory was read; memory was not updated.

## Authorized release follow-up

The paragraph above records the initial local investigation. The user subsequently authorized committing and pushing all local changes upstream to production. Source fixes were committed as `8b349aff`; upstream main was merged as `c4bb1171`, retaining all tests from both histories. The merge's only conflict was the test command; the resulting source tree matches the already tested source tree.

The release also includes the user's saved artwork, trait concepts, audit evidence, custom audit skill/agent and prior verification artifacts. Publication review found no credential candidates in the high-confidence text scan. Nine saved metadata/prompt/log files had local paths or configured private operator labels; their publication copies were cleaned using the canonical document sanitizer, backed up externally and verified idempotent. The artwork ZIP received the same cleaned prompt metadata; all ten archived artwork images were preserved byte-for-byte. Source notes, environment credentials and ignored local runtime files remain outside this release.

The current lockfile audit reports 29 high, 28 moderate, 11 low and zero critical advisories. Upstream main's existing Security CI run `38464367825` already failed its high-severity dependency-audit step. No dependencies were changed during this media repair/release. These advisories remain unresolved and must not be described as a passing security check.

The Vercel connector denied project access, and the existing CLI session has no usable credentials. Production deployment is therefore being triggered through the existing upstream-main Git integration; GitHub deployment status and the public read-only media check provide release evidence. No account login, dependency installation, credential rotation or production database mutation was performed.

Final publication check: the canonical sanitizer checked all 174 textual inspection copies and returned an empty findings list. Inspection copies retained source text while omitting encoded image/onchain binary fields and repeated metadata; original evidence files were not changed by that preparation. The nine identified document/log metadata issues were resolved, the second sanitization pass changed zero files, and the ZIP's prompt metadata was synchronized. Image pixels were preserved. Private backups and scan reports remain external and are not staged. Source commit `c4bb1171` was pushed successfully to upstream main; GitHub confirmed the Vercel production deployment was pending.
