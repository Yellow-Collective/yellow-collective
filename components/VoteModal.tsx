import {
  PREVIEW_PROPOSAL_ID,
  Proposal,
} from "@/services/nouns-builder/governor";
import { TOKEN_CONTRACT } from "constants/addresses";
import {
  useAccount,
  useContractWrite,
  usePrepareContractWrite,
  useWaitForTransaction,
} from "wagmi";
import { useDAOAddresses } from "../hooks";
import { GovernorABI } from "@buildersdk/sdk";
import { BigNumber, utils } from "@/utils/ethers-compat";
import { useState } from "react";
import Image from "next/image";
import { CheckIcon, MinusIcon, XMarkIcon } from "@heroicons/react/20/solid";
import { getProposalName } from "@/utils/getProposalName";
import { getMiniAppEthereumProvider } from "@/utils/farcasterMiniApp";

const governorInterface = new utils.Interface(GovernorABI as any);

export default function VoteModal({
  proposal,
  proposalNumber,
  setOpen,
}: {
  proposal: Proposal;
  proposalNumber: number;
  setOpen: (value: boolean) => void;
}) {
  const { address } = useAccount();
  const isPreviewProposal = proposal.proposalId === PREVIEW_PROPOSAL_ID;
  const { data: addresses } = useDAOAddresses({
    tokenContract: TOKEN_CONTRACT,
  });
  const [support, setSupport] = useState<0 | 1 | 2 | undefined>();
  const [reason, setReason] = useState("");
  const [miniAppTxHash, setMiniAppTxHash] = useState<`0x${string}`>();
  const [fallbackLoading, setFallbackLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const trimmedReason = reason.trim();
  const hasReason = trimmedReason.length > 0;
  const shouldPrepare = Boolean(
    addresses?.governor && support !== undefined && !isPreviewProposal
  );
  const { config: castVoteConfig } = usePrepareContractWrite({
    address: addresses?.governor,
    abi: GovernorABI,
    functionName: "castVote",
    args: [proposal.proposalId, BigNumber.from(support ?? 0)],
    enabled: shouldPrepare && !hasReason,
  });
  const { config: castVoteWithReasonConfig } = usePrepareContractWrite({
    address: addresses?.governor,
    abi: GovernorABI,
    functionName: "castVoteWithReason",
    args: [proposal.proposalId, BigNumber.from(support ?? 0), trimmedReason],
    enabled: shouldPrepare && hasReason,
  });
  const castVoteWrite = useContractWrite(castVoteConfig);
  const castVoteWithReasonWrite = useContractWrite(castVoteWithReasonConfig);
  const activeWrite = hasReason ? castVoteWithReasonWrite : castVoteWrite;
  const { write, data, isLoading: writeLoading } = activeWrite;
  const { isLoading: txLoading, isSuccess: txSuccess } = useWaitForTransaction({
    hash: data?.hash || miniAppTxHash,
  });
  const selectedVote = voteOptions.find((option) => option.value === support);
  const proposalTitle = getProposalName(proposal.description);
  const isSubmitting = writeLoading || txLoading || fallbackLoading;
  const canSubmit = Boolean(
    support !== undefined &&
      (isPreviewProposal || write || address) &&
      !txSuccess
  );

  const submitMiniAppVote = async () => {
    if (!addresses?.governor || !address || support === undefined) {
      throw new Error("Connect your wallet before submitting a vote.");
    }

    const provider = await getMiniAppEthereumProvider();
    if (!provider) {
      throw new Error("Wallet transaction is not ready. Reconnect and try again.");
    }

    const data = hasReason
      ? governorInterface.encodeFunctionData("castVoteWithReason", [
          proposal.proposalId,
          support,
          trimmedReason,
        ])
      : governorInterface.encodeFunctionData("castVote", [
          proposal.proposalId,
          support,
        ]);

    const hash = await provider.request({
      method: "eth_sendTransaction",
      params: [
        {
          from: address,
          to: addresses.governor,
          data,
        },
      ],
    });

    if (typeof hash !== "string" || !hash.startsWith("0x")) {
      throw new Error("Wallet did not return a transaction hash.");
    }

    setMiniAppTxHash(hash as `0x${string}`);
  };

  const submitVote = async () => {
    setSubmitError("");

    if (isPreviewProposal) return;
    if (write) {
      write();
      return;
    }

    setFallbackLoading(true);
    try {
      await submitMiniAppVote();
    } catch (error) {
      console.error("Mini App vote failed", error);
      setSubmitError(
        error instanceof Error ? error.message : "Unable to submit vote."
      );
    } finally {
      setFallbackLoading(false);
    }
  };

  return (
    <div className="relative rounded-2xl bg-skin-backdrop p-1 text-skin-base">
      <div className="absolute top-0 right-0">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full p-1 transition hover:bg-[#fff7bf]"
          aria-label="Close vote modal"
        >
          <XMarkIcon className="h-5" />
        </button>
      </div>

      <div className="pr-8">
        <div className="font-heading text-2xl font-bold leading-none">
          Submit vote
        </div>
        <div className="mt-2 font-heading text-sm font-bold text-secondary">
          Proposal {proposalNumber} {proposalTitle}
        </div>
      </div>

      <div className="yc-vote-options-panel mt-6 rounded-xl border border-skin-stroke bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3">
          {voteOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setSupport(option.value)}
              className={`rounded-[22px] border-0 px-5 py-5 text-left font-heading font-bold shadow-[0px_6px_0px_0px_var(--vote-shadow)] transition hover:-translate-y-0.5 hover:shadow-[0px_8px_0px_0px_var(--vote-shadow)] active:translate-y-1 active:shadow-[0px_2px_0px_0px_var(--vote-shadow)] ${option.buttonClassName}`}
              style={
                {
                  "--vote-shadow": option.shadowColor,
                } as React.CSSProperties
              }
            >
              <div className="flex items-center justify-between gap-4">
                <span className="font-heading text-2xl font-bold leading-none text-white">
                  {option.label}
                </span>
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full border-2 bg-white font-heading text-xl leading-none shadow-sm ${
                    support === option.value
                      ? `border-white ${option.selectedIconClassName}`
                      : "border-skin-stroke bg-white"
                  }`}
                >
                  {support === option.value ? option.selectedIcon : ""}
                </span>
              </div>
              <div className="mt-3 font-heading text-base font-bold leading-snug text-white/90">
                {option.description}
              </div>
            </button>
          ))}
        </div>
      </div>

      <label className="mt-5 block font-heading text-sm font-bold text-skin-base">
        Reason
      </label>
      <textarea
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Optional reason for your vote"
        rows={4}
        className="yc-vote-reason-textarea mt-2 w-full resize-none rounded-xl border border-skin-stroke bg-white px-4 py-3 text-base text-[#212529] shadow-sm placeholder:text-[#454a4e] focus:outline-none focus:ring-2 focus:ring-skin-highlighted"
      />

      {submitError && (
        <div className="mt-4 rounded-xl border border-skin-proposal-danger bg-white p-3 text-sm text-skin-proposal-danger">
          {submitError}
        </div>
      )}

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="yc-force-white-yellow-hover h-12 flex-1 rounded-xl border border-skin-stroke bg-white font-heading text-base font-bold text-[#212529] transition hover:bg-[#fff7bf]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submitVote}
          disabled={!canSubmit || isSubmitting || txSuccess}
          className={`h-12 flex-1 rounded-[18px] px-4 font-heading text-base font-bold shadow-[0px_4.02px_0px_0px_rgb(var(--color-shadow-accent))] transition enabled:hover:-translate-y-0.5 enabled:hover:shadow-[0px_6px_0px_0px_rgb(var(--color-shadow-accent))] enabled:active:translate-y-1 enabled:active:shadow-none disabled:shadow-none ${
            canSubmit && !isSubmitting && !txSuccess
              ? "yc-dark-submit-blue bg-[#1d9bf0] text-white shadow-[0px_4.02px_0px_0px_#0f5f99] hover:bg-[#45adf5] enabled:hover:shadow-[0px_6px_0px_0px_#0f5f99]"
              : "bg-skin-button-muted text-[#212529]"
          }`}
        >
          {isPreviewProposal ? (
            selectedVote ? (
              `Preview ${selectedVote.label}`
            ) : (
              "Select vote"
            )
          ) : txSuccess ? (
            "Vote submitted"
          ) : isSubmitting ? (
            <span className="flex justify-center">
              <Image
                src={"/spinner.svg"}
                alt="spinner"
                width={20}
                height={20}
              />
            </span>
          ) : selectedVote ? (
            `Submit ${selectedVote.label}`
          ) : (
            "Select vote"
          )}
        </button>
      </div>
    </div>
  );
}

const voteOptions: Array<{
  value: 0 | 1 | 2;
  label: string;
  description: string;
  buttonClassName: string;
  shadowColor: string;
  selectedIcon: JSX.Element;
  selectedIconClassName: string;
}> = [
  {
    value: 1,
    label: "For",
    description: "Support this proposal.",
    buttonClassName: "bg-skin-proposal-success hover:bg-[#13bf62]",
    shadowColor: "#087a3f",
    selectedIcon: <CheckIcon className="h-5 w-5" />,
    selectedIconClassName: "text-skin-proposal-success",
  },
  {
    value: 0,
    label: "Against",
    description: "Vote against this proposal.",
    buttonClassName: "bg-skin-proposal-danger hover:bg-[#f43a35]",
    shadowColor: "#a90f0c",
    selectedIcon: <XMarkIcon className="h-5 w-5" />,
    selectedIconClassName: "text-skin-proposal-danger",
  },
  {
    value: 2,
    label: "Abstain",
    description: "Participate without voting for or against.",
    buttonClassName: "bg-skin-proposal-muted hover:bg-[#8a8a8a]",
    shadowColor: "#4f4f4f",
    selectedIcon: <MinusIcon className="h-5 w-5" />,
    selectedIconClassName: "text-skin-proposal-muted",
  },
];
