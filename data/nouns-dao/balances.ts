import { BigNumber } from "@/utils/ethers-compat";
import {
  getNounsDaoIndexerPool,
  getNounsDaoIndexerSchema,
} from "data/nouns-dao/indexer";

type NounsBalanceRow = {
  balance: number;
};

export const getNounsDaoBalanceFromIndexer = async (user: string) => {
  const pool = getNounsDaoIndexerPool();
  if (!pool) return undefined;

  const schema = getNounsDaoIndexerSchema();
  const { rows } = await pool.query<NounsBalanceRow>(
    `
      select count(*)::int as balance
      from "${schema}"."nouns"
      where lower(owner) = lower($1)
        and burned is not true
    `,
    [user]
  );

  return BigNumber.from(rows[0]?.balance || 0);
};
