import {
  saveGalleryCoin,
  validateGalleryCoinInput,
  type GalleryCoinInput,
} from "data/coins";
import type { NextApiRequest, NextApiResponse } from "next";
import { getAddress } from "viem";
import {
  BASE_CHAIN_ID,
  COIN_RECORD_SIGNED_REQUEST_ACTION,
} from "@/utils/coining";
import { verifySignedRequest } from "@/utils/signature-auth-server";

type CreateCoinRecordBody = {
  coin?: Partial<GalleryCoinInput>;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    const body = req.body as CreateCoinRecordBody;
    const coin = body.coin || {};
    validateGalleryCoinInput(coin);

    const ownerAddress = getAddress(coin.ownerAddress || "");
    const walletAddress = await verifySignedRequest(req, res, {
      action: COIN_RECORD_SIGNED_REQUEST_ACTION,
      expectedChainId: BASE_CHAIN_ID,
      expectedWalletAddress: ownerAddress,
      payload: body,
    });
    if (!walletAddress) return;

    const savedCoin = await saveGalleryCoin({
      address: coin.address || "",
      title: coin.title || "",
      coinName: coin.coinName || "",
      symbol: coin.symbol || "",
      description: coin.description || "",
      mediaUrl: coin.mediaUrl || "",
      imageUrl: coin.imageUrl || "",
      ownerAddress: walletAddress,
      payoutRecipient: coin.payoutRecipient || "",
      transactionHash: coin.transactionHash,
      creatorAddress: coin.creatorAddress,
    });

    return res.status(200).json({ coin: savedCoin });
  } catch (error) {
    console.error("Coin record API failed", error);
    return res.status(400).json({
      error: "Unable to save coin.",
    });
  }
}
