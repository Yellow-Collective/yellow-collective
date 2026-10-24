# Local UI and bandwidth evidence

**GIF grid follow-up:** GIFs now animate on the grid using unchanged GIF bytes. The earlier still-preview measurements below are retained as historical evidence. See [animated-grid verification](animated-grid-verification.md) and the current `benchmark.json` for the updated delivery policy and measurements. `benchmark-still-grid.json` and `browser-network-still-grid.json` preserve the prior measurements.

No production requests, external storage operations, database connections, uploads, wallet signing or transactions were used. The Next.js server uses the in-memory read-only PG fixture and the offline preload; the browser uses a temporary Edge profile and blocks non-loopback page requests. AWS presigning tests use explicit synthetic credentials and do not contact a provider.

## Fixed 100-submission benchmark

Each entry has five ordered images drawn from the same three-file corpus, including an eight-frame GIF. Originals and their hashes are unchanged before/after. JSON sizes are UTF-8 bytes with gzip level 9 and Brotli quality 11.

| Body | Raw | gzip9 | Brotli11 |
| --- | ---: | ---: | ---: |
| Original media JSON | 49,961,800 | 32,167,780 | 161,137 |
| Compact gateway manifest | 61,981 | 2,242 | 1,178 |
| Migrated contract, five 128-byte ASCII URLs per entry | 71,619 | 2,194 | 1,174 |
| Original successful vote JSON | 51,752,016 | 32,509,454 | 313,117 |
| Compact successful vote receipt | 112 | 110 | 82 |
| Baseline SSR props, including nested media | 1,981,384 | 28,668 | 13,721 |
| Scrubbed SSR props with migrated URL representation | 135,920 | 4,192 | 2,153 |

The vote comparison uses the same 100-entry legacy gallery fixture, voting power 10 and snapshot block 100. The compact receipt records an accepted allocation of 2, used power 7 and remaining power 3. It removes the one full-submission read previously performed after COMMIT; authorization, snapshot and transactional vote work remain intact. Compression overhead makes the tiny receipt nearly as large with gzip, as expected.

The full-grid media-only model (101 previews plus one manifest) is 626,209 raw / 566,470 gzip / 565,406 Brotli bytes. Compared with the original body, raw/gzip transfer falls sharply, while Brotli transfer **increases** because the original fixture repeats only three artworks and Brotli's large window compresses those repeats very effectively. This fixture and miss are retained. Rendering a viewport lazily transfers fewer previews; the measured browser result below is separate from that model. Full-grid legacy gateway mode uses 102 application requests and 103 eligibility/manifest database reads, compared with four original endpoint reads; migrated private submission storage additionally uses 100 storage requests and removes submission-thumbnail processing. The inline round cover remains a bounded legacy route with one cold decode; covers are not migrated by the submission adapter. These are explicit bandwidth/access-control tradeoffs, not universal reductions in request count.

## Final local production-build browser verification

The final browser fixture has 12 entries with five images each, served by `next start` from the final rebuilt production bundle. Captured build-manifest and Next-data paths identify build `t4WBBud5ebpz7T4-y1XTY`. This is a local production build with synthetic database records and blocked external services; it does not measure the hosted site or CDN.

Initial sampling waits for the manifest and visible cover to decode, then a one-second settling window before scrolling the first card into view. Requests are assigned phases when they start; their completed response bodies are collected afterward. Network JSON retains every captured local response, decoded body bytes, encoded wire-body bytes and headers. App totals include HTML, JavaScript, styles/fonts, API reads and route prefetches initiated during that initial phase. Wire-body bytes exclude HTTP headers/TLS and use the browser's `request.sizes()` measurement.

| Initial sample | Desktop 1440 × 1100 | Mobile 390 × 844 |
| --- | ---: | ---: |
| Media requests | 8 | 2 |
| Media decoded response body bytes | 54,231 | 21,751 |
| Media wire-body bytes | 47,106 | 14,626 |
| Full-resolution originals requested | 0 | 0 |
| App requests | 97 | 76 |
| App decoded body bytes | 4,563,823 | 4,564,821 |
| App wire-body bytes | 1,549,926 | 1,428,481 |

The prior development-server capture is preserved as `browser-network-development.json`: desktop 48 requests / 48,203,120 decoded body bytes / 11,208,285 wire-body bytes; mobile 44 / 48,181,962 / 11,187,127. Its initial media samples were 5 requests / 37,991 decoded bytes and 2 / 21,751 respectively. That older run assigned phases at response headers and used development JavaScript; its totals are distinct from the final production-build evidence above.

Opening the first PNG adds one request and 138,552 bytes. Selecting the GIF adds one request and 14,366 bytes; its hash matches the original and two rendered screenshots differ, proving visible animation in this browser. Hidden gallery originals are not mounted or requested. Previews remain the only grid media.

Observed effective headers: manifest `public, max-age=15, s-maxage=15, must-revalidate`; originals `private, no-store, max-age=0`. Browser checks passed desktop/mobile navigation and numbered gallery controls, one mounted original, a synthetic image 503 followed by Retry recovery, and no horizontal overflow or page exceptions. Warm desktop checks passed card/gallery removal after moderation, stale asset URL 404 with no-store, metadata title refresh after revision change, hiding artwork after a failed manifest refresh, and denying old direct URLs after round deactivation.

The unrelated treasury endpoint returns 500 when its external RPC access is intentionally blocked. Browser fonts and wallet metadata attempts are also blocked. This is expected isolated-environment evidence; it does not establish provider/CDN behavior.

Screenshots were refreshed against the final production build and visually inspected: `desktop-grid.png`, `mobile-grid.png`, `desktop-gallery.png`, `mobile-gallery.png`, both GIF frame pairs, desktop/mobile failure states, and `desktop-manifest-failure.png`. Full network evidence is `browser-network.json`; the earlier development capture is `browser-network-development.json`. The unchanged 100-entry serializer model is `benchmark.json`.

Commands run: `node tests/round-media-gallery.test.mjs` (three behavioral checks passed); `node scripts/round-media-benchmark.mjs` (budget/hash assertions passed); `node scripts/round-media-browser-check.mjs` (desktop/mobile and warm-state checks passed) first against `node scripts/run-isolated.mjs dev --round-fixture --port 3100`, then against the final rebuilt `node scripts/run-isolated.mjs start --round-fixture --port 3100`. The final rerun passed GIF rendering and byte hashes, gallery failure/retry, warm moderation/title edits, hiding all submissions on failed media refresh, and deactivation access denial, with no page exceptions or horizontal overflow. Browser launch required the normal reviewed sandbox escalation after an initial spawn EPERM; no package/browser installation was performed.

Production savings, CDN cache propagation, real provider redirect URLs, delivery costs and production migration remain unverified pending separately authorized hosted work.

## Final engineering checks

All commands use Yarn 1.22.22 through the isolation wrapper, Node 22.14.0, Next.js 15.5.24, React 18.2.0 and the existing lockfile. The wrapper clears inherited service credentials, prevents dotenv reads and blocks non-loopback sockets/fetches. A direct negative check confirmed credential-file reads and external network calls are denied. No credentials were printed.

| Exact command | Result |
| --- | --- |
| `node scripts/run-isolated.mjs test` | Passed, including the five newly registered media/vote test files; 56.88 seconds |
| `node scripts/run-isolated.mjs typecheck` | Passed; 26.55 seconds |
| `node scripts/run-isolated.mjs lint` | Passed; 4.20 seconds; three existing no-img-element warnings in community pages and treasury TokenLogo |
| `node scripts/run-isolated.mjs build` | Passed; 116.46 seconds; existing prebuild hook ran |
| `node scripts/run-isolated.mjs node scripts/round-media-benchmark.mjs` | Passed fixed-fixture budgets and GIF checksums |
| `node scripts/run-isolated.mjs start --round-fixture --port 3100` then `node scripts/run-isolated.mjs node scripts/round-media-http-check.mjs` | Passed real production-server headers, ETag/304, v1 compatibility, unchanged GIF, uncached 400/404/405, SSR and Next-data checks |
| `git diff --check` | Passed; Git reports existing LF/CRLF normalization notices |

See `tests.log`, `typecheck.log`, `lint.log`, `build.log`, `http-check.log` and `http-check.json`. The build intentionally cannot reach external RPCs or the real database: optional static data reads use existing error fallbacks, with blocked-RPC/loopback-connection diagnostics in its log. This is build verification, not live-data verification. Local worker/browser process creation required reviewed sandbox escalation; there was no approval rejection.

Independent review found and fixed explicit PostgreSQL integer index binding, a trait-pixel render path that survived media refresh errors, and the legacy image/jpg alias. Regression tests cover each. Vote tests exercise signed-route authorization boundaries, 112-byte allowlisted receipts, failed postcommit refreshes, additive caps, self-vote denial and synthetic concurrent overspend. Storage/migration tests cover actual PNG/JPEG/JPG/WebP/GIF processing, decoded limits, byte hashes, scope denial, storage failure, simulated link renewal after expiry, conflicting edits, partial failures, reruns and conditional rollback. Provider expiry enforcement and real PostgreSQL isolation remain unavailable local integration checks; neither psql nor Docker is installed.

## Changed files

- Media data/schema: `data/rounds.ts`, `scripts/rounds-schema.sql`, `utils/rounds/roundMediaPayload.ts`.
- Delivery/storage: `pages/api/rounds/[slug]/asset.ts`, `pages/api/rounds/[slug]/media.ts`, `utils/rounds/image-processing.ts`, `utils/rounds/image-storage.ts`, `utils/rounds/prepare-image-assets.ts`, `next.config.js` (image CSP origins only).
- Voting and public readers: `pages/api/rounds/[slug]/vote.ts`, `pages/api/rounds/[slug]/voting-power.ts`, `pages/api/rounds/[slug]/submissions/[submissionId]/votes.ts`, `pages/api/rounds/[slug].ts`, `utils/rounds/refresh-committed-vote.ts`.
- Pages/components: `pages/rounds/[slug].tsx`, `pages/rounds/[slug]/submit.tsx`, `pages/rounds.tsx`, `components/rounds/RoundCard.tsx`, `components/rounds/RoundSubmissionCard.tsx`, `components/rounds/RoundImageGallery.tsx`.
- Tooling: `scripts/round-image-migrate.mjs`, `scripts/round-media-benchmark.mjs`, `scripts/round-media-browser-check.mjs`, `scripts/round-media-http-check.mjs`, `scripts/run-isolated.mjs`, `scripts/offline-preload.cjs`, `scripts/offline-round-pg.cjs`, `package.json`.
- Tests: `tests/round-vote-response.test.mjs`, `tests/round-media-contract.test.mjs`, `tests/round-image-delivery.test.mjs`, `tests/round-image-storage.test.mjs`, `tests/round-media-gallery.test.mjs`, `tests/round-additive-voting.test.mjs`, `tests/round-media-regressions.test.mjs`, `tests/admin-round-submission-media.test.mjs`, `tests/rounds-page-ordering-static.test.mjs`; fixed corpus/helper under `tests/fixtures/`.
- Runbooks: [rollout, caching and rollback](../../docs/round-media-bandwidth.md), [storage setup and exact migration commands](../../docs/round-image-storage.md). Generated fixture evidence lives in `output/round-media/` and `output/round-image-fixture/`.

Unrelated initial work was preserved. No source notes, imported notes, `.obsidian/`, plugin configuration, automation state or memory files were edited. Memory was read for prior gallery/GIF compatibility context. No commit, push, deployment, production database/provider operation, wallet signing, transaction, billing change or Vercel build-setting change occurred.
