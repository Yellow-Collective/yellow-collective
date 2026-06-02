import { NextApiRequest, NextApiResponse } from "next";
import { getMainnetBalanceOf } from "data/nouns-builder/token";
import { getNounsDaoBalanceFromIndexer } from "data/nouns-dao/balances";
import { NOUNS_TOKEN_CONTRACT } from "constants/addresses";
import { utils } from "@/utils/ethers-compat";

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { user } = req.query;
  const address = Array.isArray(user) ? user[0] : user;

  if (!address || !utils.isAddress(address)) {
    res.status(400).json({ error: "Invalid address" });
    return;
  }

  let balance: { toString: () => string } | undefined =
    await getNounsDaoBalanceFromIndexer(address).catch((error) => {
    console.warn("Unable to load Nouns balance from indexer", error);
    return undefined;
    });

  if (balance === undefined) {
    balance = await getMainnetBalanceOf({
      address: NOUNS_TOKEN_CONTRACT as "0x${string}",
      user: address as "0x${string}",
    });
  }

  if (balance === undefined) {
    res.status(502).json({ error: "Unable to load Nouns balance" });
    return;
  }

  const ONE_DAY_IN_SECONDS = 60 * 60 * 24;
  res.setHeader(
    "Cache-Control",
    `s-maxage=60, stale-while-revalidate=${ONE_DAY_IN_SECONDS}`
  );
  res.status(200).json(balance.toString());
};

export default handler;
