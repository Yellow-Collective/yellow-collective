import { ethers } from "ethers";
import { config } from "../config";

const jsonRpcProvider = (rpcUrl: string, chainId: number, name: string) =>
  new ethers.JsonRpcProvider(
    rpcUrl,
    {
      chainId,
      name,
    },
    {
      batchMaxCount: 1,
      staticNetwork: true,
    }
  );

export const getProvider = () =>
  jsonRpcProvider(config.ethereumRpcUrl, config.chainId, "mainnet");

export const getSnapshotProvider = () =>
  jsonRpcProvider(
    config.snapshotRpcUrl,
    config.snapshotChainId,
    `snapshot-${config.snapshotChainId}`
  );

export const getBotWallet = () =>
  new ethers.Wallet(config.botPrivateKey, getProvider());

export const getWalletAddress = async () => getBotWallet().getAddress();

export const getCurrentSnapshotBlockNumber = async () =>
  getSnapshotProvider().getBlockNumber();

const parseRpcChainId = (chainId: unknown) => {
  if (typeof chainId === "string") {
    return chainId.startsWith("0x") ? Number(BigInt(chainId)) : Number(chainId);
  }

  if (typeof chainId === "number") return chainId;

  return Number.NaN;
};

export const validateRpcEndpoint = async () => {
  try {
    const blockNumber = await getProvider().getBlockNumber();
    if (!Number.isInteger(blockNumber) || blockNumber <= 0) {
      throw new Error(`Unexpected block number: ${blockNumber}`);
    }
    return blockNumber;
  } catch (error) {
    const detail =
      error instanceof Error ? ` ${error.message}` : " Unknown RPC error.";
    throw new Error(
      `ETHEREUM_RPC_URL is not a working Ethereum mainnet JSON-RPC endpoint: ${config.ethereumRpcUrl}.${detail}`
    );
  }
};

export const validateSnapshotRpcEndpoint = async () => {
  try {
    const provider = getSnapshotProvider();
    const rpcChainId = parseRpcChainId(await provider.send("eth_chainId", []));
    if (rpcChainId !== config.snapshotChainId) {
      throw new Error(
        `Expected chain ${config.snapshotChainId}, got ${rpcChainId}.`
      );
    }

    const blockNumber = await provider.getBlockNumber();
    if (!Number.isInteger(blockNumber) || blockNumber <= 0) {
      throw new Error(`Unexpected block number: ${blockNumber}`);
    }
    return blockNumber;
  } catch (error) {
    const detail =
      error instanceof Error ? ` ${error.message}` : " Unknown RPC error.";
    throw new Error(
      `SNAPSHOT_RPC_URL is not a working chain ${config.snapshotChainId} JSON-RPC endpoint: ${config.snapshotRpcUrl}.${detail}`
    );
  }
};
