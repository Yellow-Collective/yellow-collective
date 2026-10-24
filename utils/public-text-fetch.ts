import { lookup } from "node:dns/promises";
import https from "node:https";
import { isUnsafeNetworkAddress } from "./rounds/submission-export-server";

// Proposal text URLs are authored onchain by untrusted users. Pin the validated
// DNS result to the socket, and recheck every redirect before following it.
export const fetchPublicText = async (input: string, redirects = 0): Promise<string> => {
  const url = new URL(input);
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443"))
    throw new Error("Unsupported public text URL.");
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) =>
    isUnsafeNetworkAddress(address) || (address.includes(":") && (!/^[23]/.test(address) || /^200[12]:/i.test(address)))))
    throw new Error("Public text host is unavailable.");
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      agent: false,
      lookup: ((_host: string, options: any, callback: Function) => {
        const first = addresses[0];
        if (options?.all) callback(null, [first]);
        else callback(null, first.address, first.family);
      }) as any,
    }, (response) => {
      const status = response.statusCode || 0;
      if (status >= 300 && status < 400 && response.headers.location) {
        response.resume();
        if (redirects >= 3) { reject(new Error("Too many public text redirects.")); return; }
        try {
          void fetchPublicText(new URL(response.headers.location, url).href, redirects + 1).then(resolve, reject);
        } catch { reject(new Error("Invalid public text redirect.")); }
        return;
      }
      if (status < 200 || status >= 300) {
        response.resume(); reject(new Error("Public text is unavailable.")); return;
      }
      const chunks: Buffer[] = [];
      let bytes = 0;
      response.on("data", (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > 256 * 1024) { response.destroy(new Error("Public text exceeds limit.")); return; }
        chunks.push(chunk);
      });
      response.on("error", reject);
      response.on("end", () => {
        const combined = Buffer.alloc(bytes);
        let offset = 0;
        for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.length; }
        resolve(combined.toString("utf8"));
      });
    });
    const timer = setTimeout(() => request.destroy(new Error("Public text timed out.")), 5000);
    request.on("close", () => clearTimeout(timer));
    request.on("error", reject);
  });
};
