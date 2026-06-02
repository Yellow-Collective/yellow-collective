import Button from "@/components/Button";
import CustomConnectButton from "@/components/CustomConnectButton";
import Layout from "@/components/Layout";
import CoinMediaPreview from "@/components/coins/CoinMediaPreview";
import ContentCoinInfoDialog from "@/components/coins/ContentCoinInfoDialog";
import { useCurrentThreshold } from "@/hooks/fetch/useCurrentThreshold";
import { useDAOAddresses } from "@/hooks/fetch/useDAOAddresses";
import { useUserVotes } from "@/hooks/fetch/useUserVotes";
import {
  BASE_CHAIN_ID,
  COIN_RECORD_SIGNED_REQUEST_ACTION,
  CoiningValues,
  ZORA_COIN_FACTORY_ADDRESS,
  buildDeployParams,
  buildDroposalDescription,
  encodeDeployCalldata,
  erc20MetadataAbi,
  generateCoinSymbol,
  getDexscreenerUrl,
  getDeployArgs,
  getErrorMessage,
  getExplorerAddressUrl,
  getExplorerTxUrl,
  getFixedPairAddress,
  getFixedPairConfigError,
  getZoraCoinUrl,
  normalizeCoinSymbol,
  validateCoiningValues,
  zoraCoinFactoryAbi,
} from "@/utils/coining";
import { createSignedRequestAuthHeader } from "@/utils/signature-auth-client";
import {
  COIN_DEPLOYMENT_DISCLAIMER,
  formatFileSize,
  pinataOptions,
} from "@/utils/ipfs-upload-config";
import { uploadFile } from "@/utils/ipfs-upload";
import { GovernorABI } from "@buildersdk/sdk";
import {
  ArrowLeftIcon,
  ArrowTopRightOnSquareIcon,
} from "@heroicons/react/20/solid";
import { TOKEN_CONTRACT } from "constants/addresses";
import { ethers } from "@/utils/ethers-compat";
import type { GetServerSideProps } from "next";
import Head from "next/head";
import Link from "next/link";
import type { ChangeEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { getAddress, isAddress } from "viem";
import {
  useAccount,
  useContractRead,
  useNetwork,
  useProvider,
  useSigner,
  useSignMessage,
  useSwitchNetwork,
} from "wagmi";

type SubmitMode = "direct" | "droposal";

export const getServerSideProps: GetServerSideProps = async () => ({
  props: {},
});

type PairStatus =
  | { state: "missing"; message: string }
  | { state: "loading"; message: string }
  | { state: "invalid"; message: string }
  | { state: "ready"; name: string; symbol: string; decimals: number };

type SubmitStatus =
  | { state: "idle" }
  | { state: "preparing"; message: string }
  | { state: "pending"; message: string; hash?: string }
  | {
      state: "success";
      message: string;
      hash?: string;
      coinAddress?: string;
      proposalUrl?: string;
    }
  | { state: "error"; message: string };

type UploadStatus =
  | { state: "idle" }
  | { state: "uploading"; fileName: string; progress: number }
  | { state: "success"; fileName: string; uri: string }
  | { state: "error"; message: string };

const initialValues: CoiningValues = {
  coinName: "",
  coinSymbol: "",
  contentTitle: "",
  contentDescription: "",
  mediaUrl: "",
  payoutRecipient: "",
  ownerAddress: "",
  proposalBody: "",
};

export default function CreateCoinPage() {
  const { address } = useAccount();
  const { chain } = useNetwork();
  const provider = useProvider();
  const { data: signer } = useSigner();
  const { signMessageAsync } = useSignMessage();
  const { switchNetworkAsync, isLoading: isSwitchingNetwork } =
    useSwitchNetwork();
  const { data: addresses } = useDAOAddresses({
    tokenContract: TOKEN_CONTRACT,
  });
  const { data: userVotes } = useUserVotes();
  const { data: currentThreshold } = useCurrentThreshold({
    governorContract: addresses?.governor,
  });
  const [mode, setMode] = useState<SubmitMode>("direct");
  const [values, setValues] = useState<CoiningValues>(initialValues);
  const [useTreasuryPayout, setUseTreasuryPayout] = useState(false);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({
    state: "idle",
  });
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>({
    state: "idle",
  });

  const pairConfigError = getFixedPairConfigError();
  const fixedPairAddress = useMemo(() => {
    if (pairConfigError) return undefined;
    return getFixedPairAddress();
  }, [pairConfigError]);

  const pairName = useContractRead({
    address: fixedPairAddress,
    abi: erc20MetadataAbi,
    functionName: "name",
    enabled: Boolean(fixedPairAddress),
    chainId: BASE_CHAIN_ID,
  });
  const pairSymbol = useContractRead({
    address: fixedPairAddress,
    abi: erc20MetadataAbi,
    functionName: "symbol",
    enabled: Boolean(fixedPairAddress),
    chainId: BASE_CHAIN_ID,
  });
  const pairDecimals = useContractRead({
    address: fixedPairAddress,
    abi: erc20MetadataAbi,
    functionName: "decimals",
    enabled: Boolean(fixedPairAddress),
    chainId: BASE_CHAIN_ID,
  });

  useEffect(() => {
    if (!address) return;
    setValues((current) => ({
      ...current,
      payoutRecipient:
        !current.payoutRecipient ||
        current.payoutRecipient.toLowerCase() ===
          current.ownerAddress.toLowerCase()
          ? address
          : current.payoutRecipient,
      ownerAddress: address,
    }));
  }, [address]);

  useEffect(() => {
    if (!addresses?.treasury) return;

    setValues((current) => ({
      ...current,
      payoutRecipient: useTreasuryPayout
        ? addresses.treasury
        : current.payoutRecipient,
    }));
  }, [addresses?.treasury, useTreasuryPayout]);

  const pairStatus: PairStatus = useMemo(() => {
    if (pairConfigError) {
      return { state: "missing", message: pairConfigError };
    }
    if (pairName.isLoading || pairSymbol.isLoading || pairDecimals.isLoading) {
      return {
        state: "loading",
        message: "Checking the fixed Base pairing coin.",
      };
    }
    if (pairName.isError || pairSymbol.isError || pairDecimals.isError) {
      return {
        state: "invalid",
        message:
          "The fixed Base coin could not be read as an ERC20 on Base. Check the address and RPC config.",
      };
    }
    if (!pairName.data || !pairSymbol.data || pairDecimals.data === undefined) {
      return {
        state: "invalid",
        message: "The fixed Base coin did not return ERC20 metadata.",
      };
    }

    return {
      state: "ready",
      name: String(pairName.data),
      symbol: String(pairSymbol.data),
      decimals: Number(pairDecimals.data),
    };
  }, [
    pairConfigError,
    pairDecimals.data,
    pairDecimals.isError,
    pairDecimals.isLoading,
    pairName.data,
    pairName.isError,
    pairName.isLoading,
    pairSymbol.data,
    pairSymbol.isError,
    pairSymbol.isLoading,
  ]);

  const formErrors = useMemo(
    () => validateCoiningValues(values, mode),
    [mode, values]
  );
  const hasFormErrors = Object.keys(formErrors).length > 0;
  const needsBaseSwitch = Boolean(chain?.id && chain.id !== BASE_CHAIN_ID);
  const hasProposalPower =
    mode === "direct" ||
    Boolean(
      userVotes !== undefined &&
        currentThreshold !== undefined &&
        userVotes >= currentThreshold
    );
  const canSubmit =
    Boolean(address && signer) &&
    pairStatus.state === "ready" &&
    !hasFormErrors &&
    !needsBaseSwitch &&
    hasProposalPower &&
    disclaimerAccepted &&
    uploadStatus.state !== "uploading" &&
    submitStatus.state !== "preparing" &&
    submitStatus.state !== "pending";

  const setValue = (key: keyof CoiningValues, value: string) => {
    setSubmitStatus({ state: "idle" });
    if (key === "payoutRecipient") setUseTreasuryPayout(false);
    setValues((current) => ({ ...current, [key]: value }));
  };

  const toggleTreasuryPayout = (enabled: boolean) => {
    setSubmitStatus({ state: "idle" });
    setUseTreasuryPayout(enabled);

    setValues((current) => ({
      ...current,
      payoutRecipient: enabled ? addresses?.treasury || "" : address || "",
    }));
  };

  const handleMediaUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      setSubmitStatus({ state: "idle" });
      setUploadStatus({
        state: "uploading",
        fileName: file.name,
        progress: 0,
      });

      const result = await uploadFile(file, {
        type: "media",
        onProgress: (progress) =>
          setUploadStatus({
            state: "uploading",
            fileName: file.name,
            progress,
          }),
      });

      setValue("mediaUrl", result.uri);
      setUploadStatus({
        state: "success",
        fileName: file.name,
        uri: result.uri,
      });
    } catch (error) {
      console.error("Media upload failed", error);
      setUploadStatus({
        state: "error",
        message: getErrorMessage(error),
      });
    }
  };

  const applyGeneratedSymbol = (coinName: string) => {
    setValues((current) => ({
      ...current,
      coinName,
      coinSymbol:
        current.coinSymbol &&
        current.coinSymbol !== generateCoinSymbol(current.coinName)
          ? current.coinSymbol
          : generateCoinSymbol(coinName),
    }));
    setSubmitStatus({ state: "idle" });
  };

  const ensureBaseNetwork = async () => {
    if (!chain?.id || chain.id === BASE_CHAIN_ID) return true;
    if (!switchNetworkAsync) return false;

    await switchNetworkAsync(BASE_CHAIN_ID);
    return true;
  };

  const getPredictedAddress = async (
    deployer: string,
    params: ReturnType<typeof buildDeployParams>
  ) => {
    const factory = new ethers.Contract(
      ZORA_COIN_FACTORY_ADDRESS,
      zoraCoinFactoryAbi,
      provider
    );

    return factory.coinAddress(
      deployer,
      params.name,
      params.symbol,
      params.poolConfig,
      params.platformReferrer,
      params.coinSalt
    ) as Promise<string>;
  };

  const handleDirectSubmit = async () => {
    if (!address || !signer) return;

    const payoutRecipient = getAddress(values.payoutRecipient) as `0x${string}`;
    const ownerAddress = getAddress(address) as `0x${string}`;
    const deployParams = buildDeployParams({
      values,
      payoutRecipient,
      ownerAddress,
    });

    setSubmitStatus({
      state: "preparing",
      message: "Preparing the content post transaction.",
    });

    const predictedAddress = await getPredictedAddress(address, deployParams);
    const factory = new ethers.Contract(
      ZORA_COIN_FACTORY_ADDRESS,
      zoraCoinFactoryAbi,
      signer
    );

    await (factory as any).deploy.staticCall(...getDeployArgs(deployParams), {
      value: 0n,
    });

    const tx = await (factory as any).deploy(...getDeployArgs(deployParams), {
      value: 0n,
    });

    setSubmitStatus({
      state: "pending",
      message: "Waiting for the content post transaction to confirm.",
      hash: tx.hash,
    });

    await tx.wait();

    let gallerySaved = false;
    let gallerySaveError = "";

    if (ownerAddress.toLowerCase() === address.toLowerCase()) {
      try {
        setSubmitStatus({
          state: "preparing",
          message: "Saving this content post to the Gallery.",
        });

        const path = "/api/coins";
        const payload = {
          coin: {
            address: predictedAddress,
            title: values.contentTitle,
            coinName: values.coinName,
            symbol: values.coinSymbol,
            description: values.contentDescription,
            mediaUrl: values.mediaUrl,
            imageUrl: "",
            ownerAddress,
            payoutRecipient,
            transactionHash: tx.hash,
            creatorAddress: address,
          },
        };
        const authorization = await createSignedRequestAuthHeader({
          walletAddress: ownerAddress,
          chainId: BASE_CHAIN_ID,
          action: COIN_RECORD_SIGNED_REQUEST_ACTION,
          method: "POST",
          path,
          payload,
          signMessageAsync,
        });
        const response = await fetch(path, {
          method: "POST",
          headers: {
            Authorization: authorization,
            "Content-Type": "application/json",
          },
          cache: "no-store",
          body: JSON.stringify(payload),
        });
        const body = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(body.error || "Unable to save post to the Gallery.");
        }

        gallerySaved = true;
      } catch (error) {
        console.error("Unable to save content post to gallery", error);
        gallerySaveError = getErrorMessage(error);
      }
    }

    setSubmitStatus({
      state: "success",
      message: gallerySaved
        ? "Content post created and saved to the Gallery."
        : gallerySaveError
          ? `Content post created, but it was not saved to the Gallery: ${gallerySaveError}`
          : "Content post created.",
      hash: tx.hash,
      coinAddress: predictedAddress,
    });
  };

  const handleDroposalSubmit = async () => {
    if (!address || !signer || !addresses?.governor) {
      return;
    }

    const payoutRecipient = getAddress(values.payoutRecipient) as `0x${string}`;
    const ownerAddress = getAddress(address) as `0x${string}`;
    const deployParams = buildDeployParams({
      values,
      payoutRecipient,
      ownerAddress,
    });
    const calldata = encodeDeployCalldata(deployParams);
    const description = buildDroposalDescription({
      ...values,
      payoutRecipient,
      ownerAddress,
    });
    const governor = new ethers.Contract(
      addresses.governor,
      GovernorABI,
      signer
    );

    setSubmitStatus({
      state: "preparing",
      message: "Preparing the Droposal transaction.",
    });

    const tx = await governor.propose(
      [ZORA_COIN_FACTORY_ADDRESS],
      [ethers.BigNumber.from(0)],
      [calldata],
      description
    );

    setSubmitStatus({
      state: "pending",
      message: "Waiting for the Droposal transaction to confirm.",
      hash: tx.hash,
    });

    await tx.wait();

    setSubmitStatus({
      state: "success",
      message: "Droposal submitted.",
      hash: tx.hash,
      proposalUrl: "/proposals",
    });
  };

  const handleSubmit = async () => {
    try {
      setSubmitStatus({ state: "idle" });
      if (needsBaseSwitch) {
        const networkReady = await ensureBaseNetwork();
        if (!networkReady) {
          setSubmitStatus({
            state: "error",
            message: "Switch your wallet to Base before submitting.",
          });
        }
        return;
      }

      if (!canSubmit) {
        setSubmitStatus({
          state: "error",
          message: submitLabel,
        });
        return;
      }

      if (mode === "direct") {
        await handleDirectSubmit();
      } else {
        await handleDroposalSubmit();
      }
    } catch (error) {
      console.error("Coining submit failed", error);
      setSubmitStatus({ state: "error", message: getErrorMessage(error) });
    }
  };

  const submitLabel = (() => {
    if (!address) return "Connect wallet";
    if (needsBaseSwitch) return "Switch to Base";
    if (pairStatus.state !== "ready") return "Pair coin unavailable";
    if (!hasProposalPower) return "Not enough votes for Droposal";
    if (uploadStatus.state === "uploading") return "Upload in progress";
    if (hasFormErrors) return "Complete required fields";
    if (!disclaimerAccepted) return "Accept disclaimer";
    if (submitStatus.state === "preparing") return submitStatus.message;
    if (submitStatus.state === "pending") return "Transaction pending";
    return mode === "direct" ? "Create Content Post" : "Submit Droposal";
  })();

  return (
    <Layout>
      <Head>
        <title>Create Content Post | Yellow Collective</title>
      </Head>

      <div className="mx-auto -mt-4 flex w-full max-w-[1120px] flex-col gap-8 pb-12 sm:-mt-8">
        <div>
          <div>
            <div className="mb-4 flex items-center gap-2">
              <Link
                href="/art"
                className="flex w-fit items-center gap-2 font-heading text-lg text-skin-base transition hover:opacity-80"
              >
                <span className="yc-dark-yellow-button flex h-10 w-10 items-center justify-center rounded-full border border-skin-stroke bg-white shadow-[0px_4.02px_0px_0px_rgb(var(--color-shadow-neutral))] transition hover:-translate-y-0.5 hover:bg-[#fff7bf] active:translate-y-1 active:shadow-none">
                  <ArrowLeftIcon className="h-4 text-skin-base" />
                </span>
                Back to Gallery
              </Link>
            </div>
            <div>
              <h1 className="font-heading text-[38px] leading-none text-skin-base md:text-[56px]">
                Create a content post
              </h1>
            </div>
            <p className="mt-4 max-w-[720px] text-base leading-snug text-secondary md:text-lg">
              Publish a post on Base with the fixed Yellow pairing coin. Create
              it permissionlessly, or submit the same transaction as a Droposal
              for the DAO to execute.
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              handleSubmit();
            }}
            className="flex flex-col gap-6"
          >
            <section className="yc-dark-yellow-form-surface rounded-2xl border border-skin-stroke bg-white p-5 shadow-sm md:p-6">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-heading text-2xl leading-none text-skin-base">
                    Post details
                  </h2>
                  <p className="mt-2 text-sm text-secondary">
                    These fields become the Zora post metadata.
                  </p>
                </div>
                <div className="flex w-full items-center gap-3 sm:w-auto">
                  <ModeToggle mode={mode} setMode={setMode} />
                  <ContentCoinInfoDialog
                    variant="create"
                    triggerClassName="yc-coin-create-info-button h-[52px] w-[52px]"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-[1fr_240px]">
                <TextField
                  label="Post name"
                  value={values.coinName}
                  error={formErrors.coinName}
                  placeholder="Yellow Studio Notes"
                  onChange={applyGeneratedSymbol}
                />
                <TextField
                  label="Symbol"
                  value={values.coinSymbol}
                  error={formErrors.coinSymbol}
                  placeholder="YLLW"
                  onChange={(value) =>
                    setValue("coinSymbol", normalizeCoinSymbol(value))
                  }
                />
              </div>

              <div className="mt-4">
                <TextField
                  label="Content title"
                  value={values.contentTitle}
                  error={formErrors.contentTitle}
                  placeholder="Field notes from the Yellow Collective"
                  onChange={(value) => setValue("contentTitle", value)}
                />
              </div>

              <div className="mt-4">
                <TextAreaField
                  label="Content description"
                  value={values.contentDescription}
                  error={formErrors.contentDescription}
                  placeholder="Describe the post, artwork, video, essay, or artifact this post represents."
                  onChange={(value) => setValue("contentDescription", value)}
                />
              </div>

              <div className="mt-4">
                <UploadField
                  label="Media"
                  actionLabel="Upload media"
                  replaceLabel="Replace media"
                  uploadingLabel="Uploading media"
                  helperText={`Images, video, or audio up to ${formatFileSize(
                    pinataOptions.media.max_file_size
                  )}`}
                  accept={pinataOptions.media.allow_mime_types.join(",")}
                  value={values.mediaUrl}
                  error={formErrors.mediaUrl}
                  status={uploadStatus}
                  onChange={handleMediaUpload}
                  onClear={() => {
                    setValue("mediaUrl", "");
                    setUploadStatus({ state: "idle" });
                  }}
                />
              </div>
            </section>

            <section className="yc-dark-yellow-form-surface rounded-2xl border border-skin-stroke bg-white p-5 shadow-sm md:p-6">
              <h2 className="font-heading text-2xl leading-none text-skin-base">
                Payout
              </h2>
              <p className="mt-2 text-sm text-secondary">
                Rewards default to your connected wallet. You can change the
                payout recipient before submitting.
              </p>

              <div className="mt-5">
                <TextField
                  label="Payout recipient"
                  value={values.payoutRecipient}
                  error={formErrors.payoutRecipient}
                  placeholder="0x..."
                  onChange={(value) => setValue("payoutRecipient", value)}
                  footer={
                    <TreasuryToggle
                      checked={useTreasuryPayout}
                      disabled={!addresses?.treasury}
                      label="Use DAO treasury as payout recipient"
                      onChange={toggleTreasuryPayout}
                    />
                  }
                />
              </div>
            </section>

            {mode === "droposal" && (
              <section className="yc-dark-yellow-form-surface rounded-2xl border border-skin-stroke bg-white p-5 shadow-sm md:p-6">
                <h2 className="font-heading text-2xl leading-none text-skin-base">
                  Droposal body
                </h2>
                <p className="mt-2 text-sm text-secondary">
                  This appears above the generated content post summary in the
                  proposal description.
                </p>
                <div className="mt-5">
                  <TextAreaField
                    label="Proposal description"
                    value={values.proposalBody}
                    error={formErrors.proposalBody}
                    rows={8}
                    placeholder="Explain why Yellow should create this content post."
                    onChange={(value) => setValue("proposalBody", value)}
                  />
                </div>
              </section>
            )}

            {submitStatus.state === "error" && (
              <StatusBox tone="error" message={submitStatus.message} />
            )}
            {(submitStatus.state === "preparing" ||
              submitStatus.state === "pending") && (
              <StatusBox tone="pending" message={submitStatus.message} />
            )}
            <DisclaimerBox
              checked={disclaimerAccepted}
              onChange={setDisclaimerAccepted}
            />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {!address ? (
                <CustomConnectButton className="yc-dark-submit-blue flex min-h-12 w-full items-center justify-center rounded-[18px] bg-skin-button-accent px-4 py-3 text-center font-heading text-base leading-tight text-skin-inverted shadow-[0px_4.02px_0px_0px_#0464BC] transition hover:-translate-y-0.5 hover:bg-skin-button-accent-hover hover:shadow-[0px_6px_0px_0px_#0464BC] sm:w-auto" />
              ) : (
                <Button
                  type="submit"
                  disabled={!canSubmit && !needsBaseSwitch}
                  className="yc-dark-submit-blue min-h-12 w-full rounded-[18px] px-4 py-3 text-center sm:w-auto"
                >
                  {isSwitchingNetwork ? "Switching network" : submitLabel}
                </Button>
              )}
              <p className="text-sm leading-snug text-secondary">
                This function sends a transaction. Review the wallet prompt
                before signing.
              </p>
            </div>

            {submitStatus.state === "success" && (
              <SuccessBox submitStatus={submitStatus} />
            )}
          </form>

          <aside className="flex flex-col gap-4">
            <PreviewCard values={values} mode={mode} pairStatus={pairStatus} />
            <PairCoinCard pairStatus={pairStatus} />
          </aside>
        </div>
      </div>
    </Layout>
  );
}

const ModeToggle = ({
  mode,
  setMode,
}: {
  mode: SubmitMode;
  setMode: (mode: SubmitMode) => void;
}) => (
  <div className="flex w-full max-w-[248px] gap-1 rounded-xl border border-[rgb(var(--color-selector-stroke))] bg-[#f1f1f1] p-1 sm:w-auto sm:max-w-none">
    {[
      { value: "direct" as const, label: "Create" },
      { value: "droposal" as const, label: "Droposal" },
    ].map((option) => (
      <button
        key={option.value}
        type="button"
        onClick={() => setMode(option.value)}
        className={`proposal-tab-button flex min-h-11 flex-1 items-center justify-center rounded-lg px-4 py-2 text-center font-heading text-sm leading-tight transition sm:flex-none ${
          mode === option.value
            ? "translate-y-[-1px] bg-accent text-skin-base shadow-[0px_2px_0px_0px_#b89400] active:translate-y-0 active:shadow-none"
            : "text-skin-base hover:bg-[#fff7bf]"
        }`}
      >
        {option.label}
      </button>
    ))}
  </div>
);

const PairCoinCard = ({ pairStatus }: { pairStatus: PairStatus }) => (
  <section className="yc-dark-yellow-form-surface rounded-2xl border border-skin-stroke bg-white p-5 shadow-sm">
    <div className="font-heading text-lg text-skin-base">$YELLOW</div>
    <p className="mt-2 text-sm leading-snug text-secondary">
      All posts are coined with $YELLOW as the base pair.
    </p>
    <div className="mt-4 rounded-xl border border-skin-stroke bg-skin-muted p-4">
      {pairStatus.state === "ready" ? (
        <>
          <div className="font-heading text-base text-skin-base">
            $YELLOW base pair
          </div>
          <Link
            href={getExplorerAddressUrl(getFixedPairAddress())}
            target="_blank"
            rel="noreferrer"
            className="mt-3 flex items-center gap-1 font-heading text-sm text-skin-base underline"
          >
            View on Basescan
            <ArrowTopRightOnSquareIcon className="h-4 w-4 shrink-0" />
          </Link>
          <Link
            href={getDexscreenerUrl(getFixedPairAddress())}
            target="_blank"
            rel="noreferrer"
            className="mt-2 flex items-center gap-1 font-heading text-sm text-skin-base underline"
          >
            View on Dexscreener
            <ArrowTopRightOnSquareIcon className="h-4 w-4 shrink-0" />
          </Link>
        </>
      ) : (
        <p className="text-sm font-semibold text-[#8a5a00]">
          {pairStatus.message}
        </p>
      )}
    </div>
  </section>
);

const TextField = ({
  label,
  value,
  onChange,
  error,
  placeholder,
  disabled,
  footer,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
  disabled?: boolean;
  footer?: ReactNode;
}) => (
  <label className="block">
    <span className="text-sm font-semibold text-skin-base">{label}</span>
    <input
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className="mt-2 w-full rounded-xl border border-skin-stroke bg-white px-4 py-3 text-base text-skin-base placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-skin-highlighted disabled:cursor-not-allowed disabled:bg-skin-muted disabled:text-secondary"
    />
    {error && (
      <span className="mt-1 block max-w-[260px] text-sm leading-tight text-red-600">
        {error}
      </span>
    )}
    {footer}
  </label>
);

const UploadField = ({
  label,
  actionLabel,
  replaceLabel,
  uploadingLabel,
  helperText,
  accept,
  value,
  error,
  status,
  onChange,
  onClear,
}: {
  label: string;
  actionLabel: string;
  replaceLabel: string;
  uploadingLabel: string;
  helperText: string;
  accept: string;
  value: string;
  error?: string;
  status: UploadStatus;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
}) => {
  const isUploading = status.state === "uploading";

  return (
    <div>
      <div className="text-sm font-semibold text-skin-base">{label}</div>
      <label className="yc-dark-submit-blue mt-2 flex min-h-[50px] w-full cursor-pointer flex-col justify-center rounded-xl border border-[#0f5f99] bg-[#1d9bf0] px-4 py-3 text-base text-white shadow-[0px_4.02px_0px_0px_#0f5f99] transition hover:-translate-y-0.5 hover:bg-[#45adf5] hover:shadow-[0px_6px_0px_0px_#0f5f99] active:translate-y-1 active:shadow-none md:w-1/2">
        <input
          type="file"
          accept={accept}
          disabled={isUploading}
          onChange={onChange}
          className="sr-only"
        />
        <span className="font-heading">
          {isUploading ? uploadingLabel : value ? replaceLabel : actionLabel}
        </span>
      </label>
      <p className="mt-2 text-sm leading-tight text-secondary">{helperText}</p>

      {status.state === "uploading" && (
        <div className="mt-2">
          <div className="flex items-center justify-between gap-3 text-sm text-skin-base">
            <span className="truncate">{status.fileName}</span>
            <span className="font-heading">{status.progress}%</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/60">
            <div
              className="h-full rounded-full bg-skin-base transition-all"
              style={{ width: `${status.progress}%` }}
            />
          </div>
        </div>
      )}

      {status.state === "success" && (
        <div className="mt-2 rounded-xl border border-skin-stroke bg-[#fff7bf] p-3 text-sm text-skin-base">
          <div className="font-heading">{status.fileName}</div>
          <div className="mt-1 break-all font-mono text-xs">{status.uri}</div>
        </div>
      )}

      {status.state === "error" && (
        <span className="mt-1 block text-sm text-red-600">
          {status.message}
        </span>
      )}
      {error && value && (
        <span className="mt-1 block text-sm text-red-600">{error}</span>
      )}
      {value && (
        <button
          type="button"
          onClick={onClear}
          className="mt-2 font-heading text-sm text-skin-base underline"
        >
          Remove {label.toLowerCase()}
        </button>
      )}
    </div>
  );
};

const DisclaimerBox = ({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) => (
  <label className="flex cursor-pointer gap-4 rounded-2xl bg-[#56585c] p-5 text-[#f1f3f5] md:p-6">
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      className="mt-1 h-4 w-4 shrink-0 accent-[#ffcc00]"
    />
    <span className="text-base leading-snug md:text-lg">
      {COIN_DEPLOYMENT_DISCLAIMER}
    </span>
  </label>
);

const TreasuryToggle = ({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) => (
  <span className="mt-2 flex items-center gap-2 text-sm font-semibold text-skin-base">
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(event) => onChange(event.target.checked)}
      className="h-4 w-4 accent-[#ffcc00]"
    />
    <span>{label}</span>
  </span>
);

const TextAreaField = ({
  label,
  value,
  onChange,
  error,
  placeholder,
  rows = 5,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
  rows?: number;
}) => (
  <label className="block">
    <span className="text-sm font-semibold text-skin-base">{label}</span>
    <textarea
      value={value}
      rows={rows}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className="mt-2 w-full resize-y rounded-xl border border-skin-stroke bg-white px-4 py-3 text-base text-skin-base placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-skin-highlighted"
    />
    {error && <span className="mt-1 block text-sm text-red-600">{error}</span>}
  </label>
);

const PreviewCard = ({
  values,
  mode,
  pairStatus,
}: {
  values: CoiningValues;
  mode: SubmitMode;
  pairStatus: PairStatus;
}) => (
  <section className="yc-coin-review-card sticky top-4 rounded-2xl border-2 border-[#ffcc00] bg-skin-muted p-5">
    <div className="font-heading text-lg text-skin-base">Review</div>
    <div className="mt-4 aspect-[4/3] overflow-hidden rounded-xl border border-skin-stroke bg-white">
      <CoinMediaPreview
        mediaUrl={values.mediaUrl}
        title={values.contentTitle || values.coinName || "Content preview"}
        symbol={values.coinSymbol || "Content preview"}
        className="h-full w-full object-cover"
        fallbackClassName="flex h-full w-full items-center justify-center bg-[#fff7bf] px-6 text-center font-heading text-lg text-skin-base"
        controls
      />
    </div>
    <dl className="mt-4 flex flex-col gap-3 text-sm">
      <ReviewRow
        label="Mode"
        value={mode === "direct" ? "Create now" : "Droposal"}
      />
      <ReviewRow label="Post" value={values.coinName || "Missing"} />
      <ReviewRow label="Symbol" value={values.coinSymbol || "Missing"} />
      <ReviewRow label="Content" value={values.contentTitle || "Missing"} />
      <ReviewRow
        label="Pair"
        value={pairStatus.state === "ready" ? "$YELLOW" : "Unavailable"}
      />
    </dl>
  </section>
);

const ReviewRow = ({ label, value }: { label: string; value: string }) => (
  <div>
    <dt className="font-semibold text-secondary">{label}</dt>
    <dd className="break-words font-heading text-base text-skin-base">
      {value}
    </dd>
  </div>
);

const StatusBox = ({
  tone,
  message,
}: {
  tone: "pending" | "error";
  message: string;
}) => (
  <div
    className={`rounded-2xl border p-4 text-sm font-semibold ${
      tone === "error"
        ? "border-red-300 bg-red-50 text-red-700"
        : "border-[#d9a300] bg-[#fff7bf] text-[#8a5a00]"
    }`}
  >
    {message}
  </div>
);

const SuccessBox = ({
  submitStatus,
}: {
  submitStatus: Extract<SubmitStatus, { state: "success" }>;
}) => (
  <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-800">
    <div className="font-heading text-base">{submitStatus.message}</div>
    <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap gap-3">
        {submitStatus.hash && (
          <Link
            href={getExplorerTxUrl(submitStatus.hash)}
            target="_blank"
            rel="noreferrer"
            className="font-semibold underline"
          >
            View transaction
          </Link>
        )}
        {submitStatus.coinAddress && isAddress(submitStatus.coinAddress) && (
          <>
            <Link
              href={getZoraCoinUrl(getAddress(submitStatus.coinAddress))}
              target="_blank"
              rel="noreferrer"
              className="font-semibold underline"
            >
              View on Zora
            </Link>
            <Link
              href={getExplorerAddressUrl(getAddress(submitStatus.coinAddress))}
              target="_blank"
              rel="noreferrer"
              className="font-semibold underline"
            >
              View contract
            </Link>
          </>
        )}
        {submitStatus.proposalUrl && (
          <Link
            href={submitStatus.proposalUrl}
            className="font-semibold underline"
          >
            View proposals
          </Link>
        )}
      </div>
      <Link
        href="/art"
        className="self-center rounded-xl bg-emerald-600 px-5 py-3 text-center font-heading text-base text-white no-underline shadow-[0px_3px_0px_0px_#047857] transition hover:-translate-y-0.5 hover:bg-emerald-500 hover:shadow-[0px_5px_0px_0px_#047857] active:translate-y-0.5 active:shadow-none sm:ml-auto"
      >
        Go to Gallery
      </Link>
    </div>
  </div>
);
