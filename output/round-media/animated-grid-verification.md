# Animated GIF grid follow-up

GIF animation stays visible on round grids without opening an entry. The eligibility-checked preview route now serves original GIF bytes for legacy records, and signs the original GIF key for migrated records. Existing static GIF preview objects are retained for compatibility but are no longer selected for grid delivery. External GIF references already retain their existing browser animation. Still-image previews, lazy loading, permission checks, expiry, no-store image delivery and on-demand hidden gallery images are preserved. There is no schema change, re-encode, provider operation or deployment.

Changed application code: `pages/api/rounds/[slug]/asset.ts`. Behavioral coverage in `tests/round-image-delivery.test.mjs` checks unchanged GIF hashes on the preview path, animated-key selection for migrated GIFs with existing still-preview metadata, continued smaller JPEG previews and unchanged scope denial/link renewal. Browser/HTTP scripts now explicitly exercise the grid GIF path, rather than inferring byte behavior from `variant=preview` in a URL.

The fixed GIF is 14,366 bytes; its stored still is 720 bytes. Preserving motion costs 13,646 additional bytes for each displayed GIF in this corpus. The unchanged 100-entry/five-image fixture has 33 GIF covers, adding 450,318 bytes if every entry is scrolled into view. Its full-grid media-only model is now 1,076,527 raw / 1,016,788 gzip-model / 1,015,724 Brotli-model bytes. The baseline inline media remains 49,961,800 raw / 32,167,780 gzip / 161,137 Brotli bytes. The repetitive fixture's Brotli regression remains visible and is not hidden. These are media models, not hosted measurements.

The full-grid request model remains 102 application requests and 103 manifest/eligibility reads; migrated submission storage adds 100 object GETs. The inline round cover stays on legacy delivery. Thirty-three original GIFs are intentionally delivered by grid URLs; no static originals or hidden gallery images are fetched initially. Legacy GIFs now avoid still-thumbnail decoding. Manifests and vote receipts have unchanged sizes and contracts.

Commands use the existing isolated runner and Yarn scripts. Results and final desktop/mobile grid-animation screenshots are recorded alongside this file; the initial still-grid report is retained separately. Production savings, provider behavior and production rollout remain unverified and require separate authorization.

| Command | Result |
| --- | --- |
| `node scripts/run-isolated.mjs test` | Passed full suite, 53.14 seconds |
| `node scripts/run-isolated.mjs typecheck` | Passed, 51.94 seconds |
| `node scripts/run-isolated.mjs lint` | Passed, 4.96 seconds; existing three image warnings remain |
| `node scripts/run-isolated.mjs build` | Passed, 171.62 seconds |
| `node scripts/run-isolated.mjs node scripts/round-media-benchmark.mjs` | Passed unchanged fixture budgets and hashes; costs updated for animated GIF grid delivery |
| `node scripts/run-isolated.mjs node scripts/round-media-http-check.mjs` | Passed real production-server headers, conditional requests, GIF grid/original byte identity, SSR and Next-data checks |

Logs use the `animated-grid-` prefix. The local server uses synthetic database fixtures, with provider credentials omitted and non-loopback network denied. No external service or production data was contacted; original data and stored still previews remain intact.

Final `next start` browser checks passed on desktop (1440×1100) and mobile (390×844). The grid GIF was scrolled into view, decoded while the entry stayed closed, and captured twice 280ms apart. The frames differ on both viewports, proving visible grid animation. Native lazy loading is asserted. Screenshots: `desktop-grid-gif-frame-1.png`, `desktop-grid-gif-frame-2.png`, `mobile-grid-gif-frame-1.png`, `mobile-grid-gif-frame-2.png`. Gallery GIFs, selected-image loading, image failure/retry, warm moderation, metadata edits, manifest failure and deactivation checks also passed, with no page exceptions or horizontal overflow. Current network evidence is `browser-network.json`; prior still-grid evidence is retained separately. The temporary server was stopped after verification.
