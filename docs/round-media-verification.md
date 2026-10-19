# Round media: local verification

This is local synthetic evidence, not a measurement of hosted traffic. No production database, object storage, credential, billing or deployment changes were made during implementation. GIFs animate directly on the grid; still artwork uses smaller previews, cards retain lazy loading, and hidden gallery originals load only when selected.

## Fixed fixture results

The bounded fixture contains 100 submissions with five ordered images each, drawn from two repository PNGs and an eight-frame GIF. The original bytes and fixture generation stay identical before and after. See `tests/fixtures/round-media/README.md` for provenance and hashes. JSON measurements use UTF-8, gzip level 9 and Brotli quality 11.

| Response | Raw bytes | gzip bytes | Brotli bytes |
| --- | ---: | ---: | ---: |
| Original media JSON | 49,961,800 | 32,167,780 | 161,137 |
| Compact gateway manifest | 61,981 | 2,242 | 1,178 |
| Manifest with five 128-byte ASCII URLs per entry | 71,619 | 2,194 | 1,174 |
| Original successful vote response | 51,752,016 | 32,509,454 | 313,117 |
| Compact successful vote receipt | 112 | 110 | 82 |

The full-grid media model with 33 animated GIF covers is 1,076,527 raw / 1,016,788 gzip-model / 1,015,724 Brotli-model bytes, including every card and the round cover. The unchanged repeated-artwork fixture compresses exceptionally well with Brotli, so full-grid Brotli transfer increases; that miss is retained. Keeping motion costs 13,646 extra bytes per displayed fixture GIF compared with its 720-byte still, or 450,318 bytes if all 33 GIF cards are viewed. Viewport loading transfers fewer images. These totals exclude the application shell, response headers and TLS.

The full-grid model uses 102 application requests and 103 manifest/eligibility reads. Migrated submission storage adds 100 object GETs; round covers retain bounded legacy delivery. GIF originals are intentionally delivered to visible grid cards; static originals and hidden gallery images are not eagerly requested. Successful voting no longer reads full submissions after COMMIT. Original data remains available for compatibility and rollback.

## Verification commands

Using Node 22.14.0, Yarn 1.22.22, Next.js 15.5.24 and the existing dependency lockfile:

| Command | Latest result |
| --- | --- |
| `node scripts/run-isolated.mjs test` | Passed full suite, 53.14 seconds |
| `node scripts/run-isolated.mjs typecheck` | Passed, 51.94 seconds |
| `node scripts/run-isolated.mjs lint` | Passed, 4.96 seconds; three existing image warnings outside changed paths |
| `node scripts/run-isolated.mjs build` | Passed, 171.62 seconds |
| `node scripts/run-isolated.mjs node scripts/round-media-benchmark.mjs` | Passed fixture budgets and hashes |

The isolation wrapper clears inherited service configuration, prevents dotenv reads and denies non-loopback network. Optional static data reads exercise existing fallbacks when external RPCs/database access are blocked. This establishes build behavior, not live-data correctness.

For real HTTP/browser checks, start the isolated local production build:

```powershell
node scripts/run-isolated.mjs start --round-fixture --port 3100
# In another terminal:
node scripts/run-isolated.mjs node scripts/round-media-http-check.mjs
node scripts/run-isolated.mjs node scripts/round-media-browser-check.mjs
```

The browser script uses an already available Playwright installation and Edge through documented path overrides; it does not install packages or browsers. HTTP checks passed manifest TTLs, conditional 304s, unchanged original/grid GIF bytes, uncached errors and base64-free SSR/Next-data. Desktop 1440x1100 and mobile 390x844 checks passed grid animation without opening entries, gallery navigation, retry, lazy loading, warm moderation, edits, manifest failure and deactivation, with no page exceptions or horizontal overflow. Grid screenshots taken 280ms apart differ on both viewports. Synthetic database and storage tests cover scope denial, malformed uploads, byte integrity, simulated expiry renewal, concurrent edits, partial failures, reruns and conditional rollback.

Generated logs, screenshots, network captures and fixture journals stay local under `output/round-media/` and `output/round-image-fixture/`; rerunning the scripts recreates them. These generated artifacts are not required application source.

## Remaining hosted checks

Real PostgreSQL isolation, private-bucket enforcement, provider expiry, CDN behavior, costs and comparable production measurements remain unverified. Neither psql nor Docker was available for matching-engine tests. No production savings are claimed. See [rollout and rollback](round-media-bandwidth.md) and [private storage/migration commands](round-image-storage.md) for the separately authorized next steps.
