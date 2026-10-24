import type { NextApiRequest, NextApiResponse } from "next";
import { pinataOptions, type UploadType } from "@/utils/ipfs-upload-config";
import { applyRateLimit } from "@/utils/rate-limit";
import { verifySignedRequest, setNoStoreHeaders } from "@/utils/signature-auth-server";

type UploadUrlResponse =
  | { url: string }
  | { error: string };

const isUploadType = (value: unknown): value is UploadType =>
  value === "image" || value === "media" || value === "json";

const getStringValue = (value: unknown) =>
  typeof value === "string" ? value : "";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UploadUrlResponse>
) {
  setNoStoreHeaders(res);
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  if (
    !applyRateLimit(req, res, {
      keyPrefix: "pinata-upload-url",
      limit: 30,
      windowMs: 60_000,
    })
  ) {
    return;
  }

  const type = req.body?.type;
  if (!isUploadType(type)) {
    res.status(400).json({ error: "Invalid upload type." });
    return;
  }

  if (!(await verifySignedRequest(req, res, { action: "ipfs:upload" }))) return;

  const jwt = process.env.PINATA_JWT || process.env.PINATA_API_JWT;
  if (!jwt) {
    res.status(503).json({
      error:
        "IPFS uploads are unavailable.",
    });
    return;
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const fileName = getStringValue(req.body?.fileName).slice(0, 180);
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
          date: now,
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
      console.error("Pinata signed upload URL failed", {
        status: pinataResponse.status,
      });
      res.status(502).json({
        error:
          "Unable to create a signed IPFS upload URL.",
      });
      return;
    }

    res.status(200).json({ url: body.data });
  } catch (error) {
    console.error("Pinata signed upload URL error", error);
    res.status(500).json({ error: "Unable to prepare the IPFS upload." });
  }
}
