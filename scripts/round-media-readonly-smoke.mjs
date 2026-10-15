// Read-only release verification. Never signs, uploads or changes server state.
const [base, slug] = process.argv.slice(2);
if (!base || !slug || !/^[a-zA-Z0-9-]+$/.test(slug)) {
  throw new Error("Usage: node scripts/round-media-readonly-smoke.mjs <origin> <round-slug>");
}
const origin = new URL(base);
if (
  origin.origin !== base || origin.username || origin.password ||
  (origin.protocol !== "https:" && !(
    origin.protocol === "http:" && ["localhost", "127.0.0.1"].includes(origin.hostname)
  ))
) throw new Error("Use an HTTPS origin, or HTTP localhost, without credentials or a path.");
const read = async (path) => {
  const response = await fetch(new URL(path, origin), {
    signal: AbortSignal.timeout(30000), cache: "no-store", redirect: "error",
  });
  return { response, text: await response.text() };
};
let failed = false;
const check = (name, ok, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}: ${detail}`);
  if (!ok) failed = true;
};
const capability = await read(`/api/rounds/${slug}/videos`);
let enabled;
try { enabled = JSON.parse(capability.text).enabled; } catch {}
check("video API", capability.response.ok && enabled === true,
  `HTTP ${capability.response.status}, enabled=${String(enabled)}`);
const page = await read(`/rounds/${slug}/submit`);
check("submission page", page.response.ok, `HTTP ${page.response.status}`);
const nextData = page.text.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
if (nextData) console.log(`Build: ${JSON.parse(nextData[1]).buildId}`);
const paths = [...page.text.matchAll(/<script[^>]*src="([^"]+)"/g)]
  .map((match) => match[1].replaceAll("&amp;", "&"))
  .filter((path) => path.startsWith("/_next/static/chunks/"));
const chunks = await Promise.all(paths.map(read));
const source = chunks.map((chunk) => chunk.text).join("\n");
check("video uploader in deployed page", source.includes("Optional video") && source.includes("/videos"),
  "compiled page must include uploader and capability request");
check("GIF-preserving uploader in deployed page", source.includes("preserve animation"),
  "compiled page must include GIF-preservation size validation");
console.log("Compiled-code checks are release indicators; they do not test wallet upload or browser animation.");
process.exitCode = failed ? 1 : 0;
