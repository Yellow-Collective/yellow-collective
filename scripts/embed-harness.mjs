import http from "node:http";

// Local, read-only parent page matching the Satori portfolio iframe attributes.
const option = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index < 0 ? fallback : process.argv[index + 1];
};
const port = Number(option("--port", "3002"));
const childPort = Number(option("--child-port", "3001"));
for (const value of [port, childPort]) {
  if (!Number.isInteger(value) || value < 1024 || value > 65535) {
    throw new Error("Use a port between 1024 and 65535.");
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  if (url.pathname !== "/") {
    res.writeHead(404).end();
    return;
  }
  const mobile = url.searchParams.get("width") === "390";
  const childPath = url.searchParams.get("path") || "/";
  if (!/^\/[a-zA-Z0-9/_-]*$/.test(childPath)) {
    res.writeHead(400).end("Use a local route path containing letters, numbers, slashes, underscores, or hyphens.");
    return;
  }
  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(`<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Yellow Collective local embedding verification</title>
<style>
body{margin:0;background:#eee;font:14px system-ui;color:#222}
header{padding:12px;display:flex;gap:16px;flex-wrap:wrap;align-items:center}
iframe{display:block;width:${mobile ? "min(390px,100%)" : "100%"};height:calc(100vh - 70px);border:0;background:white;margin:auto}
a:focus-visible{outline:3px solid #326be6;outline-offset:3px}
</style></head><body>
<header><strong>Local verification only</strong>
<a href="/">Desktop</a><a href="/?width=390">390px frame</a>
<a href="http://localhost:${childPort}/" target="_blank" rel="noopener noreferrer">Standalone</a>
<span>Parent port ${port}; child port ${childPort}</span></header>
<iframe title="Yellow Collective" src="http://localhost:${childPort}${childPath}"
sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
referrerpolicy="no-referrer"></iframe>
</body></html>`);
});
server.on("error", (error) => {
  console.error(`Embedding harness could not start: ${error.code || error.message}`);
  process.exitCode = 1;
});
server.listen(port, "127.0.0.1", () => {
  console.log(`Embedding harness: http://localhost:${port}/ (child port ${childPort})`);
});
