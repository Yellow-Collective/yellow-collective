import AddressLink from "@/components/AddressLink";
import { ETHER_ACTOR_BASEURL } from "constants/urls";
import { BigNumber, ethers } from "@/utils/ethers-compat";
import useSWR from "swr";

export type ProposalTransactionItem = {
  target: string;
  value: string | number;
  calldata?: string;
  signature?: string;
};

type EtherActorResponse = {
  name: string;
  decoded: string[];
  functionName: string;
  isVerified: boolean;
};

export default function ProposalTransactions({
  transactions,
  className = "",
}: {
  transactions: ProposalTransactionItem[];
  className?: string;
}) {
  return (
    <section
      className={`${className} rounded-2xl border border-skin-stroke bg-accent p-6 text-[#212529] shadow-sm md:p-8`}
    >
      <div className="font-heading text-2xl font-bold text-[#212529]">
        Proposed Transactions
      </div>
      {transactions.length > 0 ? (
        transactions.map((transaction, index) => (
          <ProposalTransaction
            key={`${transaction.target}-${index}`}
            transaction={transaction}
          />
        ))
      ) : (
        <p className="mt-4 text-base text-[#212529]">
          No transactions are attached to this proposal.
        </p>
      )}
    </section>
  );
}

const ProposalTransaction = ({
  transaction,
}: {
  transaction: ProposalTransactionItem;
}) => {
  const { target, value, calldata, signature } = transaction;
  const { data, error } = useSWR<EtherActorResponse>(
    calldata && !signature
      ? `${ETHER_ACTOR_BASEURL}/decode/${target}/${calldata}`
      : undefined
  );
  const valueBN = BigNumber.from(value || 0);
  const functionName = signature || data?.functionName || "transfer";

  const linkIfAddress = (value: string) => {
    if (ethers.utils.isAddress(value)) {
      return (
        <AddressLink
          address={value}
          fallback="full"
          className="text-[#212529] underline"
        />
      );
    }

    return value;
  };

  return (
    <div className="mt-4 w-full rounded-xl border border-skin-stroke bg-[#fff7bf] p-4 text-[#212529]">
      <div className="break-words">
        {linkIfAddress(target)}
        <span>{`.${functionName}(`}</span>
      </div>
      {!valueBN.isZero() && (
        <div className="ml-4">{`${ethers.utils.formatEther(valueBN)} ETH`}</div>
      )}
      {(!data?.decoded || error || signature) &&
        calldata &&
        calldata !== "0x" && <div className="ml-4 break-words">{calldata}</div>}
      {!signature &&
        data?.decoded?.map((decoded, index) => (
          <div className="ml-4" key={index}>
            {linkIfAddress(decoded)}
          </div>
        ))}
      <div>{")"}</div>
    </div>
  );
};
