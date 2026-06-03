import { viemMainnetClient } from "configs/wallet";
import { normalizeEnsNameInput } from "@/utils/ens";
import { Address, getAddress, isAddress } from "viem";

export interface GetEnsNameReturnType {
  ensName?: string;
}

export async function getEnsName({
  address,
}: {
  address: Address;
}): Promise<GetEnsNameReturnType> {
  try {
    const ensName = await viemMainnetClient.getEnsName({ address });
    return { ensName: ensName ?? undefined };
  } catch (error) {
    console.warn("Unable to resolve ENS name", error);
    return { ensName: undefined };
  }
}

export async function getEnsNamesForAddresses(addresses: string[]) {
  const normalizedAddresses = Array.from(
    new Set(
      addresses
        .filter((address) => isAddress(address))
        .map((address) => getAddress(address))
    )
  );
  const names: Record<string, string> = {};
  const results = await Promise.allSettled(
    normalizedAddresses.map(async (address) => {
      const { ensName } = await getEnsName({ address });
      return [address.toLowerCase(), ensName || ""] as const;
    })
  );

  results.forEach((result) => {
    if (result.status === "fulfilled" && result.value[1]) {
      names[result.value[0]] = result.value[1];
    }
  });

  return names;
}

export interface GetEnsAddressReturnType {
  address?: Address;
}

export async function getEnsAddress({
  ensName,
}: {
  ensName: string;
}): Promise<GetEnsAddressReturnType> {
  const normalizedEnsName = normalizeEnsNameInput(ensName);
  if (!normalizedEnsName) return { address: undefined };

  try {
    const address = await viemMainnetClient.getEnsAddress({
      name: normalizedEnsName,
    });
    return { address: address ?? undefined };
  } catch (error) {
    console.warn("Unable to resolve ENS address", error);
    return { address: undefined };
  }
}

export interface GetEnsAvatarReturnType {
  ensAvatar?: string;
}

export async function getEnsAvatar({
  address,
}: {
  address: Address;
}): Promise<GetEnsAvatarReturnType> {
  try {
    const { ensName } = await getEnsName({ address });
    const ensAvatar = ensName
      ? (await viemMainnetClient.getEnsAvatar({ name: ensName })) ?? undefined
      : undefined;

    return { ensAvatar };
  } catch (error) {
    return { ensAvatar: undefined };
  }
}
