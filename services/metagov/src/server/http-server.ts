import http from "http";
import { config } from "../config";
import { StateStore } from "../services/state-store";
import { timingSafeEqual } from "crypto";

const sendJson = (
  res: http.ServerResponse,
  statusCode: number,
  data: unknown
) => {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data, null, 2));
};

export const startHttpServer = (store: StateStore) => {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || "/", "http://localhost");

    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return sendJson(res, 405, { error: "Method not allowed" });
    }

    if (url.pathname === "/health") {
      return sendJson(res, 200, {
        ok: true,
      });
    }

    // Raw state includes notification responses and internal failure details.
    // The public website consumes it server-side and publishes a scoped view.
    const secret = process.env.METAGOV_STATE_SECRET;
    const supplied = Buffer.from(req.headers.authorization || "");
    const expected = Buffer.from(`Bearer ${secret || ""}`);
    if (!secret || supplied.length !== expected.length || !timingSafeEqual(new Uint8Array(supplied), new Uint8Array(expected))) {
      return sendJson(res, 401, { error: "Authentication required" });
    }

    if (url.pathname === "/state" || url.pathname === "/state-file") {
      return sendJson(res, 200, store.load());
    }

    const proposalMatch = url.pathname.match(/^\/state\/(\d+)$/);
    if (proposalMatch) {
      const state = store.load();
      const proposal = state.proposals[proposalMatch[1]];
      return sendJson(res, proposal ? 200 : 404, proposal || null);
    }

    return sendJson(res, 404, { error: "Not found" });
  });

  server.listen(config.port, () => {
    console.log(`Metagov status server listening on :${config.port}`);
  });

  return server;
};
