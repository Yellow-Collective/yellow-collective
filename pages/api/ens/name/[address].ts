import { publicApiRead } from "@/utils/public-api-read";
import { NextApiRequest, NextApiResponse } from "next";
import { getEnsName } from "data/ens";
import { getAddress, isAddress } from "viem";

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { address } = req.query;
  const requestedAddress = Array.isArray(address) ? address[0] : address;

  if (!requestedAddress || !isAddress(requestedAddress)) {
    res.status(400).json({ error: "Invalid address" });
    return;
  }

  const ONE_DAY_IN_SECONDS = 60 * 60 * 24;
  const ensName = await getEnsName({ address: getAddress(requestedAddress) });
  res.setHeader(
    "Cache-Control",
    ensName.ensName
      ? `s-maxage=${ONE_DAY_IN_SECONDS}, stale-while-revalidate=${ONE_DAY_IN_SECONDS}`
      : "s-maxage=60, stale-while-revalidate=300"
  );
  res.send(ensName);
};

export default publicApiRead(handler);
