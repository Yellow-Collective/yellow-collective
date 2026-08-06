import Safe from "@safe-global/protocol-kit";
import SafeApiKit from "@safe-global/api-kit";
import { MetaTransactionData } from "@safe-global/safe-core-sdk-types";
import { ethers } from "ethers";
import { config } from "../config";
import { fetchProposalById } from "../listeners/nouns-proposals";
import { SnapshotChoice } from "../types";
import { getProvider } from "../utils/wallet";

const NOUNS_DAO_ABI = [
  "function castRefundableVoteWithReason(uint256 proposalId, uint8 support, string reason, uint32 clientId) returns (uint256)",
  "function getReceipt(uint256 proposalId, address voter) view returns (bool hasVoted, uint8 support, uint96 votes)",
];

const SAFE_EXEC_TRANSACTION_ABI = [
  "function execTransaction(address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, bytes signatures) returns (bool success)",
];

export const SAFE_EXECUTION_GAS_MINIMUM = 300_000n;

export const calculateBufferedGasLimit = (
  estimate: bigint,
  gasBufferPercent: number
) => {
  const bufferPercent = BigInt(Math.max(0, Math.ceil(gasBufferPercent)));
  const bufferedEstimate = (estimate * (100n + bufferPercent) + 99n) / 100n;
  return bufferedEstimate > SAFE_EXECUTION_GAS_MINIMUM
    ? bufferedEstimate
    : SAFE_EXECUTION_GAS_MINIMUM;
};

export const isReceiptSuccessful = (status: unknown) =>
  status === 1 ||
  status === 1n ||
  status === true ||
  status === "1" ||
  status === "0x1" ||
  status === "success";

const SUPPORT_VALUES: Record<SnapshotChoice, 0 | 1 | 2> = {
  FOR: 1,
  AGAINST: 0,
  ABSTAIN: 2,
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type ExecutionResult = {
  executionMode: "safe";
  voterAddress: string;
  safeTxHash: string;
  executionTxHash: string;
  blockNumber: number;
  gasUsed: string;
};

const isProposalVoteable = async (proposalId: string) => {
  const proposal = await fetchProposalById(proposalId);
  if (!proposal) return { voteable: false, status: "NOT_FOUND" };

  if (["CANCELLED", "EXECUTED", "VETOED"].includes(proposal.status)) {
    return { voteable: false, status: proposal.status };
  }

  const provider = getProvider();
  const currentBlock = await provider.getBlockNumber();
  const startBlock = Number(proposal.startBlock);
  const endBlock = Number(proposal.endBlock);

  return {
    proposal,
    voteable: currentBlock >= startBlock && currentBlock <= endBlock,
    status:
      currentBlock < startBlock
        ? "PENDING"
        : currentBlock > endBlock
          ? "ENDED"
          : "ACTIVE",
  };
};

export const getVoteStatus = async (
  proposalId: string,
  voterAddress: string
): Promise<boolean | null> => {
  try {
    const provider = getProvider();
    const nounsDao = new ethers.Contract(
      config.nounsDaoAddress,
      NOUNS_DAO_ABI,
      provider
    );
    const receipt = await nounsDao.getReceipt(proposalId, voterAddress);
    return Boolean(receipt.hasVoted || receipt[0]);
  } catch (error) {
    console.error(
      `Could not read Nouns vote receipt for #${proposalId} and ${voterAddress}`,
      error
    );
    return null;
  }
};

export const hasAlreadyVoted = async (
  proposalId: string,
  voterAddress: string
) => (await getVoteStatus(proposalId, voterAddress)) === true;

export const getConfiguredVoterVoteStatus = async (proposalId: string) =>
  getVoteStatus(proposalId, config.safeAddress);

export const hasConfiguredVoterAlreadyVoted = async (proposalId: string) => {
  if ((await getConfiguredVoterVoteStatus(proposalId)) === true) {
    console.log(`${config.safeAddress} already voted on Nouns #${proposalId}`);
    return true;
  }

  return false;
};

export const executeFinalVote = async (
  proposalId: string,
  voteChoice: SnapshotChoice,
  reason: string
): Promise<ExecutionResult | null> => {
  const { proposal, voteable, status } = await isProposalVoteable(proposalId);
  if (!voteable) {
    console.log(`Cannot vote on Nouns #${proposalId}; status is ${status}`);
    return null;
  }

  if (!proposal) return null;

  const existingVoteStatus = await getVoteStatus(
    proposalId,
    config.safeAddress
  );
  if (existingVoteStatus === null) {
    console.warn(
      `Deferring Nouns #${proposalId}; configured voter receipt could not be read.`
    );
    return null;
  }
  if (existingVoteStatus) {
    console.log(`${config.safeAddress} already voted on Nouns #${proposalId}`);
    return null;
  }

  if (config.dryRun) {
    console.log(
      `[DRY RUN] Would vote ${voteChoice} on Nouns #${proposalId} through Safe ${config.safeAddress}`
    );
    return {
      executionMode: "safe",
      voterAddress: config.safeAddress,
      safeTxHash: `dry-run-safe-${proposalId}`,
      executionTxHash: `dry-run-execution-${proposalId}`,
      blockNumber: 0,
      gasUsed: "0",
    };
  }

  const provider = getProvider();
  const feeData = await provider.getFeeData();
  const maxAllowed = BigInt(config.maxGasPriceGwei) * 10n ** 9n;
  if (feeData.maxFeePerGas && feeData.maxFeePerGas > maxAllowed) {
    console.warn("Gas is above MAX_GAS_PRICE_GWEI; deferring vote.");
    return null;
  }

  for (let attempt = 0; attempt < config.maxRetries; attempt++) {
    if (attempt > 0) await sleep(attempt === 1 ? 30_000 : 120_000);
    const result = await attemptSafeExecution(
      proposalId,
      voteChoice,
      reason,
      attempt === config.maxRetries - 1
        ? Math.max(config.gasBufferPercent, 50)
        : config.gasBufferPercent
    );
    if (result) return result;
  }

  return null;
};

const attemptSafeExecution = async (
  proposalId: string,
  voteChoice: SnapshotChoice,
  reason: string,
  gasBufferPercent: number
): Promise<ExecutionResult | null> => {
  try {
    const protocolKit = await Safe.init({
      provider: config.ethereumRpcUrl,
      signer: config.botPrivateKey,
      safeAddress: config.safeAddress,
    });
    const nounsDao = new ethers.Interface(NOUNS_DAO_ABI);
    const data = nounsDao.encodeFunctionData("castRefundableVoteWithReason", [
      proposalId,
      SUPPORT_VALUES[voteChoice],
      reason,
      config.clientId,
    ]);
    const safeTxData: MetaTransactionData = {
      to: config.nounsDaoAddress,
      value: "0",
      data,
    };
    const safeTx = await protocolKit.createTransaction({
      transactions: [safeTxData],
    });
    const signedTx = await protocolKit.signTransaction(safeTx);
    const safeTxHash = await protocolKit.getTransactionHash(signedTx);
    const safeProvider = protocolKit.getSafeProvider();
    const senderAddress = await safeProvider.getSignerAddress();

    if (!senderAddress) {
      throw new Error("Safe transaction signer address is unavailable");
    }

    const safeInterface = new ethers.Interface(SAFE_EXEC_TRANSACTION_ABI);
    const executionData = safeInterface.encodeFunctionData("execTransaction", [
      signedTx.data.to,
      signedTx.data.value,
      signedTx.data.data,
      signedTx.data.operation,
      signedTx.data.safeTxGas,
      signedTx.data.baseGas,
      signedTx.data.gasPrice,
      signedTx.data.gasToken,
      signedTx.data.refundReceiver,
      signedTx.encodedSignatures(),
    ]);
    const estimatedGas = BigInt(
      await safeProvider.estimateGas({
        from: senderAddress,
        to: config.safeAddress,
        value: "0",
        data: executionData,
      })
    );
    const gasLimit = calculateBufferedGasLimit(
      estimatedGas,
      gasBufferPercent
    );

    if (config.safeApiKey) {
      try {
        const apiKit = new SafeApiKit({
          chainId: BigInt(config.chainId),
          apiKey: config.safeApiKey,
        });
        const senderSignature = Array.from(signedTx.signatures.values())[0]
          ?.data;
        if (senderAddress && senderSignature) {
          await apiKit.proposeTransaction({
            safeAddress: config.safeAddress,
            safeTransactionData: signedTx.data,
            safeTxHash,
            senderAddress,
            senderSignature,
          });
        }
      } catch (error) {
        console.warn("Could not record tx in Safe Transaction Service", error);
      }
    }

    console.log(
      `Executing Safe transaction with estimated gas ${estimatedGas}, ${gasBufferPercent}% buffer, and gas limit ${gasLimit}.`
    );
    const executionResult = await protocolKit.executeTransaction(signedTx, {
      gasLimit,
    });
    const receipt = await (
      executionResult.transactionResponse as {
        wait: (confirms: number) => Promise<ethers.TransactionReceipt>;
      }
    )?.wait(1);
    const executionTxHash = executionResult.hash || receipt?.hash;

    if (!receipt || !isReceiptSuccessful(receipt.status)) {
      console.error(`Safe execution reverted: ${executionTxHash}`);
      return null;
    }

    const confirmedVoteStatus = await getVoteStatus(
      proposalId,
      config.safeAddress
    );
    if (confirmedVoteStatus !== true) {
      console.error(
        `Safe execution was mined, but Nouns Governor does not confirm a vote for #${proposalId}.`
      );
      return null;
    }

    return {
      executionMode: "safe",
      voterAddress: config.safeAddress,
      safeTxHash,
      executionTxHash,
      blockNumber: Number(receipt.blockNumber),
      gasUsed: receipt.gasUsed.toString(),
    };
  } catch (error) {
    console.error("Safe execution attempt failed", error);
    return null;
  }
};
