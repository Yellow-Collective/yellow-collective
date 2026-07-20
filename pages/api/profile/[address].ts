import {
  getFirstOwnedCollectiveNounImage,
  getProfileMetadata,
  saveProfileMetadata,
} from "data/profile";
import type { NextApiRequest, NextApiResponse } from "next";
import { getAddress, isAddress } from "viem";
import { PROFILE_UPDATE_SIGNED_REQUEST_ACTION } from "@/utils/profile/identity";
import { verifySignedRequest } from "@/utils/signature-auth-server";

type UpdateProfileBody = {
  profile?: {
    username?: string;
    websiteUrl?: string;
    farcaster?: string;
    twitter?: string;
    avatarUrl?: string;
  };
};

const getRequestedAddress = (req: NextApiRequest) => {
  const rawAddress = Array.isArray(req.query.address)
    ? req.query.address[0]
    : req.query.address;

  return rawAddress && isAddress(rawAddress)
    ? getAddress(rawAddress)
    : undefined;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const address = getRequestedAddress(req);

  if (!address) {
    return res.status(400).json({ error: "Invalid wallet address." });
  }

  try {
    if (req.method === "GET") {
      const [profile, fallbackAvatarUrl] = await Promise.all([
        getProfileMetadata(address),
        getFirstOwnedCollectiveNounImage(address).catch((error) => {
          console.error("Collective Noun profile fallback load failed", error);
          return "";
        }),
      ]);

      return res.status(200).json({ profile, fallbackAvatarUrl });
    }

    if (req.method === "PUT") {
      const body = req.body as UpdateProfileBody;
      const walletAddress = await verifySignedRequest(req, res, {
        action: PROFILE_UPDATE_SIGNED_REQUEST_ACTION,
        expectedWalletAddress: address,
      });
      if (!walletAddress) return;

      const profile = await saveProfileMetadata({
        address: walletAddress,
        input: body.profile || {},
      });

      return res.status(200).json({ profile });
    }

    res.setHeader("Allow", "GET, PUT");
    return res.status(405).json({ error: "Method not allowed." });
  } catch (error) {
    console.error("Profile API failed", error);
    return res.status(500).json({
      error:
        error instanceof Error ? error.message : "Unable to update profile.",
    });
  }
}
