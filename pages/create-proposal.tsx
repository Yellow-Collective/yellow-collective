import AuthWrapper from "@/components/AuthWrapper";
import Layout from "@/components/Layout";
import { useCurrentThreshold } from "@/hooks/fetch/useCurrentThreshold";
import { useUserVotes } from "@/hooks/fetch/useUserVotes";
import { useDebounce } from "@/hooks/useDebounce";
import { useIsMounted } from "@/hooks/useIsMounted";
import { GovernorABI } from "@buildersdk/sdk";
import { Listbox } from "@headlessui/react";
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  ChevronUpDownIcon,
} from "@heroicons/react/20/solid";
import { ethers, parseEther } from "@/utils/ethers-compat";
import {
  Field,
  FieldArray,
  Form,
  Formik,
  useField,
  useFormikContext,
} from "formik";
import { TOKEN_CONTRACT } from "constants/addresses";
import { useDAOAddresses } from "@/hooks/fetch";
import type { GetServerSideProps } from "next";
import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { Fragment, useMemo } from "react";
import {
  useContractWrite,
  usePrepareContractWrite,
  useWaitForTransaction,
} from "wagmi";

type TransactionType =
  | "send-tokens"
  | "nft"
  | "stream-tokens"
  | "airdrop-tokens"
  | "milestone-payments"
  | "mint-governance-tokens"
  | "walletconnect"
  | "nominate-delegate"
  | "pin-treasury-asset"
  | "custom-transaction"
  | "creator-coin"
  | "droposal-single-edition"
  | "resume-auctions"
  | "add-artwork"
  | "replace-artwork";

interface Transaction {
  type: TransactionType;
  tokenKind: "eth" | "erc20";
  address: string;
  valueInETH: string;
  calldata: string;
  tokenAddress: string;
  recipient: string;
  amount: string;
  decimals: string;
  tokenId: string;
  fromAddress: string;
  notes: string;
  confirmedCustomCalldata: boolean;
}

interface PreparedTransaction {
  target: `0x${string}`;
  value: bigint;
  calldata: `0x${string}`;
}

export const getServerSideProps: GetServerSideProps = async () => ({
  props: {},
});

interface Values {
  title: string;
  summary: string;
  transactions: Transaction[];
}

const erc20Interface = new ethers.utils.Interface([
  "function transfer(address to,uint256 amount)",
]);

const erc721Interface = new ethers.utils.Interface([
  "function safeTransferFrom(address from,address to,uint256 tokenId)",
]);

const proposalTypes: Array<{
  type: TransactionType;
  label: string;
  shortDescription: string;
  longDescription: string;
  icon: string;
  iconClassName: string;
}> = [
  {
    type: "send-tokens",
    label: "Send Tokens",
    shortDescription: "Send ETH or ERC20 tokens to one or more recipients.",
    longDescription:
      "Transfer ETH or ERC20 tokens from the treasury to one or more recipients. Use this for direct grants, reimbursements, or simple payments.",
    icon: "Ξ",
    iconClassName: "bg-purple-100 text-purple-600",
  },
  {
    type: "nft",
    label: "Send NFTs",
    shortDescription: "Send NFTs from the treasury.",
    longDescription:
      "Transfer an NFT currently held by the treasury to a recipient address.",
    icon: "NFT",
    iconClassName: "bg-gray-100 text-orange-500 text-xs",
  },
  {
    type: "stream-tokens",
    label: "Stream Tokens",
    shortDescription: "Continuous token payments over time.",
    longDescription:
      "Create a continuous token payment stream for contributors, delegates, or service providers over a defined period.",
    icon: "~",
    iconClassName: "bg-orange-100 text-orange-500",
  },
  {
    type: "airdrop-tokens",
    label: "Airdrop Tokens",
    shortDescription: "Distribute tokens with Sablier merkle campaigns.",
    longDescription:
      "Distribute tokens through a Sablier merkle campaign so eligible recipients can claim from a predefined allocation.",
    icon: "⌛",
    iconClassName: "bg-orange-100 text-orange-500",
  },
  {
    type: "milestone-payments",
    label: "Milestone Payments",
    shortDescription: "Schedule token releases in milestones.",
    longDescription:
      "Schedule token releases around milestones so payments can be released in phases as work is completed.",
    icon: "⚑",
    iconClassName: "bg-red-100 text-red-400",
  },
  {
    type: "mint-governance-tokens",
    label: "Mint Governance Tokens",
    shortDescription: "Mint governance tokens to selected addresses.",
    longDescription:
      "Mint new governance tokens to selected addresses through the DAO's governance process.",
    icon: "○",
    iconClassName: "bg-emerald-100 text-emerald-500",
  },
  {
    type: "walletconnect",
    label: "WalletConnect",
    shortDescription:
      "Connect to dApps and execute transactions via WalletConnect.",
    longDescription:
      "Use WalletConnect to prepare transactions from external dApps and submit them through governance.",
    icon: "⌁",
    iconClassName: "bg-gray-100 text-blue-400",
  },
  {
    type: "nominate-delegate",
    label: "Nominate Delegate",
    shortDescription:
      "Nominate a delegate for milestone payments or token streams.",
    longDescription:
      "Nominate a delegate who can administer milestone payments or token streams for an approved initiative.",
    icon: "◇",
    iconClassName: "bg-gray-100 text-blue-400",
  },
  {
    type: "pin-treasury-asset",
    label: "Pin Treasury Asset",
    shortDescription:
      "Whitelist a token or NFT for prominent display in treasury.",
    longDescription:
      "Whitelist a token or NFT so it can be highlighted prominently on the treasury page.",
    icon: "⌖",
    iconClassName: "bg-orange-100 text-orange-500",
  },
  {
    type: "custom-transaction",
    label: "Custom Transaction",
    shortDescription: "Any other type of transaction.",
    longDescription:
      "Submit any executable transaction by entering the target contract, ETH value, and calldata directly.",
    icon: "</>",
    iconClassName: "bg-gray-200 text-skin-base text-xs",
  },
  {
    type: "creator-coin",
    label: "Creator Coin",
    shortDescription: "Create a proposal to mint Creator Coin.",
    longDescription:
      "Create a proposal that mints Creator Coin through the relevant Builder flow.",
    icon: "◎",
    iconClassName: "bg-blue-100 text-blue-500",
  },
  {
    type: "droposal-single-edition",
    label: "Droposal: Single Edition",
    shortDescription: "Single-edition ERC721 collection droposal.",
    longDescription:
      "Create a single-edition ERC721 collection droposal through the Builder droposal workflow.",
    icon: "▣",
    iconClassName: "bg-gray-100 text-blue-500",
  },
  {
    type: "resume-auctions",
    label: "Resume Auctions",
    shortDescription: "Resume paused auctions.",
    longDescription:
      "Resume auctions after they have been paused by governance or treasury operations.",
    icon: "▶",
    iconClassName: "bg-orange-100 text-orange-500",
  },
  {
    type: "add-artwork",
    label: "Add Artwork",
    shortDescription: "Add new artwork to your collection.",
    longDescription:
      "Add new artwork assets to the collection through the DAO's governance-controlled metadata flow.",
    icon: "+",
    iconClassName: "bg-yellow-100 text-yellow-600",
  },
  {
    type: "replace-artwork",
    label: "Replace Artwork",
    shortDescription: "Replace existing artwork in your collection.",
    longDescription:
      "Replace existing collection artwork through the DAO's governance-controlled metadata flow.",
    icon: "↔",
    iconClassName: "bg-yellow-100 text-yellow-600",
  },
];

const getEmptyTransaction = (type: TransactionType): Transaction => ({
  type,
  tokenKind: "eth",
  address: "",
  valueInETH: type === "send-tokens" ? "" : "0",
  calldata: "0x",
  tokenAddress: "",
  recipient: "",
  amount: "",
  decimals: "18",
  tokenId: "",
  fromAddress: "",
  notes: "",
  confirmedCustomCalldata: false,
});

const isStrictHexCalldata = (value: string) =>
  /^0x(?:[0-9a-fA-F]{2})*$/.test(value);

const getFunctionSelector = (calldata: string) =>
  isStrictHexCalldata(calldata) && calldata.length >= 10
    ? calldata.slice(0, 10)
    : "0x";

const decodeKnownCalldata = (calldata: string) => {
  if (!isStrictHexCalldata(calldata) || calldata.length < 10) return null;

  for (const contractInterface of [erc20Interface, erc721Interface]) {
    try {
      const parsed = contractInterface.parseTransaction({ data: calldata });
      if (!parsed) continue;
      return {
        name: parsed.name,
        args: parsed.args.map((arg: unknown) => String(arg)),
      };
    } catch {
      // Try the next known interface.
    }
  }

  return null;
};

const transactionUsesCustomCalldata = (transaction: Transaction) =>
  transaction.type !== "send-tokens" && transaction.type !== "nft";

const normalizeFormValue = (value: unknown) =>
  value === null || value === undefined ? "" : String(value);

const parsePositiveEther = (value: unknown) => {
  const normalizedValue = normalizeFormValue(value).trim();
  if (!normalizedValue) return null;

  const parsed = parseEther(normalizedValue);
  return parsed > 0n ? parsed : null;
};

const parsePositiveTokenAmount = (amount: unknown, decimals: unknown) => {
  const normalizedAmount = normalizeFormValue(amount).trim();
  const normalizedDecimals = normalizeFormValue(decimals).trim();
  if (!normalizedAmount || !normalizedDecimals) return null;

  const decimalPlaces = Number(normalizedDecimals);
  if (
    !Number.isInteger(decimalPlaces) ||
    decimalPlaces < 0 ||
    decimalPlaces > 255
  ) {
    return null;
  }

  const parsed = ethers.utils.parseUnits(normalizedAmount, decimalPlaces);
  return parsed > 0n ? parsed : null;
};

const getInitialProposalValues = (template?: string | string[]): Values => {
  const defaultValues: Values = {
    title: "",
    summary: "",
    transactions: [getEmptyTransaction("send-tokens")],
  };

  if (
    template !== "noundry" ||
    typeof window === "undefined" ||
    !window.sessionStorage
  ) {
    return defaultValues;
  }

  try {
    const draft = JSON.parse(
      window.sessionStorage.getItem("yellow-noundry-proposal-draft") || "{}"
    );
    const transaction = getEmptyTransaction("add-artwork");

    transaction.notes = [
      `Trait slot: ${draft.traitType || ""}`,
      `Trait name: ${draft.traitName || ""}`,
      `Artist: ${draft.artist || ""}`,
      "Exported image data is stored in this browser session from Noundry.",
      draft.imageData ? "Image export: ready" : "Image export: missing",
    ]
      .filter(Boolean)
      .join("\n");

    return {
      title: draft.title || defaultValues.title,
      summary: draft.summary || defaultValues.summary,
      transactions: [transaction],
    };
  } catch (error) {
    console.warn("Unable to load Noundry proposal draft", error);
    return defaultValues;
  }
};

export default function CreateProposalPage() {
  const router = useRouter();
  const { data: addresses } = useDAOAddresses({
    tokenContract: TOKEN_CONTRACT,
  });
  const initialValues = useMemo(
    () => getInitialProposalValues(router.query.template),
    [router.query.template]
  );

  return (
    <Layout>
      <Head>
        <title>Create Proposal | Yellow Collective</title>
      </Head>

      <div className="mx-auto flex w-full max-w-[980px] flex-col gap-8 pb-12">
        <div className="flex items-center gap-4">
          <Link
            href="/proposals"
            className="yc-dark-yellow-button flex h-10 min-h-[2.5rem] w-10 min-w-[2.5rem] flex-none items-center justify-center rounded-full border border-skin-stroke bg-white transition hover:bg-[#fff7bf]"
            aria-label="Back to proposals"
          >
            <ArrowLeftIcon className="h-5" />
          </Link>

          <div>
            <h1 className="font-heading text-[34px] leading-none text-skin-base md:text-[44px]">
              Create proposal
            </h1>
            <p className="mt-3 max-w-[620px] text-base leading-snug text-secondary md:text-lg">
              Build the same core proposal types used by Nouns Builder, then
              submit them onchain for Yellow Collective governance.
            </p>
          </div>
        </div>

        <Formik
          enableReinitialize
          initialValues={initialValues}
          onSubmit={() => {}}
        >
          {({ values, setFieldValue }) => (
            <Form className="flex flex-col gap-6">
              <section className="yc-dark-yellow-form-surface rounded-2xl border border-skin-stroke bg-white p-5 shadow-sm md:p-6">
                <div className="mb-5">
                  <h2 className="font-heading text-2xl leading-none text-skin-base">
                    Proposal details
                  </h2>
                  <p className="mt-2 text-sm text-secondary md:text-base">
                    This content becomes the proposal metadata shown on the
                    proposal page.
                  </p>
                </div>

                <label className="font-heading text-base text-skin-base">
                  Title
                </label>
                <Field
                  name="title"
                  placeholder="Paint Farcon Yellow"
                  className="mt-2 w-full rounded-xl border border-skin-stroke bg-skin-muted px-4 py-3 text-base text-skin-base placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-skin-highlighted"
                />

                <label className="mt-5 block font-heading text-base text-skin-base">
                  Description
                </label>
                <HTMLTextEditor />
              </section>

              <section className="yc-dark-yellow-form-surface rounded-2xl border border-skin-stroke bg-white p-5 shadow-sm md:p-6">
                <div className="mb-5">
                  <h2 className="font-heading text-2xl leading-none text-skin-base">
                    Proposal actions
                  </h2>
                  <p className="mt-2 text-sm text-secondary md:text-base">
                    Choose from the proposal types available in Nouns Builder.
                    Advanced types can be submitted by pasting the generated
                    target, value, and calldata.
                  </p>
                </div>

                <FieldArray name="transactions">
                  {(arrayHelpers) => (
                    <div className="flex flex-col gap-4">
                      {values.transactions.map((transaction, index) => (
                        <div
                          key={index}
                          className="rounded-xl border border-skin-stroke bg-skin-muted p-4"
                        >
                          <div className="mb-4 flex items-center justify-between gap-4">
                            <h3 className="font-heading text-lg text-skin-base">
                              Action {index + 1}
                            </h3>
                            {values.transactions.length > 1 && (
                              <button
                                type="button"
                                onClick={() => arrayHelpers.remove(index)}
                                className="rounded-lg px-3 py-2 text-sm text-secondary transition hover:bg-[#fff7bf] hover:text-skin-base"
                              >
                                Remove
                              </button>
                            )}
                          </div>

                          <ProposalTypeDropdown
                            value={transaction.type}
                            onChange={(type) =>
                              setFieldValue(
                                `transactions[${index}]`,
                                getEmptyTransaction(type)
                              )
                            }
                          />

                          <TransactionFields
                            transaction={transaction}
                            index={index}
                            treasuryAddress={addresses?.treasury}
                          />
                          <TransactionReadinessMessage
                            transaction={transaction}
                            treasuryAddress={addresses?.treasury}
                          />
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={() =>
                          arrayHelpers.push(
                            getEmptyTransaction("custom-transaction")
                          )
                        }
                        className="h-12 rounded-xl border border-skin-stroke bg-[#fff7bf] font-heading text-base text-skin-base transition hover:-translate-y-0.5 hover:shadow-sm"
                      >
                        Add action
                      </button>
                    </div>
                  )}
                </FieldArray>
              </section>

              <section className="yc-dark-yellow-form-surface rounded-2xl border border-skin-stroke bg-white p-5 shadow-sm md:p-6">
                <div className="mb-5">
                  <h2 className="font-heading text-2xl leading-none text-skin-base">
                    Review and submit
                  </h2>
                  <p className="mt-2 text-sm text-secondary md:text-base">
                    Proposal submissions are onchain transactions. Verify every
                    target, value, and calldata before submitting.
                  </p>
                </div>

                <SubmitButton />
              </section>
            </Form>
          )}
        </Formik>
      </div>
    </Layout>
  );
}

const TransactionFields = ({
  transaction,
  index,
  treasuryAddress,
}: {
  transaction: Transaction;
  index: number;
  treasuryAddress?: string;
}) => {
  const { setFieldValue } = useFormikContext<Values>();
  const selectedProposalType = proposalTypes.find(
    (proposalType) => proposalType.type === transaction.type
  );

  if (transaction.type === "send-tokens") {
    return (
      <div className="mt-5 flex flex-col gap-4">
        <div className="flex w-fit rounded-xl border border-skin-stroke bg-white p-1">
          {(["eth", "erc20"] as const).map((tokenKind) => (
            <button
              key={tokenKind}
              type="button"
              onClick={() =>
                setFieldValue(`transactions[${index}].tokenKind`, tokenKind)
              }
              className={`rounded-lg px-4 py-2 font-heading text-sm transition ${
                transaction.tokenKind === tokenKind
                  ? "bg-[#fff7bf] text-skin-base"
                  : "text-secondary hover:bg-[#fff7bf] hover:text-skin-base"
              }`}
            >
              {tokenKind === "eth" ? "ETH" : "ERC20"}
            </button>
          ))}
        </div>

        {transaction.tokenKind === "eth" ? (
          <div className="grid gap-4 md:grid-cols-[1fr_180px]">
            <AddressField
              name={`transactions[${index}].recipient`}
              label="Recipient"
            />
            <AmountField
              name={`transactions[${index}].valueInETH`}
              label="ETH amount"
              suffix="ETH"
            />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <AddressField
              name={`transactions[${index}].tokenAddress`}
              label="Token contract"
            />
            <AddressField
              name={`transactions[${index}].recipient`}
              label="Recipient"
            />
            <AmountField
              name={`transactions[${index}].amount`}
              label="Token amount"
              suffix="Tokens"
            />
            <AmountField
              name={`transactions[${index}].decimals`}
              label="Decimals"
              suffix="Decimals"
            />
          </div>
        )}
      </div>
    );
  }

  if (transaction.type === "nft") {
    return (
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <AddressField
          name={`transactions[${index}].tokenAddress`}
          label="NFT contract"
        />
        <AddressField
          name={`transactions[${index}].recipient`}
          label="Recipient"
        />
        <AddressField
          name={`transactions[${index}].fromAddress`}
          label="From address"
          placeholder={treasuryAddress || "Treasury address"}
        />
        <AmountField
          name={`transactions[${index}].tokenId`}
          label="Token ID"
          suffix="ID"
        />
      </div>
    );
  }

  if (transaction.type !== "custom-transaction") {
    return (
      <div className="mt-5 flex flex-col gap-4">
        <div className="rounded-xl border border-skin-stroke bg-white p-4">
          <div className="font-heading text-base text-skin-base">
            {selectedProposalType?.label}
          </div>
          <p className="mt-2 text-sm leading-snug text-secondary">
            {selectedProposalType?.longDescription} Paste the transaction
            generated by the matching Builder flow below.
          </p>
        </div>
        <CustomTransactionFields
          index={index}
          transaction={transaction}
          treasuryAddress={treasuryAddress}
        />
        <div>
          <label className="text-sm font-semibold text-skin-base">
            Builder notes
          </label>
          <Field
            as="textarea"
            name={`transactions[${index}].notes`}
            rows={3}
            placeholder="Optional notes for this proposal action"
            className="mt-2 w-full resize-none rounded-xl border border-skin-stroke bg-white px-4 py-3 text-base text-skin-base placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-skin-highlighted"
          />
        </div>
      </div>
    );
  }

  return (
    <CustomTransactionFields
      index={index}
      transaction={transaction}
      treasuryAddress={treasuryAddress}
    />
  );
};

const ProposalTypeDropdown = ({
  value,
  onChange,
}: {
  value: TransactionType;
  onChange: (type: TransactionType) => void;
}) => {
  const selectedProposalType =
    proposalTypes.find((proposalType) => proposalType.type === value) ||
    proposalTypes[0];

  return (
    <div>
      <Listbox value={value} onChange={onChange}>
        <Listbox.Label className="mb-2 block font-heading text-base text-skin-base">
          Proposal type
        </Listbox.Label>
        <div className="relative">
          <Listbox.Button className="flex w-full items-center justify-between gap-4 rounded-xl border border-skin-stroke bg-white px-4 py-3 text-left shadow-sm transition focus:outline-none focus:ring-2 focus:ring-skin-highlighted">
            <ProposalTypeOptionContent proposalType={selectedProposalType} />
            <ChevronUpDownIcon className="h-5 shrink-0 text-secondary" />
          </Listbox.Button>

          <Listbox.Options className="absolute z-20 mt-2 max-h-[420px] w-full overflow-auto rounded-2xl border border-skin-stroke bg-white py-2 shadow-xl focus:outline-none">
            {proposalTypes.map((proposalType) => (
              <Listbox.Option
                key={proposalType.type}
                value={proposalType.type}
                className={({ active, selected }) =>
                  `cursor-pointer px-4 py-3 transition ${
                    active || selected ? "bg-[#fff7bf]" : "bg-white"
                  }`
                }
              >
                <ProposalTypeOptionContent proposalType={proposalType} />
              </Listbox.Option>
            ))}
          </Listbox.Options>
        </div>
      </Listbox>
    </div>
  );
};

const ProposalTypeOptionContent = ({
  proposalType,
}: {
  proposalType: (typeof proposalTypes)[number];
}) => (
  <div className="flex items-center gap-4">
    <span
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-heading text-base ${proposalType.iconClassName}`}
    >
      {proposalType.icon}
    </span>
    <span className="min-w-0">
      <span className="block font-heading text-base leading-tight text-skin-base">
        {proposalType.label}
      </span>
      <span className="mt-1 block text-sm leading-snug text-secondary">
        {proposalType.shortDescription}
      </span>
    </span>
  </div>
);

const CustomTransactionFields = ({
  index,
  transaction,
  treasuryAddress,
}: {
  index: number;
  transaction: Transaction;
  treasuryAddress?: string;
}) => {
  const decoded = decodeKnownCalldata(transaction.calldata);
  const selector = getFunctionSelector(transaction.calldata);
  const isKnownTarget =
    treasuryAddress &&
    transaction.address.toLowerCase() === treasuryAddress.toLowerCase();
  const needsUnknownConfirmation =
    !decoded || !isKnownTarget || transaction.valueInETH !== "0";

  return (
    <div className="mt-5 grid gap-4 md:grid-cols-[1fr_180px]">
      <AddressField name={`transactions[${index}].address`} label="Target" />
      <AmountField
        name={`transactions[${index}].valueInETH`}
        label="ETH value"
        suffix="ETH"
      />
      <div className="md:col-span-2">
        <label className="text-sm font-semibold text-skin-base">Calldata</label>
        <Field
          name={`transactions[${index}].calldata`}
          placeholder="0x"
          className="mt-2 w-full rounded-xl border border-skin-stroke bg-white px-4 py-3 font-mono text-sm text-skin-base placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-skin-highlighted"
        />
      </div>
      <div className="md:col-span-2 rounded-xl border border-[#d9a300] bg-[#fff7bf] p-4 text-sm leading-snug text-skin-base">
        <div className="font-heading text-base">Custom calldata review</div>
        <dl className="mt-3 grid gap-2 font-mono text-xs">
          <div>
            <dt className="font-sans font-semibold">Target</dt>
            <dd className="break-all">{transaction.address || "Missing"}</dd>
          </div>
          <div>
            <dt className="font-sans font-semibold">ETH value</dt>
            <dd>{transaction.valueInETH || "0"} ETH</dd>
          </div>
          <div>
            <dt className="font-sans font-semibold">Function selector</dt>
            <dd>{selector}</dd>
          </div>
          <div>
            <dt className="font-sans font-semibold">Decoded function</dt>
            <dd>{decoded ? decoded.name : "Unknown ABI"}</dd>
          </div>
          {decoded && (
            <div>
              <dt className="font-sans font-semibold">Decoded arguments</dt>
              <dd className="break-all">{decoded.args.join(", ") || "None"}</dd>
            </div>
          )}
          <div>
            <dt className="font-sans font-semibold">Raw calldata</dt>
            <dd className="break-all">{transaction.calldata || "0x"}</dd>
          </div>
        </dl>
        {needsUnknownConfirmation && (
          <p className="mt-3 font-semibold text-[#8a5a00]">
            Unknown targets, non-zero ETH value, or undecoded calldata can move
            treasury assets. Verify the target and calldata externally before
            submitting.
          </p>
        )}
        <label className="mt-4 flex items-start gap-3 font-sans text-sm">
          <Field
            type="checkbox"
            name={`transactions[${index}].confirmedCustomCalldata`}
            className="mt-1"
          />
          <span>I verified this target, value, and calldata.</span>
        </label>
      </div>
    </div>
  );
};

const AddressField = ({
  name,
  label,
  placeholder = "0x0000000000000000000000000000000000000000",
}: {
  name: string;
  label: string;
  placeholder?: string;
}) => (
  <div>
    <label className="text-sm font-semibold text-skin-base">{label}</label>
    <Field
      name={name}
      placeholder={placeholder}
      className="mt-2 w-full rounded-xl border border-skin-stroke bg-white px-4 py-3 text-base text-skin-base placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-skin-highlighted"
    />
  </div>
);

const AmountField = ({
  name,
  label,
  suffix,
}: {
  name: string;
  label: string;
  suffix: string;
}) => (
  <div>
    <label className="text-sm font-semibold text-skin-base">{label}</label>
    <div className="mt-2 flex">
      <Field
        name={name}
        placeholder="0"
        type="number"
        min="0"
        step="any"
        className="w-full rounded-l-xl border border-r-0 border-skin-stroke bg-white px-4 py-3 text-base text-skin-base placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-skin-highlighted"
      />
      <span className="flex items-center rounded-r-xl border border-skin-stroke bg-white px-4 text-sm font-semibold text-secondary">
        {suffix}
      </span>
    </div>
  </div>
);

const TransactionReadinessMessage = ({
  transaction,
  treasuryAddress,
}: {
  transaction: Transaction;
  treasuryAddress?: `0x${string}`;
}) => {
  const issue = getTransactionReadinessIssue(transaction, treasuryAddress);

  if (!issue) {
    return (
      <p className="mt-4 rounded-xl border border-skin-proposal-success bg-skin-proposal-success bg-opacity-10 px-4 py-3 text-sm font-semibold text-skin-proposal-success">
        Action ready.
      </p>
    );
  }

  return (
    <p className="mt-4 rounded-xl border border-[#d9a300] bg-[#fff7bf] px-4 py-3 text-sm font-semibold text-[#8a5a00]">
      {issue}
    </p>
  );
};

const SubmitButton = () => {
  const { values: formValues } = useFormikContext<Values>();
  const { transactions, title, summary } = formValues || {};
  const { data: addresses } = useDAOAddresses({
    tokenContract: TOKEN_CONTRACT,
  });
  const { data: userVotes } = useUserVotes();
  const { data: currentThreshold } = useCurrentThreshold({
    governorContract: addresses?.governor,
  });

  const preparedTransactions = transactions.map((transaction) =>
    prepareTransaction(transaction, addresses?.treasury)
  );
  const hasValidContent = Boolean(title.trim() && summary.trim());
  const hasValidTransactions =
    preparedTransactions.length > 0 &&
    preparedTransactions.every(
      (transaction): transaction is PreparedTransaction => Boolean(transaction)
    );
  const hasConfirmedCustomTransactions = transactions.every(
    (transaction) =>
      !transactionUsesCustomCalldata(transaction) ||
      transaction.confirmedCustomCalldata
  );
  const validTransactions = preparedTransactions.filter(
    (transaction): transaction is PreparedTransaction => Boolean(transaction)
  );

  const targets = validTransactions.map((transaction) => transaction.target);
  const values = validTransactions.map((transaction) =>
    ethers.BigNumber.from(transaction.value.toString())
  );
  const callDatas = validTransactions.map(
    (transaction) => transaction.calldata
  );
  const description = JSON.stringify({
    version: 1,
    title: title.trim(),
    description: summary,
  });

  const args = [targets, values, callDatas, description] as const;
  const debouncedArgs = useDebounce(args);
  const shouldPrepare =
    hasValidContent && hasValidTransactions && hasConfirmedCustomTransactions;

  const { config } = usePrepareContractWrite({
    address: addresses?.governor,
    abi: GovernorABI,
    functionName: "propose",
    args: debouncedArgs,
    enabled: shouldPrepare,
  });
  const { data, write } = useContractWrite(config);
  const { isLoading, isSuccess } = useWaitForTransaction({
    hash: data?.hash,
  });

  const isMounted = useIsMounted();
  if (!isMounted) return <Fragment />;

  const hasBalance = userVotes && userVotes >= (currentThreshold || 0);
  const disabled =
    !hasBalance || !shouldPrepare || !write || isSuccess || isLoading;
  const showsSubmitLabel =
    hasBalance &&
    hasValidContent &&
    hasValidTransactions &&
    hasConfirmedCustomTransactions &&
    !isSuccess;
  const buttonTone = showsSubmitLabel
    ? "bg-skin-button-accent hover:bg-skin-button-accent-hover"
    : "bg-[#dbeafe] text-[#5f7590] shadow-[0px_4.02px_0px_0px_#b9c7d8]";
  const buttonClass = `yc-dark-submit-blue flex min-h-12 w-full items-center justify-center rounded-[18px] px-4 py-3 text-center font-heading text-base leading-tight text-skin-inverted shadow-[0px_4.02px_0px_0px_#0464BC] transition enabled:hover:-translate-y-0.5 enabled:hover:shadow-[0px_6px_0px_0px_#0464BC] enabled:active:translate-y-1 enabled:active:shadow-none disabled:cursor-not-allowed ${buttonTone}`;

  const getButtonLabel = () => {
    if (!hasBalance) return "You don't have enough votes to submit a proposal";
    if (!hasValidContent) return "Add a title and description";
    if (!hasValidTransactions) return "Complete every proposal action";
    if (!hasConfirmedCustomTransactions) return "Confirm custom calldata";
    if (isSuccess) return "Proposal submitted";
    return "Submit proposal";
  };

  return (
    <AuthWrapper className={buttonClass}>
      <button
        onClick={() => write?.()}
        disabled={disabled}
        type="button"
        className={buttonClass}
      >
        {isSuccess ? (
          <span className="flex items-center gap-2">
            {getButtonLabel()}
            <CheckCircleIcon className="h-5" />
          </span>
        ) : isLoading ? (
          <Image src="/spinner.svg" alt="spinner" width={25} height={25} />
        ) : (
          getButtonLabel()
        )}
      </button>
    </AuthWrapper>
  );
};

const prepareTransaction = (
  transaction: Transaction,
  treasuryAddress?: `0x${string}`
): PreparedTransaction | null => {
  try {
    switch (transaction.type) {
      case "send-tokens":
        if (transaction.tokenKind === "eth") {
          if (!ethers.utils.isAddress(transaction.recipient)) return null;
          const value = parsePositiveEther(transaction.valueInETH);
          if (!value) return null;

          return {
            target: transaction.recipient as `0x${string}`,
            value,
            calldata: "0x",
          };
        }
        if (
          !ethers.utils.isAddress(transaction.tokenAddress) ||
          !ethers.utils.isAddress(transaction.recipient)
        ) {
          return null;
        }
        const amount = parsePositiveTokenAmount(
          transaction.amount,
          transaction.decimals
        );
        if (!amount) return null;

        return {
          target: transaction.tokenAddress as `0x${string}`,
          value: parseEther("0"),
          calldata: erc20Interface.encodeFunctionData("transfer", [
            transaction.recipient,
            amount,
          ]) as `0x${string}`,
        };
      case "nft": {
        const fromAddress = transaction.fromAddress || treasuryAddress;
        if (
          !ethers.utils.isAddress(transaction.tokenAddress) ||
          !ethers.utils.isAddress(transaction.recipient) ||
          !fromAddress ||
          !ethers.utils.isAddress(fromAddress)
        )
          return null;
        const tokenId = normalizeFormValue(transaction.tokenId).trim();
        if (!tokenId) return null;

        return {
          target: transaction.tokenAddress as `0x${string}`,
          value: parseEther("0"),
          calldata: erc721Interface.encodeFunctionData("safeTransferFrom", [
            fromAddress,
            transaction.recipient,
            tokenId,
          ]) as `0x${string}`,
        };
      }
      case "custom-transaction":
      default:
        if (
          !ethers.utils.isAddress(transaction.address) ||
          !isStrictHexCalldata(transaction.calldata)
        )
          return null;
        return {
          target: transaction.address as `0x${string}`,
          value: parseEther(normalizeFormValue(transaction.valueInETH) || "0"),
          calldata: transaction.calldata as `0x${string}`,
        };
    }
  } catch (error) {
    console.error("Unable to prepare proposal transaction", error);
    return null;
  }
};

const getTransactionReadinessIssue = (
  transaction: Transaction,
  treasuryAddress?: `0x${string}`
) => {
  if (!prepareTransaction(transaction, treasuryAddress)) {
    if (transaction.type === "send-tokens") {
      return transaction.tokenKind === "eth"
        ? "Add a valid recipient and ETH amount for this action."
        : "Add a valid token contract, recipient, amount, and decimals for this action.";
    }

    if (transaction.type === "nft") {
      return "Add a valid NFT contract, recipient, from address, and token ID for this action.";
    }

    return "Add a valid target address, ETH value, and hex calldata for this action.";
  }

  if (
    transactionUsesCustomCalldata(transaction) &&
    !transaction.confirmedCustomCalldata
  ) {
    return "Confirm that you verified this target, value, and calldata.";
  }

  return null;
};

const HTMLTextEditor = () => {
  const props = { name: "summary", type: "text", id: "summary" };
  const [_, meta, helpers] = useField(props.name);
  const { value } = meta;
  const { setValue } = helpers;

  return (
    <textarea
      className="mt-2 min-h-[250px] w-full rounded-xl border border-skin-stroke bg-white p-4 font-body text-base text-skin-base outline-none transition placeholder:text-skin-muted focus:border-skin-highlight"
      value={value || ""}
      onChange={(event) => setValue(event.target.value)}
      {...props}
    />
  );
};
