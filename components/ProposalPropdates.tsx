import WalletIdentityLink from "@/components/WalletIdentityLink";
import { TOKEN_CONTRACT, TOKEN_NETWORK } from "constants/addresses";
import { ETHERSCAN_BASEURL } from "constants/urls";
import { BigNumber, ethers } from "@/utils/ethers-compat";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useEffect, useMemo, useState } from "react";
import { getAddress, isAddress, zeroHash } from "viem";
import {
  useContractWrite,
  usePrepareContractWrite,
  useWaitForTransaction,
} from "wagmi";
import useSWR from "swr";

export type Propdate = {
  id: string;
  creator: string;
  proposalId: string;
  originalMessageId: string;
  message: string;
  txid: string;
  timeCreated: number;
};

const PROPDATE_SCHEMA_UID =
  "0x8bd0d42901ce3cd9898dbea6ae2fbf1e796ef0923e7cbb0a1cecac2e42d47cb3";
const EAS_CONTRACT_ADDRESS: Partial<Record<string, `0x${string}`>> = {
  "1": "0xA1207F3BBa224E2c9c3c6D5aF63D0eb1582Ce587",
  "8453": "0x4200000000000000000000000000000000000021",
  "84531": "0x4200000000000000000000000000000000000021",
};
const INLINE_TEXT_MESSAGE_TYPE = 0;

const easAbi = [
  {
    inputs: [
      {
        components: [
          { internalType: "bytes32", name: "schema", type: "bytes32" },
          {
            components: [
              { internalType: "address", name: "recipient", type: "address" },
              {
                internalType: "uint64",
                name: "expirationTime",
                type: "uint64",
              },
              { internalType: "bool", name: "revocable", type: "bool" },
              { internalType: "bytes32", name: "refUID", type: "bytes32" },
              { internalType: "bytes", name: "data", type: "bytes" },
              { internalType: "uint256", name: "value", type: "uint256" },
            ],
            internalType: "struct AttestationRequestData",
            name: "data",
            type: "tuple",
          },
        ],
        internalType: "struct AttestationRequest",
        name: "request",
        type: "tuple",
      },
    ],
    name: "attest",
    outputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
    stateMutability: "payable",
    type: "function",
  },
] as const;

const isBytes32 = (value?: string) =>
  Boolean(value && /^0x[a-fA-F0-9]{64}$/.test(value));

const formatTime = (timestamp: number) =>
  new Date(timestamp * 1000).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export default function ProposalPropdates({
  proposalId,
  tokenAddress = TOKEN_CONTRACT,
}: {
  proposalId: string;
  tokenAddress?: string;
}) {
  const [showForm, setShowForm] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Propdate | undefined>();
  const canUsePropdates = isBytes32(proposalId) && isAddress(tokenAddress);
  const { data, isLoading, mutate } = useSWR<Propdate[]>(
    canUsePropdates ? `/api/propdates/${proposalId}` : undefined,
    { refreshInterval: 5000 }
  );
  const topLevelPropdates = useMemo(
    () =>
      [...(data || [])]
        .filter(
          (propdate) =>
            !propdate.originalMessageId ||
            propdate.originalMessageId.toLowerCase() === zeroHash
        )
        .sort((a, b) => b.timeCreated - a.timeCreated),
    [data]
  );

  const closeForm = () => {
    setShowForm(false);
    setReplyingTo(undefined);
  };

  const handleSuccess = () => {
    closeForm();
    mutate();
  };

  return (
    <section className="yc-dark-yellow-surface rounded-b-2xl border border-skin-stroke bg-white p-6 shadow-sm sm:rounded-t-2xl md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-2xl font-heading text-skin-base font-bold">
          Propdates
        </div>
        <button
          type="button"
          disabled={!canUsePropdates}
          onClick={() => {
            setShowForm((current) => !current);
            setReplyingTo(undefined);
          }}
          className="yc-dark-force-white flex w-full items-center justify-center rounded-[18px] bg-accent px-5 py-3 font-heading text-lg text-skin-base shadow-[0px_4.02px_0px_0px_#b89400] transition enabled:hover:-translate-y-0.5 enabled:hover:bg-[#ffd84d] enabled:hover:shadow-[0px_6px_0px_0px_#b89400] enabled:active:translate-y-1 enabled:active:shadow-none disabled:bg-skin-button-muted disabled:text-skin-inverted disabled:shadow-none sm:w-auto"
        >
          {showForm && !replyingTo ? "Cancel" : "Create Propdate"}
        </button>
      </div>

      {!canUsePropdates && (
        <p className="mt-4 rounded-xl border border-skin-stroke bg-skin-muted p-4 text-base text-secondary">
          Propdates are only available for Builder proposal ids indexed by EAS.
        </p>
      )}

      {showForm && canUsePropdates && (
        <PropdateForm
          proposalId={proposalId as `0x${string}`}
          tokenAddress={getAddress(tokenAddress) as `0x${string}`}
          replyTo={replyingTo}
          closeForm={closeForm}
          onSuccess={handleSuccess}
        />
      )}

      {isLoading && (
        <p className="mt-4 text-base text-secondary">Loading propdates...</p>
      )}

      {topLevelPropdates.length > 0 && (
        <div className="mt-6 flex flex-col gap-4">
          {topLevelPropdates.map((propdate) => {
            const replies = [...(data || [])]
              .filter(
                (reply) =>
                  reply.originalMessageId === propdate.txid ||
                  reply.originalMessageId === propdate.id
              )
              .sort((a, b) => a.timeCreated - b.timeCreated);

            return (
              <PropdateCard
                key={propdate.id}
                propdate={propdate}
                replies={replies}
                isReplying={replyingTo?.id === propdate.id}
                onReplyClick={() => {
                  if (replyingTo?.id === propdate.id) {
                    closeForm();
                  } else {
                    setReplyingTo(propdate);
                    setShowForm(true);
                  }
                }}
              />
            );
          })}
        </div>
      )}

      {canUsePropdates && !isLoading && topLevelPropdates.length === 0 && (
        <p className="mt-4 rounded-xl border border-skin-stroke bg-skin-muted p-4 text-base text-secondary">
          No updates on this proposal yet.
        </p>
      )}
    </section>
  );
}

const PropdateForm = ({
  proposalId,
  tokenAddress,
  replyTo,
  closeForm,
  onSuccess,
}: {
  proposalId: `0x${string}`;
  tokenAddress: `0x${string}`;
  replyTo?: Propdate;
  closeForm: () => void;
  onSuccess: () => void;
}) => {
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const easContractAddress = EAS_CONTRACT_ADDRESS[TOKEN_NETWORK];
  const encodedData = useMemo(
    () =>
      ethers.utils.defaultAbiCoder.encode(
        ["bytes32", "bytes32", "uint8", "string"],
        [
          proposalId,
          replyTo?.id || zeroHash,
          INLINE_TEXT_MESSAGE_TYPE,
          message.trim(),
        ]
      ),
    [message, proposalId, replyTo?.id]
  );
  const enabled = Boolean(
    easContractAddress && tokenAddress && message.trim().length > 0
  );
  const { config, error: prepareError } = usePrepareContractWrite({
    address: easContractAddress,
    abi: easAbi,
    functionName: "attest",
    args: [
      {
        schema: PROPDATE_SCHEMA_UID,
        data: {
          recipient: tokenAddress,
          expirationTime: 0n,
          revocable: true,
          refUID: zeroHash,
          data: encodedData as `0x${string}`,
          value: 0n,
        },
      },
    ],
    overrides: { value: 0n },
    enabled,
  });
  const { write, data, isLoading: writeLoading } = useContractWrite(config);
  const { isLoading: txLoading, isSuccess } = useWaitForTransaction({
    hash: data?.hash,
  });

  useEffect(() => {
    if (isSuccess) onSuccess();
  }, [isSuccess, onSuccess]);

  return (
    <div className="mt-6 rounded-2xl border border-skin-stroke bg-white p-4">
      {replyTo && (
        <div className="mb-4 rounded-xl border border-skin-stroke bg-skin-muted p-3">
          <div className="font-heading text-sm font-bold text-skin-base">
            Replying to
          </div>
          <p className="mt-1 max-h-20 overflow-hidden text-sm text-secondary">
            {replyTo.message}
          </p>
        </div>
      )}
      <label className="font-heading text-sm font-bold text-skin-base">
        Message
      </label>
      <textarea
        value={message}
        onChange={(event) => {
          setMessage(event.target.value);
          setErrorMessage("");
        }}
        rows={5}
        className="mt-2 w-full resize-none rounded-xl border border-skin-stroke bg-white px-4 py-3 text-base text-skin-base shadow-sm placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-skin-highlighted"
        placeholder="Share an update on this proposal"
      />
      {(errorMessage || prepareError) && (
        <p className="mt-3 text-sm text-skin-proposal-danger">
          {errorMessage ||
            prepareError?.message ||
            "Unable to prepare propdate transaction."}
        </p>
      )}
      <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={closeForm}
          className="rounded-xl border border-skin-stroke bg-white px-5 py-3 font-heading font-bold text-skin-base transition hover:bg-[#fff7bf]"
        >
          {replyTo ? "Cancel reply" : "Reset"}
        </button>
        <button
          type="button"
          disabled={!enabled || !write || writeLoading || txLoading}
          onClick={() => {
            if (!write) {
              setErrorMessage("Connect a wallet to submit a propdate.");
              return;
            }
            write();
          }}
          className="rounded-[18px] bg-accent px-5 py-3 font-heading font-bold text-skin-base shadow-[0px_4.02px_0px_0px_#b89400] transition enabled:hover:-translate-y-0.5 enabled:hover:bg-[#ffd84d] enabled:hover:shadow-[0px_6px_0px_0px_#b89400] enabled:active:translate-y-1 enabled:active:shadow-none disabled:bg-skin-button-muted disabled:text-skin-inverted disabled:shadow-none"
        >
          {writeLoading || txLoading ? "Submitting..." : "Submit Propdate"}
        </button>
      </div>
    </div>
  );
};

const PropdateCard = ({
  propdate,
  replies,
  isReplying,
  onReplyClick,
}: {
  propdate: Propdate;
  replies: Propdate[];
  isReplying: boolean;
  onReplyClick: () => void;
}) => (
  <div className="rounded-2xl border border-skin-stroke bg-white p-4">
    <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
      <PropdateCreator address={propdate.creator} />
      <Link
        href={`${ETHERSCAN_BASEURL}/tx/${propdate.txid}`}
        rel="noopener noreferrer"
        target="_blank"
        className="text-sm text-secondary transition hover:text-skin-base"
      >
        {formatTime(propdate.timeCreated)}
      </Link>
    </div>
    <div className="prose prose-skin mt-4 max-w-none rounded-xl bg-skin-muted p-4">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {propdate.message}
      </ReactMarkdown>
    </div>
    {replies.length > 0 && (
      <div className="mt-4 border-l-4 border-skin-stroke pl-4">
        {replies.map((reply) => (
          <div key={reply.id} className="mb-3 rounded-xl bg-skin-muted p-3">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
              <PropdateCreator address={reply.creator} />
              <Link
                href={`${ETHERSCAN_BASEURL}/tx/${reply.txid}`}
                rel="noopener noreferrer"
                target="_blank"
                className="text-sm text-secondary transition hover:text-skin-base"
              >
                {formatTime(reply.timeCreated)}
              </Link>
            </div>
            <div className="prose prose-skin mt-2 max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {reply.message}
              </ReactMarkdown>
            </div>
          </div>
        ))}
      </div>
    )}
    <div className="mt-4 flex justify-end">
      <button
        type="button"
        onClick={onReplyClick}
        className="rounded-xl border border-skin-stroke bg-white px-4 py-2 font-heading font-bold text-skin-base transition hover:bg-[#fff7bf]"
      >
        {isReplying ? "Cancel Reply" : "Reply"}
      </button>
    </div>
  </div>
);

const PropdateCreator = ({ address }: { address: string }) => {
  const normalizedAddress = isAddress(address)
    ? getAddress(address)
    : undefined;

  return normalizedAddress ? (
    <WalletIdentityLink
      address={normalizedAddress}
      className="font-heading text-base font-bold text-skin-base transition hover:text-skin-highlighted"
    />
  ) : (
    <span className="font-heading text-base font-bold text-skin-base">
      {address}
    </span>
  );
};
