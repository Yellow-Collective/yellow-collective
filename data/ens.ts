import { ENS_MAINNET_RPC_URLS } from "configs/wallet";
import { normalizeEnsNameInput } from "@/utils/ens";
import { providers, utils as ethersUtils } from "ethers";
import { Address, createPublicClient, getAddress, http, isAddress } from "viem";
import { mainnet } from "viem/chains";

const ENS_REGISTRY_ADDRESS = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ensRegistryInterface = new ethersUtils.Interface([
  "function resolver(bytes32 node) view returns (address)",
]);
const ensResolverInterface = new ethersUtils.Interface([
  "function name(bytes32 node) view returns (string)",
]);
const ensMainnetProvider = new providers.FallbackProvider(
  ENS_MAINNET_RPC_URLS.map((rpcUrl, index) => ({
    provider: new providers.StaticJsonRpcProvider(rpcUrl, {
      chainId: 1,
      name: "mainnet",
    }),
    priority: index + 1,
    stallTimeout: 1000,
  })),
  1
);
const ensViemClients = ENS_MAINNET_RPC_URLS.map((rpcUrl) =>
  createPublicClient({
    chain: mainnet,
    transport: http(rpcUrl, { timeout: 4000 }),
  })
);

const resolveEnsAddress = async (ensName: string) => {
  let lastError: unknown;

  for (const client of ensViemClients) {
    try {
      const address = await client.getEnsAddress({ name: ensName });
      if (address && isAddress(address)) return getAddress(address);
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  return undefined;
};

const getRawReverseEnsName = async (address: Address) => {
  const reverseName = `${address.slice(2).toLowerCase()}.addr.reverse`;
  const node = ethersUtils.namehash(reverseName);
  const resolverResponse = await ensMainnetProvider.call({
    to: ENS_REGISTRY_ADDRESS,
    data: ensRegistryInterface.encodeFunctionData("resolver", [node]),
  });
  const [resolverAddress] =
    ensRegistryInterface.decodeFunctionResult("resolver", resolverResponse);

  if (!resolverAddress || resolverAddress === ZERO_ADDRESS) return undefined;

  const nameResponse = await ensMainnetProvider.call({
    to: resolverAddress,
    data: ensResolverInterface.encodeFunctionData("name", [node]),
  });
  const [ensName] = ensResolverInterface.decodeFunctionResult(
    "name",
    nameResponse
  );

  const normalizedEnsName =
    typeof ensName === "string" ? normalizeEnsNameInput(ensName) : undefined;
  if (!normalizedEnsName) return undefined;

  const resolvedAddress = await resolveEnsAddress(normalizedEnsName).catch(
    () => undefined
  );

  return resolvedAddress?.toLowerCase() === address.toLowerCase()
    ? normalizedEnsName
    : undefined;
};

export interface GetEnsNameReturnType {
  ensName?: string;
}

export async function getEnsName({
  address,
}: {
  address: Address;
}): Promise<GetEnsNameReturnType> {
  try {
    const ensName = await ensMainnetProvider.lookupAddress(address);
    return { ensName: ensName ?? undefined };
  } catch {
    try {
      return { ensName: await getRawReverseEnsName(address) };
    } catch (error) {
      console.warn("Unable to resolve ENS name", error);
      return { ensName: undefined };
    }
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
    return { address: await resolveEnsAddress(normalizedEnsName) };
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
      ? (await ensMainnetProvider.getAvatar(ensName)) ?? undefined
      : undefined;

    return { ensAvatar };
  } catch (error) {
    return { ensAvatar: undefined };
  }
}
