import { isAddress } from "viem";
import { normalize } from "viem/ens";

export const normalizeEnsNameInput = (value?: string | null) => {
  const name = value?.trim();

  if (!name || isAddress(name) || !name.includes(".")) return undefined;
  if (/[:/?#\s]/u.test(name)) return undefined;

  try {
    return normalize(name);
  } catch {
    return undefined;
  }
};
