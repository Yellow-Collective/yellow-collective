import type { NextApiRequest, NextApiResponse } from "next";
import { setGalleryCoinHidden } from "data/coins";
import { requireAdminRequest } from "@/utils/admin-api";

const getAddressParam = (req: NextApiRequest) => {
  const address = req.query.address;
  return typeof address === "string" ? address : address?.[0];
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "PATCH") {
    res.setHeader("Allow", "PATCH");
    return res.status(405).json({ error: "Method not allowed." });
  }

  if (!(await requireAdminRequest(req, res, "gallery"))) return;

  const address = getAddressParam(req);
  if (!address) {
    return res.status(400).json({ error: "Coin address is required." });
  }

  try {
    const coin = await setGalleryCoinHidden({
      address,
      hidden: Boolean(req.body?.hidden),
    });

    if (!coin) return res.status(404).json({ error: "Coin not found." });

    return res.status(200).json({ coin });
  } catch (error) {
    console.error("Admin gallery coin update failed", error);
    return res.status(500).json({
      error:
        error instanceof Error ? error.message : "Unable to update coin.",
    });
  }
}
