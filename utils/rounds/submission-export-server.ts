import { lookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";
import { SITE_URL } from "@/utils/site";
import { normalizeSafeImageUrl } from "@/utils/url-safety";

export const ROUND_ARTWORK_MAX_BYTES = 20 * 1024 * 1024;
export const ROUND_ARTWORK_TOTAL_MAX_BYTES = 250 * 1024 * 1024;
const ARTWORK_REQUEST_TIMEOUT_MS = 10_000;
const ARTWORK_MAX_REDIRECTS = 3;

export type RoundArtworkDownload = {
  buffer: Buffer;
  contentType: "image/gif" | "image/jpeg" | "image/png" | "image/webp";
};

type RequestImage = (url: URL, maxBytes: number) => Promise<{
  buffer: Buffer;
  contentType: string;
}>;

const normalizeImageContentType = (value: string) => {
  const contentType = value.toLowerCase().split(";", 1)[0].trim();
  return contentType === "image/jpg" ? "image/jpeg" : contentType;
};

const detectImageContentType = (buffer: Buffer) => {
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png" as const;
  }

  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "image/jpeg" as const;
  }

  const prefix = buffer.subarray(0, 6).toString("ascii");
  if (prefix === "GIF87a" || prefix === "GIF89a") {
    return "image/gif" as const;
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp" as const;
  }

  return null;
};

const validateArtworkDownload = (
  buffer: Buffer,
  declaredContentType: string,
  maxBytes: number
): RoundArtworkDownload => {
  if (buffer.length === 0) throw new Error("Artwork image was empty.");
  if (buffer.length > maxBytes) throw new Error("Artwork image is too large.");

  const detectedContentType = detectImageContentType(buffer);
  const normalizedDeclaredType = normalizeImageContentType(declaredContentType);
  if (!detectedContentType || detectedContentType !== normalizedDeclaredType) {
    throw new Error("Artwork response was not a valid supported image.");
  }

  return { buffer, contentType: detectedContentType };
};

const isUnsafeIpv4Address = (address: string) => {
  const octets = address.split(".").map(Number);
  if (
    octets.length !== 4 ||
    octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)
  ) {
    return true;
  }

  const [first, second, third] = octets;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 &&
      (second === 0 ||
        second === 168 ||
        (second === 88 && third === 99))) ||
    (first === 198 && (second === 18 || second === 19)) ||
    (first === 198 && second === 51 && third === 100) ||
    (first === 203 && second === 0 && third === 113) ||
    first >= 224
  );
};

export const isUnsafeNetworkAddress = (address: string): boolean => {
  const normalized = address.toLowerCase().split("%", 1)[0];
  const family = isIP(normalized);

  if (family === 4) return isUnsafeIpv4Address(normalized);
  if (family !== 6) return true;

  if (normalized.startsWith("::ffff:")) {
    const mappedAddress = normalized.slice("::ffff:".length);
    return isUnsafeNetworkAddress(mappedAddress);
  }
  if (/^(?:0*:){5}ffff:/.test(normalized)) return true;

  return (
    normalized === "::" ||
    normalized === "::1" ||
    /^f[cd]/.test(normalized) ||
    /^fe[89ab]/.test(normalized) ||
    normalized.startsWith("ff") ||
    normalized.startsWith("2001:db8:")
  );
};

const isTrustedLocalDevelopmentUrl = (url: URL) => {
  if (process.env.NODE_ENV === "production") return false;

  try {
    return url.origin === new URL(SITE_URL).origin;
  } catch {
    return false;
  }
};

const getPinnedAddress = async (url: URL) => {
  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (addresses.length === 0) {
    throw new Error("Artwork host could not be resolved.");
  }

  const allowLocal = isTrustedLocalDevelopmentUrl(url);
  if (!allowLocal && addresses.some(({ address }) => isUnsafeNetworkAddress(address))) {
    throw new Error("Artwork host resolved to a blocked network address.");
  }

  return addresses[0];
};

const requestRemoteImage = async (
  url: URL,
  maxBytes: number,
  redirectCount = 0
): Promise<{ buffer: Buffer; contentType: string }> => {
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Artwork URL protocol is not supported.");
  }
  if (url.protocol === "http:" && !isTrustedLocalDevelopmentUrl(url)) {
    throw new Error("Artwork URL must use HTTPS.");
  }

  const pinnedAddress = await getPinnedAddress(url);
  const transport = url.protocol === "https:" ? https : http;

  return new Promise((resolve, reject) => {
    const request = transport.request(
      url,
      {
        headers: {
          Accept: "image/png,image/jpeg,image/gif,image/webp",
          "User-Agent": "YellowCollective-RoundExport/1.0",
        },
        lookup: ((_hostname: string, _options: unknown, callback: Function) => {
          callback(null, pinnedAddress.address, pinnedAddress.family);
        }) as any,
      },
      (response) => {
        const statusCode = response.statusCode || 0;
        const location = response.headers.location;

        if (statusCode >= 300 && statusCode < 400 && location) {
          response.resume();
          if (redirectCount >= ARTWORK_MAX_REDIRECTS) {
            reject(new Error("Artwork request redirected too many times."));
            return;
          }

          let redirectUrl: URL;
          try {
            redirectUrl = new URL(location, url);
          } catch {
            reject(new Error("Artwork request returned an invalid redirect."));
            return;
          }

          void requestRemoteImage(redirectUrl, maxBytes, redirectCount + 1).then(
            resolve,
            reject
          );
          return;
        }

        if (statusCode < 200 || statusCode >= 300) {
          response.resume();
          reject(new Error(`Artwork request returned ${statusCode || "an error"}.`));
          return;
        }

        const declaredLength = Number(response.headers["content-length"] || 0);
        if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
          response.resume();
          reject(new Error("Artwork image is too large."));
          return;
        }

        const chunks: Buffer[] = [];
        let receivedBytes = 0;
        response.on("data", (chunk: Buffer | Uint8Array) => {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          receivedBytes += buffer.length;
          if (receivedBytes > maxBytes) {
            response.destroy(new Error("Artwork image is too large."));
            return;
          }
          chunks.push(buffer);
        });
        response.on("end", () => {
          const combined = Buffer.allocUnsafe(receivedBytes);
          let offset = 0;
          for (const chunk of chunks) {
            combined.set(chunk, offset);
            offset += chunk.length;
          }
          resolve({
            buffer: combined,
            contentType: String(response.headers["content-type"] || ""),
          });
        });
        response.on("error", reject);
      }
    );

    request.setTimeout(ARTWORK_REQUEST_TIMEOUT_MS, () => {
      request.destroy(new Error("Artwork request timed out."));
    });
    request.on("error", reject);
    request.end();
  });
};

const decodeDataImage = (value: string, maxBytes: number) => {
  const match = value.match(
    /^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,([a-zA-Z0-9+/=]+)$/
  );
  if (!match) throw new Error("Artwork data image is invalid.");

  const buffer = Buffer.from(match[2], "base64");
  return validateArtworkDownload(buffer, match[1], maxBytes);
};

export const fetchRoundSubmissionArtwork = async ({
  image,
  maxBytes,
  requestImage = requestRemoteImage,
}: {
  image: string;
  maxBytes: number;
  requestImage?: RequestImage;
}) => {
  if (maxBytes <= 0) throw new Error("Round artwork export size limit reached.");

  const normalizedImage = normalizeSafeImageUrl(image, {
    allowInternal: true,
    allowDataImages: true,
    allowLocalHttp: process.env.NODE_ENV !== "production",
  });
  if (!normalizedImage) throw new Error("Artwork image URL is invalid.");

  if (normalizedImage.startsWith("data:")) {
    return decodeDataImage(normalizedImage, maxBytes);
  }

  const imageUrl = new URL(normalizedImage, SITE_URL);
  const downloaded = await requestImage(imageUrl, maxBytes);
  return validateArtworkDownload(
    downloaded.buffer,
    downloaded.contentType,
    maxBytes
  );
};
