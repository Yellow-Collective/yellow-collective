import type { NextApiRequest, NextApiResponse } from "next";
import { pinataOptions, type UploadType } from "@/utils/ipfs-upload-config";
import { applyRateLimit } from "@/utils/rate-limit";
import { verifySignedRequest, setNoStoreHeaders } from "@/utils/signature-auth-server";

type UploadResponse =
  | { data?: { cid?: string }; IpfsHash?: string }
  | { error: string };

export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
  },
};

const isUploadType = (value: unknown): value is UploadType =>
  value === "image" || value === "media" || value === "json";

const getStringValue = (value: unknown) =>
  typeof value === "string" ? value : "";

const createSignedUploadUrl = async ({
  jwt,
  type,
  fileName,
}: {
  jwt: string;
  type: UploadType;
  fileName: string;
}) => {
  const uploadOptions = pinataOptions[type];
  const pinataResponse = await fetch(
    "https://uploads.pinata.cloud/v3/files/sign",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        date: Math.floor(Date.now() / 1000),
        expires: 600,
        max_file_size: uploadOptions.max_file_size,
        allow_mime_types: uploadOptions.allow_mime_types,
        filename: fileName || undefined,
      }),
    }
  );

  const body = (await pinataResponse.json().catch(() => ({}))) as {
    data?: string;
    error?: string;
    message?: string;
  };

  if (!pinataResponse.ok || !body.data) {
    throw new Error(
      body.error || body.message || "Unable to create a signed IPFS upload URL."
    );
  }

  return body.data;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UploadResponse>
) {
  setNoStoreHeaders(res);
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  if (
    !applyRateLimit(req, res, {
      keyPrefix: "pinata-upload",
      limit: 20,
      windowMs: 60_000,
    })
  ) {
    return;
  }

  const type = req.query.type;
  if (!isUploadType(type)) {
    res.status(400).json({ error: "Invalid upload type." });
    return;
  }

  const contentType = getStringValue(req.headers["content-type"]);
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    res.status(400).json({ error: "Upload must use multipart form data." });
    return;
  }

  const contentLength = Number(req.headers["content-length"] || "0");
  const maxBodySize = pinataOptions[type].max_file_size + 1024 * 1024;
  if (contentLength && contentLength > maxBodySize) {
    res.status(413).json({ error: "File is too large." });
    return;
  }

  const jwt = process.env.PINATA_JWT || process.env.PINATA_API_JWT;
  if (!(await verifySignedRequest(req, res, {
    action: "ipfs:upload",
    payload: { type, fileName: getStringValue(req.query.fileName).slice(0, 180) },
  }))) return;
  if (!jwt) {
    res.status(503).json({
      error: "IPFS uploads are unavailable.",
    });
    return;
  }

  try {
    const signedUrl = await createSignedUploadUrl({
      jwt,
      type,
      fileName: getStringValue(req.query.fileName).slice(0, 180),
    });
    const uploadResponse = await fetch(signedUrl, {
      method: "POST",
      headers: {
        "Content-Type": contentType,
      },
      body: req as unknown as BodyInit,
      duplex: "half",
    } as RequestInit & { duplex: "half" });
    const body = (await uploadResponse.json().catch(() => ({}))) as {
      data?: { cid?: string };
      IpfsHash?: string;
      error?: string;
      message?: string;
    };

    if (!uploadResponse.ok || !(body.data?.cid || body.IpfsHash)) {
      console.error("Pinata upload failed", {
        status: uploadResponse.status,
      });
      res.status(502).json({
        error:
          "IPFS upload failed. Check your connection and try again.",
      });
      return;
    }

    res.status(200).json({ data: { cid: body.data?.cid || body.IpfsHash } });
  } catch (error) {
    console.error("Pinata upload error", error);
    res.status(500).json({ error: "Unable to upload to IPFS." });
  }
}
