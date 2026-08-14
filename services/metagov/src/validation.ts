import fs from "fs";
import path from "path";
import Safe from "@safe-global/protocol-kit";
import { ethers } from "ethers";
import { config, validateConfig } from "./config";
import { graphqlRequest } from "./utils/http";
import {
  getBotWallet,
  getProvider,
  validateRpcEndpoint,
  validateSnapshotRpcEndpoint,
} from "./utils/wallet";

const SPACE_QUERY = `
  query Space($id: String!) {
    space(id: $id) {
      id
      name
      network
    }
  }
`;

const NOUNS_TOKEN_ABI = [
  "function getCurrentVotes(address account) view returns (uint96)",
];

const validateSafeRuntime = async () => {
  if (!config.safeAddress) {
    throw new Error("Missing SAFE_ADDRESS.");
  }

  const wallet = getBotWallet();
  const protocolKit = await Safe.init({
    provider: config.ethereumRpcUrl,
    signer: config.botPrivateKey,
    safeAddress: config.safeAddress,
  });
  const owners = await protocolKit.getOwners();
  const threshold = await protocolKit.getThreshold();
  const walletAddress = wallet.address.toLowerCase();

  if (!owners.some((owner: string) => owner.toLowerCase() === walletAddress)) {
    const message = `Bot wallet ${wallet.address} is not an owner of Safe ${config.safeAddress}.`;
    throw new Error(message);
  }

  if (threshold !== 1) {
    const message = `Safe threshold is ${threshold}; unattended Safe execution requires threshold 1.`;
    throw new Error(message);
  }
};

const validateCurrentVotes = async (
  label: string,
  address: string,
  provider: ethers.Provider
) => {
  try {
    const nounsToken = new ethers.Contract(
      config.nounsTokenAddress,
      NOUNS_TOKEN_ABI,
      provider
    );
    const votes = await nounsToken.getCurrentVotes(address);
    if (votes === 0n) {
      console.warn(
        `${label} currently has 0 Nouns current votes. Final votes will still execute through the Safe and may be zero-weight on-chain votes.`
      );
    } else {
      console.log(`${label} has ${votes.toString()} Nouns current votes.`);
    }
  } catch (error) {
    console.warn(`Unable to validate ${label} Nouns voting power at startup.`, error);
  }
};

export const validateRuntime = async () => {
  validateConfig();

  fs.mkdirSync(config.dataDir, { recursive: true });
  const probePath = path.join(config.dataDir, ".write-test");
  fs.writeFileSync(probePath, "ok");
  fs.rmSync(probePath, { force: true });

  const provider = getProvider();
  const blockNumber = await validateRpcEndpoint();
  console.log(`Connected to Ethereum mainnet RPC at block ${blockNumber}`);

  const snapshotBlockNumber = await validateSnapshotRpcEndpoint();
  console.log(
    `Connected to Snapshot RPC chain ${config.snapshotChainId} at block ${snapshotBlockNumber}`
  );

  await validateSafeRuntime();

  await validateCurrentVotes("Safe", config.safeAddress, provider);

  const snapshotSpace = await graphqlRequest<{
    space?: { id: string; network?: string | null } | null;
  }>(
    config.snapshotGraphql,
    SPACE_QUERY,
    { id: config.snapshotSpaceId }
  );

  const spaceNetwork = snapshotSpace.space?.network;
  if (spaceNetwork && spaceNetwork !== String(config.snapshotChainId)) {
    throw new Error(
      `Snapshot space ${config.snapshotSpaceId} is on chain ${spaceNetwork}, but SNAPSHOT_CHAIN_ID is ${config.snapshotChainId}.`
    );
  }
};
