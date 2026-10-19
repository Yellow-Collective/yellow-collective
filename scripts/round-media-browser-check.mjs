import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

// Uses the already bundled runtime; never downloads a browser or package.
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.ROUND_TEST_PLAYWRIGHT_PATH || "C:/Users/Deej/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const base = process.env.ROUND_TEST_ORIGIN || "http://127.0.0.1:3100";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
mkdirSync("output/round-media", { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.ROUND_TEST_BROWSER_PATH || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: true });
const report = [];
const fixtureState = (value) => writeFileSync("output/round-media/runtime-state.json", `${JSON.stringify(value)}\n`);
fixtureState({});
try {
  for (const [name, viewport] of [["desktop", { width: 1440, height: 1100 }], ["mobile", { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
    const page = await context.newPage();
    const requests = [], navigationResources = [], errors = [], blocked = [];
    const requestPhases = new WeakMap();
    let phase = "initial";
    page.on("request", (request) => requestPhases.set(request, phase));
    await context.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (["localhost", "127.0.0.1"].includes(url.hostname) || ["data:", "blob:"].includes(url.protocol)) return route.continue();
      blocked.push(url.origin);
      return route.abort("blockedbyclient");
    });
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("response", async (response) => {
      const url = new URL(response.url());
      if (url.pathname.includes("webpack") || !["localhost", "127.0.0.1"].includes(url.hostname)) return;
      const responsePhase = requestPhases.get(response.request()) || phase;
      try {
        const bytes = await response.body();
        const sizes = await response.request().sizes().catch(() => ({}));
        const item = { phase: responsePhase, path: url.pathname + url.search, status: response.status(), type: response.request().resourceType(), contentType: response.headers()["content-type"] || "", bodyBytes: bytes.length, wireBodyBytes: sizes.responseBodySize, cacheControl: response.headers()["cache-control"] || "" };
        navigationResources.push(item);
        if (url.pathname.includes("/rounds/")) requests.push({ ...item, sha256: createHash("sha256").update(bytes).digest("hex") });
      } catch { /* Navigation cancellation has no completed body. */ }
    });
    const initialManifest = page.waitForResponse((response) => response.url().includes("/media?v=2") && response.ok(), { timeout: 60_000 });
    await page.goto(`${base}/rounds/bandwidth-fixture`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    const buildId = await page.locator("#__NEXT_DATA__").evaluate((element) => JSON.parse(element.textContent || "{}").buildId);
    await page.getByRole("heading", { name: "Bandwidth fixture", exact: true }).waitFor({ timeout: 60_000 });
    await page.getByRole("button", { name: "Open Artwork 1", exact: true }).waitFor({ timeout: 60_000 });
    await initialManifest;
    await page.locator("img[src*='cover=1']").evaluate((image) => image.decode());
    await page.waitForTimeout(1000);
    assert.equal(requests.some((item) => item.phase === "initial" && item.path.includes("variant=original")), false, "Initial grid uses preview URLs; GIF preview responses intentionally retain original animated bytes");
    phase = "grid-scroll";
    await page.getByRole("button", { name: "Open Artwork 1", exact: true }).scrollIntoViewIfNeeded();
    await page.getByRole("button", { name: "Open Artwork 1", exact: true }).getByRole("img").evaluate((image) => image.decode());
    await page.waitForTimeout(500);
    await page.screenshot({ path: `output/round-media/${name}-grid.png`, fullPage: false });
    phase = "grid-gif";
    const gridGif = page.getByRole("button", { name: "Open Artwork 3", exact: true }).getByRole("img");
    await gridGif.scrollIntoViewIfNeeded();
    await gridGif.evaluate((image) => image.decode());
    assert.equal(await gridGif.getAttribute("loading"), "lazy");
    const gridFrame1 = await gridGif.screenshot({ animations: "allow" });
    await page.waitForTimeout(280);
    const gridFrame2 = await gridGif.screenshot({ animations: "allow" });
    assert.notDeepEqual(gridFrame1, gridFrame2, "Grid GIF must visibly animate without opening the entry");
    writeFileSync(`output/round-media/${name}-grid-gif-frame-1.png`, gridFrame1);
    writeFileSync(`output/round-media/${name}-grid-gif-frame-2.png`, gridFrame2);
    phase = "open-first";
    await page.getByRole("button", { name: "Open Artwork 1", exact: true }).click();
    const gallery = page.getByRole("region", { name: "Artwork 1 gallery" });
    await gallery.getByRole("img").waitFor();
    await gallery.getByRole("img").evaluate((image) => image.decode());
    assert.equal(await gallery.getByRole("img").count(), 1);
    await page.screenshot({ path: `output/round-media/${name}-gallery.png`, fullPage: false });
    phase = "open-gif";
    await gallery.getByRole("button", { name: "Show image 3 of 5", exact: true }).click();
    const animation = gallery.getByRole("img", { name: "Artwork 1 image 3 of 5" });
    await animation.evaluate((image) => image.decode());
    const frame1 = await animation.screenshot({ animations: "allow" });
    await page.waitForTimeout(280);
    const frame2 = await animation.screenshot({ animations: "allow" });
    assert.notDeepEqual(frame1, frame2, "GIF must visibly animate");
    writeFileSync(`output/round-media/${name}-gif-frame-1.png`, frame1);
    writeFileSync(`output/round-media/${name}-gif-frame-2.png`, frame2);
    phase = "failure";
    await page.route("**/asset?**", async (route) => route.request().url().includes("index=3") ? route.fulfill({ status: 503, body: "Fixture image unavailable" }) : route.continue());
    await gallery.getByRole("button", { name: "Show image 4 of 5", exact: true }).click();
    await gallery.getByRole("button", { name: "Retry image" }).waitFor();
    await page.screenshot({ path: `output/round-media/${name}-failure.png`, fullPage: false });
    await page.unroute("**/asset?**");
    phase = "retry";
    await gallery.getByRole("button", { name: "Retry image" }).click();
    await gallery.getByRole("img").evaluate((image) => image.decode());
    assert.equal(await gallery.getByRole("img").count(), 1);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    assert.equal(overflow, false, "Viewport must not overflow horizontally");
    const warmChecks = [];
    if (name === "desktop") {
      phase = "warm-moderation";
      fixtureState({ hiddenIds: ["submission-000"] });
      const denied = await context.request.get(`${base}/api/rounds/bandwidth-fixture/asset?id=submission-000&index=0&variant=original&v=old`);
      assert.equal(denied.status(), 404);
      assert.match(denied.headers()["cache-control"], /no-store/);
      await gallery.waitFor({ state: "detached", timeout: 40_000 });
      assert.equal(await page.getByRole("button", { name: "Open Artwork 1", exact: true }).count(), 0);
      warmChecks.push("warm manifest moderation removes card and open gallery; stale direct asset request denied404/no-store");
      fixtureState({ titleSuffix: " edited", updatedAt: "2026-10-19T12:01:00.000Z" });
      await page.getByRole("button", { name: "Open Artwork 1 edited", exact: true }).waitFor({ timeout: 40_000 });
      warmChecks.push("revision change refreshes lightweight SSR metadata and artwork titles");
      phase = "warm-failure";
      fixtureState({ failMedia: true });
      await page.getByText("Artwork could not refresh. Images are temporarily hidden; reconnect or refresh to try again.", { exact: true }).waitFor({ timeout: 40_000 });
      await page.screenshot({ path: "output/round-media/desktop-manifest-failure.png", fullPage: false });
      warmChecks.push("failed manifest refresh hides prior artwork and exposes recovery message");
      fixtureState({ active: false });
      const deactivated = await context.request.get(`${base}/api/rounds/bandwidth-fixture/asset?id=submission-001&index=0&variant=original&v=old`);
      assert.equal(deactivated.status(), 404);
      warmChecks.push("deactivation denies old direct image URLs");
      fixtureState({});
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: "Open Artwork 1", exact: true }).waitFor();
      console.log("ok - warm moderation, edit, manifest failure and round deactivation browser checks");
    }
    if (name !== "desktop") {
      await page.getByRole("button", { name: "Close", exact: true }).first().click();
      assert.equal(await page.getByRole("region", { name: "Artwork 1 gallery" }).count(), 0);
    }
    const initialResources = navigationResources.filter((item) => item.phase === "initial");
    const initial = requests.filter((item) => item.phase === "initial");
    assert.equal(initial.some((item) => item.path.includes("variant=original")), false);
    const initialMedia = initial.filter((item) => item.path.includes("/asset?") || item.path.includes("/media?"));
    report.push({ viewport: name, serverMode: buildId === "development" ? "development" : "production", buildId, initialMediaRequests: initialMedia.length, initialMediaBodyBytes: initialMedia.reduce((total, item) => total + item.bodyBytes, 0), initialMediaWireBodyBytes: initialMedia.reduce((total, item) => total + Math.max(0, item.wireBodyBytes || 0), 0), initialOriginalRequests: initialMedia.filter((item) => item.contentType === "image/gif").length, initialStaticOriginalRequests: 0, initialHiddenGalleryOriginalRequests: 0, initialAnimatedGifOriginals: initialMedia.filter((item) => item.contentType === "image/gif").length, gridGifFramesDiffer: true, applicationNavigationRequests: initialResources.length, applicationNavigationBodyBytes: initialResources.reduce((total, item) => total + item.bodyBytes, 0), applicationNavigationWireBodyBytes: initialResources.reduce((total, item) => total + Math.max(0, item.wireBodyBytes || 0), 0), gifFramesDiffer: true, noHorizontalOverflow: !overflow, warmChecks, blockedExternalOrigins: [...new Set(blocked)], pageErrors: errors, requests, navigationResources });
    await context.close();
  }
  writeFileSync("output/round-media/browser-network.json", `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report.map(({ requests, navigationResources, ...summary }) => summary), null, 2));
} finally {
  fixtureState({});
  await browser.close();
}
