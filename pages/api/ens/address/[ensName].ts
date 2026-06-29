import { getEnsAddress } from "data/ens";
import { NextApiRequest, NextApiResponse } from "next";
import { applyRateLimit } from "@/utils/rate-limit";

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (
    !applyRateLimit(req, res, {
      keyPrefix: "ens-address",
      limit: 60,
      windowMs: 60 * 1000,
    })
  ) {
    return;
  }

  const { ensName } = req.query;
  const requestedEnsName = Array.isArray(ensName) ? ensName[0] : ensName;

  if (!requestedEnsName) {
    res.status(400).json({ error: "Invalid ENS name" });
    return;
  }

  const address = await getEnsAddress({ ensName: requestedEnsName });
  const ONE_DAY_IN_SECONDS = 60 * 60 * 24;
  res.setHeader(
    "Cache-Control",
    address.address
      ? `s-maxage=${ONE_DAY_IN_SECONDS}, stale-while-revalidate=${ONE_DAY_IN_SECONDS}`
      : "s-maxage=60, stale-while-revalidate=300"
  );
  res.status(200).json(address);
};

export default handler;
