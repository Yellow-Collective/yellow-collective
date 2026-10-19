# Fixed round-media corpus

These local files are copied byte-for-byte from this repository. No network download, original re-encoding, or provider operation is part of fixture creation.

| File | Source | Bytes | Dimensions / frames | SHA-256 |
| --- | --- | ---: | --- | --- |
| artwork.png | public/banner.png | 138552 | 1956 × 1046; one frame | 2e34630c7afabf0b212ee52faf27acab8a3071f7dff782f33a4220ef53a5172a |
| portrait.png | public/miniapp-hero.png | 33054 | 1200 × 630; one frame | bd60b593377ec1d882bc4e56a9a4617a4cf3a5348137def101181254e61565ed |
| animation.gif | public/loading.gif | 14366 | 320 × 320; eight frames, 130 ms each | af3b049ea9ae0d4a51d695340db65672e248e584f3aa6fb767ac0e42b1c5b513 |

`../round-media-fixture.mjs` creates 100 submissions with five ordered images per submission. The original corpus rotates by submission and gallery index. It includes a nested source-payload image to exercise serializers. The baseline and optimized serializer receive the same original fixture. A separate representation substitutes five exactly 128-byte ASCII URLs per entry to check the manifest contract budget. These URLs use the reserved `.invalid` domain and are never requested.

Run `node scripts/round-media-benchmark.mjs` to save `output/round-media/benchmark.json`. Every JSON body uses UTF-8, gzip level 9, and Brotli quality 11. Stored previews use the implementation's bounded first-frame 640-pixel WebP processor; grid delivery uses those previews for still images and unchanged originals for GIF animation. The original PNG/GIF buffers are checked for exact equality and SHA-256 equality.

The corpus deliberately remains unchanged when a metric misses. Its three repeating artworks compress exceptionally well under Brotli's large window. The modeled complete grid therefore transfers more bytes with Brotli than the embedded baseline even though raw/gzip bytes and manifest bytes fall sharply. This result is retained and reported; it is not a prediction of production traffic. Actual local viewport measurements are recorded separately.

`scripts/round-media-browser-check.mjs` exercises the real Next.js round page against the isolated in-memory PG fixture. It requires the parent process to run `node scripts/run-isolated.mjs dev --round-fixture --port 3100`. It launches an already installed browser in a temporary profile, blocks every non-loopback page request, and records separate application and media responses. The default Playwright and Edge paths are Windows workspace paths; override `ROUND_TEST_PLAYWRIGHT_PATH` and `ROUND_TEST_BROWSER_PATH` for another already installed runtime. It never installs a browser or package.

For production-bundle evidence, run `node scripts/run-isolated.mjs build` and use `node scripts/run-isolated.mjs start --round-fixture --port 3100` instead of dev. The browser script identifies which server mode/build it measures. Neither mode establishes hosted CDN/provider behavior or production savings. The in-memory fixture handles read-only queries; it is not database transaction or production-provider proof. Warm moderation/edit/failure tests change only `output/round-media/runtime-state.json` and reset it afterward. The browser script captures desktop/mobile grids, selected originals, visibly different GIF frames on both the grid and gallery, failed image loading and retries, plus network body sizes and effective local headers.
