import {
  PREVIEW_PROPOSAL_ID,
  type Proposal,
} from "@/services/nouns-builder/governor";
import {
  formatExecutionCountdown,
  getProposalLifecycleAction,
} from "@/utils/proposal-lifecycle";
import { BigNumber, utils } from "@/utils/ethers-compat";
import { getMiniAppEthereumProvider } from "@/utils/farcasterMiniApp";
import { GovernorABI } from "@buildersdk/sdk";
import { TOKEN_NETWORK } from "constants/addresses";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSWRConfig } from "swr";
import {
  useAccount,
  useContractRead,
  useContractWrite,
  useNetwork,
  usePrepareContractWrite,
  useProvider,
  useWaitForTransaction,
} from "wagmi";

const governorInterface = new utils.Interface(GovernorABI as any);

const toSafeNumber = (value: unknown) => {
  if (value === undefined || value === null) return undefined;

  try {
    const parsed = Number(
      typeof value === "object" && "toString" in value
        ? value.toString()
        : value
    );
    return Number.isSafeInteger(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
};

const transactionErrorMessage = (
  error: unknown,
  action: "queue" | "execute"
) => {
  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
      ? String(error.message)
      : "";
  const code =
    typeof error === "object" && error && "code" in error
      ? String(error.code)
      : "";
  const normalizedMessage = rawMessage.toLowerCase();

  if (
    code === "4001" ||
    code === "ACTION_REJECTED" ||
    normalizedMessage.includes("user rejected") ||
    normalizedMessage.includes("user denied")
  ) {
    return "The wallet request was rejected.";
  }

  if (normalizedMessage.includes("revert")) {
    return `The Governor reverted the ${action} transaction. Refresh and try again.`;
  }

  return rawMessage || `Unable to ${action} this proposal.`;
};

export default function ProposalLifecycleAction({
  proposal,
  governorAddress,
  className = "",
  onStateChange,
}: {
  proposal: Proposal;
  governorAddress?: `0x${string}`;
  className?: string;
  onStateChange?: (state: number) => void;
}) {
  const { mutate } = useSWRConfig();
  const { address, isConnected } = useAccount();
  const { chain } = useNetwork();
  const provider = useProvider();
  const isPreview = proposal.proposalId === PREVIEW_PROPOSAL_ID;
  const canReadGovernor = Boolean(governorAddress && !isPreview);
  const proposalListKey = governorAddress
    ? `/api/governor/${governorAddress}/proposals`
    : undefined;
  const [latestBlockTimestamp, setLatestBlockTimestamp] = useState<number>();
  const [blockObservedAt, setBlockObservedAt] = useState<number>();
  const [countdownTick, setCountdownTick] = useState(0);
  const [submittedHash, setSubmittedHash] = useState<`0x${string}`>();
  const [submittingAction, setSubmittingAction] = useState<
    "queue" | "execute"
  >();
  const [actionError, setActionError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const stateRead = useContractRead({
    address: governorAddress,
    abi: GovernorABI,
    functionName: "state",
    args: [proposal.proposalId],
    enabled: canReadGovernor,
    watch: true,
  });
  const etaRead = useContractRead({
    address: governorAddress,
    abi: GovernorABI,
    functionName: "proposalEta",
    args: [proposal.proposalId],
    enabled: canReadGovernor,
    watch: true,
  });
  const directState = toSafeNumber(stateRead.data);
  const proposalEta = toSafeNumber(etaRead.data);

  const refreshLatestBlock = useCallback(async () => {
    const block = await provider.getBlock("latest");
    const timestamp = toSafeNumber(block.timestamp);
    if (timestamp === undefined) {
      throw new Error("Unable to read the latest onchain block timestamp.");
    }

    setLatestBlockTimestamp(timestamp);
    setBlockObservedAt(performance.now());
    return timestamp;
  }, [provider]);

  useEffect(() => {
    if (directState !== undefined) onStateChange?.(directState);
  }, [directState, onStateChange]);

  useEffect(() => {
    if (directState !== 5) return;

    let active = true;
    const updateBlock = async () => {
      try {
        await refreshLatestBlock();
      } catch (error) {
        if (active) {
          console.error("Proposal lifecycle block read failed", {
            proposalId: proposal.proposalId,
            error,
          });
          setActionError("Unable to verify the Governor security delay.");
        }
      }
    };

    void updateBlock();
    const interval = window.setInterval(updateBlock, 4_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [directState, proposal.proposalId, refreshLatestBlock]);

  useEffect(() => {
    if (directState !== 5 || blockObservedAt === undefined) return;

    const interval = window.setInterval(
      () => setCountdownTick(performance.now()),
      1_000
    );
    return () => window.clearInterval(interval);
  }, [blockObservedAt, directState]);

  const lifecycleAction = getProposalLifecycleAction({
    state: directState,
    proposalEta,
    blockTimestamp: latestBlockTimestamp,
    isPreview,
  });
  const executionArgs = [
    proposal.targets,
    proposal.values.map((value) => BigNumber.from(value)),
    proposal.calldatas,
    proposal.descriptionHash,
    proposal.proposal.proposer,
  ] as const;
  const expectedChainId = Number(TOKEN_NETWORK);
  const isWrongNetwork = Boolean(chain && chain.id !== expectedChainId);
  const canPrepare = Boolean(
    governorAddress && address && isConnected && !isWrongNetwork
  );

  const queuePreparation = usePrepareContractWrite({
    address: governorAddress,
    abi: GovernorABI,
    functionName: "queue",
    args: [proposal.proposalId],
    enabled: canPrepare && lifecycleAction === "queue",
  });
  const executePreparation = usePrepareContractWrite({
    address: governorAddress,
    abi: GovernorABI,
    functionName: "execute",
    args: executionArgs,
    enabled: canPrepare && lifecycleAction === "execute",
  });
  const queueWrite = useContractWrite(queuePreparation.config);
  const executeWrite = useContractWrite(executePreparation.config);
  const transaction = useWaitForTransaction({ hash: submittedHash });

  const refreshLifecycle = useCallback(async () => {
    await Promise.all([stateRead.refetch(), etaRead.refetch()]);
    if (directState === 5 || submittingAction === "queue") {
      await refreshLatestBlock();
    }
    if (proposalListKey) await mutate(proposalListKey);
  }, [
    directState,
    etaRead,
    mutate,
    proposalListKey,
    refreshLatestBlock,
    stateRead,
    submittingAction,
  ]);

  useEffect(() => {
    if (!transaction.isSuccess || !submittedHash || !submittingAction) return;

    let active = true;
    const completeTransaction = async () => {
      try {
        await refreshLifecycle();
        if (!active) return;
        setSuccessMessage(
          submittingAction === "queue"
            ? "Proposal queued successfully."
            : "Proposal executed successfully."
        );
      } catch (error) {
        if (!active) return;
        console.error("Proposal lifecycle refresh failed", {
          action: submittingAction,
          proposalId: proposal.proposalId,
          error,
        });
        setActionError(
          "Transaction confirmed, but the updated Governor state could not be loaded."
        );
      } finally {
        if (active) {
          setSubmittedHash(undefined);
          setSubmittingAction(undefined);
        }
      }
    };

    void completeTransaction();
    return () => {
      active = false;
    };
  }, [
    proposal.proposalId,
    refreshLifecycle,
    submittedHash,
    submittingAction,
    transaction.isSuccess,
  ]);

  useEffect(() => {
    if (!transaction.error || !submittingAction) return;

    console.error("Proposal lifecycle transaction failed", {
      action: submittingAction,
      proposalId: proposal.proposalId,
      governorAddress,
      error: transaction.error,
    });
    setActionError(transactionErrorMessage(transaction.error, submittingAction));
    setSubmittedHash(undefined);
    setSubmittingAction(undefined);
  }, [
    governorAddress,
    proposal.proposalId,
    submittingAction,
    transaction.error,
  ]);

  const submitMiniAppTransaction = async (action: "queue" | "execute") => {
    if (!governorAddress || !address) {
      throw new Error("Connect your wallet before submitting this transaction.");
    }

    const miniAppProvider = await getMiniAppEthereumProvider();
    if (!miniAppProvider) {
      const preparationError =
        action === "queue"
          ? queuePreparation.error
          : executePreparation.error;
      throw new Error(
        preparationError?.message ||
          "Transaction preparation failed. Reconnect your wallet and try again."
      );
    }

    const data = governorInterface.encodeFunctionData(action, [
      ...(action === "queue" ? [proposal.proposalId] : executionArgs),
    ]);
    const hash = await miniAppProvider.request({
      method: "eth_sendTransaction",
      params: [{ from: address, to: governorAddress, data }],
    });

    if (typeof hash !== "string" || !/^0x[a-fA-F0-9]{64}$/.test(hash)) {
      throw new Error("Wallet did not return a valid transaction hash.");
    }
    return hash as `0x${string}`;
  };

  const submitTransaction = async (action: "queue" | "execute") => {
    setActionError("");
    setSuccessMessage("");

    if (!isConnected || !address) {
      setActionError("Connect your wallet before submitting this transaction.");
      return;
    }
    if (!chain) {
      setActionError("Unable to verify the connected wallet network.");
      return;
    }
    if (isWrongNetwork) {
      setActionError(
        `Switch your wallet to the configured network (chain ${expectedChainId}).`
      );
      return;
    }

    setSubmittingAction(action);
    try {
      const refreshedState = toSafeNumber((await stateRead.refetch()).data);
      if (
        (action === "queue" && refreshedState !== 4) ||
        (action === "execute" && refreshedState !== 5)
      ) {
        throw new Error("The Governor proposal state changed. Refresh and try again.");
      }

      if (action === "execute") {
        const refreshedEta = toSafeNumber((await etaRead.refetch()).data);
        const refreshedBlockTimestamp = await refreshLatestBlock();
        if (!refreshedEta) {
          throw new Error("The Governor returned missing or invalid ETA data.");
        }
        if (refreshedBlockTimestamp < refreshedEta) {
          throw new Error(
            "The Governor security delay is still active according to the latest block."
          );
        }
      }

      const preparedWrite =
        action === "queue" ? queueWrite.writeAsync : executeWrite.writeAsync;
      const response = preparedWrite
        ? await preparedWrite()
        : { hash: await submitMiniAppTransaction(action) };
      setSubmittedHash(response.hash as `0x${string}`);
    } catch (error) {
      console.error("Proposal lifecycle submission failed", {
        action,
        proposalId: proposal.proposalId,
        governorAddress,
        error,
      });
      setActionError(transactionErrorMessage(error, action));
      setSubmittingAction(undefined);
    }
  };

  const estimatedChainTimestamp = useMemo(() => {
    if (latestBlockTimestamp === undefined || blockObservedAt === undefined) {
      return latestBlockTimestamp;
    }
    const currentTick = countdownTick || performance.now();
    return (
      latestBlockTimestamp +
      Math.max(0, Math.floor((currentTick - blockObservedAt) / 1_000))
    );
  }, [blockObservedAt, countdownTick, latestBlockTimestamp]);
  const isSubmitting = Boolean(
    submittingAction ||
      queueWrite.isLoading ||
      executeWrite.isLoading ||
      transaction.isLoading
  );

  if (isPreview) return null;
  if (stateRead.error) {
    return proposal.state === 4 || proposal.state === 5 ? (
      <p className={`text-sm text-skin-proposal-danger ${className}`}>
        Unable to read the current Governor state.
      </p>
    ) : null;
  }
  if (stateRead.isLoading || directState === undefined) return null;
  if (lifecycleAction === "none" && !successMessage && !actionError) return null;

  if (lifecycleAction === "countdown" || lifecycleAction === "invalid-eta") {
    const countdown =
      lifecycleAction === "countdown" &&
      proposalEta !== undefined &&
      estimatedChainTimestamp !== undefined
        ? formatExecutionCountdown(proposalEta - estimatedChainTimestamp)
        : undefined;

    return (
      <div
        className={`w-full rounded-2xl border border-[#b89400] bg-[#fff7bf] px-4 py-3 text-[#212529] shadow-[0px_4.02px_0px_0px_#b89400] sm:w-auto ${className}`}
      >
        <p className="font-heading text-base font-bold">Proposal queued</p>
        <p className="mt-1 text-sm" aria-live="polite">
          {etaRead.isLoading
            ? "Loading Governor security delay…"
            : countdown
            ? `Execution available in ${countdown}`
            : "The Governor returned missing or invalid ETA data."}
        </p>
        {successMessage && <p className="mt-1 text-sm">{successMessage}</p>}
        {actionError && (
          <p className="mt-1 text-sm text-skin-proposal-danger">{actionError}</p>
        )}
      </div>
    );
  }

  const isQueueAction = lifecycleAction === "queue";
  const buttonLabel = isSubmitting
    ? isQueueAction
      ? "Queueing…"
      : "Executing…"
    : isQueueAction
    ? "Queue proposal"
    : "Execute proposal";

  return (
    <div className={`w-full sm:w-auto ${className}`}>
      <button
        type="button"
        disabled={isSubmitting}
        onClick={() => void submitTransaction(isQueueAction ? "queue" : "execute")}
        className={`w-full rounded-[18px] px-4 py-3 font-heading text-base font-bold text-white transition enabled:hover:-translate-y-0.5 enabled:hover:shadow-[0px_6px_0px_0px_var(--lifecycle-shadow)] enabled:active:translate-y-1 enabled:active:shadow-none disabled:cursor-not-allowed disabled:opacity-70 disabled:shadow-none sm:w-auto ${
          isQueueAction
            ? "yc-dark-submit-blue bg-[#1d9bf0] shadow-[0px_4.02px_0px_0px_#0f5f99] [--lifecycle-shadow:#0f5f99] hover:bg-[#45adf5]"
            : "bg-skin-proposal-success shadow-[0px_4.02px_0px_0px_#087a3f] [--lifecycle-shadow:#087a3f] hover:bg-[#13bf62]"
        }`}
      >
        {buttonLabel}
      </button>
      <p className="mt-2 text-xs text-skin-muted">
        This function sends a transaction.
      </p>
      {successMessage && (
        <p className="mt-2 text-sm text-skin-proposal-success" role="status">
          {successMessage}
        </p>
      )}
      {actionError && (
        <p className="mt-2 text-sm text-skin-proposal-danger" role="alert">
          {actionError}
        </p>
      )}
    </div>
  );
}
