import CustomConnectButton from "@/components/CustomConnectButton";
import Layout from "@/components/Layout";
import type { Round } from "data/rounds";
import { getPublicRoundBySlug } from "data/rounds";
import { getRoundSignedRequestAction } from "@/utils/rounds/auth";
import {
  ROUND_IMAGE_UPLOAD_ACCEPT,
  resizeRoundImageFile,
} from "@/utils/rounds/round-image-upload";
import { createSignedRequestAuthHeader } from "@/utils/signature-auth-client";
import { getRoundState } from "@/utils/rounds/state";
import { ArrowLeftIcon } from "@heroicons/react/20/solid";
import { TOKEN_NETWORK } from "constants/addresses";
import type {
  GetServerSidePropsContext,
  GetServerSidePropsResult,
  InferGetServerSidePropsType,
} from "next";
import Head from "next/head";
import Link from "next/link";
import type { ChangeEvent } from "react";
import { useState } from "react";
import { useAccount, useSignMessage } from "wagmi";

type SubmitRoundProps = {
  round: Round | null;
  error?: string;
};

const ROUND_SIGNED_REQUEST_CHAIN_ID = Number(TOKEN_NETWORK);

export const getServerSideProps = async ({
  params,
}: GetServerSidePropsContext): Promise<
  GetServerSidePropsResult<SubmitRoundProps>
> => {
  const slug = typeof params?.slug === "string" ? params.slug : "";

  try {
    const round = await getPublicRoundBySlug(slug);
    if (!round) return { notFound: true };

    return { props: { round } };
  } catch (error) {
    console.error("Unable to load submit round", error);
    return { props: { round: null, error: "Unable to load this round." } };
  }
};

const initialValues = {
  title: "",
  description: "",
  image: "",
  url: "",
};

export default function SubmitRoundPage({
  round,
  error,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const { address, isConnected } = useAccount();
  const { signMessageAsync, isLoading: isSigning } = useSignMessage();
  const [values, setValues] = useState(initialValues);
  const [message, setMessage] = useState("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!round) {
    return (
      <Layout>
        <div className="yc-dark-yellow-form-surface mx-auto max-w-[980px] rounded-2xl border border-skin-stroke bg-white p-6 shadow-sm">
          {error || "Round not found."}
        </div>
      </Layout>
    );
  }

  const state = getRoundState(round);
  const canSubmit =
    state === "submissions_open" &&
    Boolean(
      values.title.trim() &&
        values.description.trim() &&
        values.image.trim() &&
        !isUploadingImage &&
        address
    );

  const updateValue = (field: keyof typeof values, value: string) => {
    setMessage("");
    setValues((current) => ({ ...current, [field]: value }));
  };

  const submit = async () => {
    if (!canSubmit || !address) return;

    setIsSubmitting(true);
    setMessage("");

    try {
      const path = `/api/rounds/${round.slug}/submit`;
      const payload = { submission: values };
      const authorization = await createSignedRequestAuthHeader({
        walletAddress: address,
        chainId: ROUND_SIGNED_REQUEST_CHAIN_ID,
        action: getRoundSignedRequestAction("submit"),
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
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Submission failed.");
      }

      setMessage("Submission received. It is now visible on the round page.");
      setValues(initialValues);
    } catch (submitError) {
      setMessage(
        submitError instanceof Error ? submitError.message : "Submission failed."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <Head>
        <title>Submit to {round.title} | Yellow Collective</title>
      </Head>

      <div className="mx-auto flex w-full max-w-[980px] flex-col gap-7 pb-12">
        <Link
          href={`/rounds/${round.slug}`}
          className="flex w-fit items-center gap-2 font-heading text-lg text-skin-base transition hover:opacity-80"
        >
          <span className="yc-dark-yellow-button flex h-10 w-10 items-center justify-center rounded-full border border-skin-stroke bg-white shadow-[0px_4.02px_0px_0px_rgb(var(--color-shadow-neutral))] transition hover:-translate-y-0.5 hover:bg-[#fff7bf] active:translate-y-1 active:shadow-none">
            <ArrowLeftIcon className="h-4 text-skin-base" />
          </span>
          {round.title}
        </Link>

        <section className="yc-dark-yellow-form-surface rounded-2xl border border-skin-stroke bg-white p-6 shadow-sm md:p-8">
          <h1 className="font-heading text-[34px] leading-none md:text-[42px]">
            Submit to this round
          </h1>
          <p className="mt-4 text-base leading-snug text-secondary md:text-lg">
            Submissions appear on the round page right away for Collective Noun
            voting. Admins can edit or hide submissions later if needed.
          </p>
        </section>

        {state !== "submissions_open" && (
          <section className="yc-dark-yellow-form-surface rounded-2xl border border-skin-stroke bg-white p-5 text-secondary shadow-sm">
            This round is not accepting submissions right now.
          </section>
        )}

        <section className="yc-dark-yellow-form-surface rounded-2xl border border-skin-stroke bg-white p-6 shadow-sm md:p-8">
          {!isConnected && (
            <div className="mb-5 rounded-xl border border-skin-stroke bg-[#fff7bf] p-4">
              <p className="mb-3 text-base text-secondary">
                Connect the wallet that should be attached to this submission.
              </p>
              <CustomConnectButton className="h-11 rounded-xl border border-skin-stroke bg-skin-backdrop px-6 text-skin-base" />
            </div>
          )}
          <div className="grid gap-5 md:grid-cols-2">
            <FormField
              label="Submission title"
              value={values.title}
              onChange={(value) => updateValue("title", value)}
              placeholder="Yellow public goods poster"
            />
            <FormField
              label="Project URL (optional)"
              value={values.url}
              onChange={(value) => updateValue("url", value)}
              placeholder="example.com"
            />
          </div>
          <FormField
            label="Image URL"
            value={values.image}
            onChange={(value) => updateValue("image", value)}
            placeholder="example.com/image.png"
            className="mt-5"
            upload={{
              isUploading: isUploadingImage,
              onUploadStart: () => setIsUploadingImage(true),
              onUploadEnd: () => setIsUploadingImage(false),
              onError: setMessage,
            }}
          />
          <label
            htmlFor="round-submission-description"
            className="mt-5 block font-heading text-base text-skin-base"
          >
            Description
          </label>
          <textarea
            id="round-submission-description"
            value={values.description}
            onChange={(event) => updateValue("description", event.target.value)}
            rows={6}
            placeholder="Describe the work and why it belongs in this round."
            className="mt-2 w-full resize-y rounded-xl border border-skin-stroke bg-skin-muted px-4 py-3 text-base text-skin-base placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-skin-highlighted"
          />

          <div className="mt-6 flex flex-col gap-4 md:flex-row">
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit || isSubmitting || isSigning}
              className="yc-dark-submit-blue flex items-center justify-center rounded-[18px] bg-accent px-5 py-3 font-heading text-lg text-skin-base shadow-[0px_4.02px_0px_0px_#b89400] transition hover:-translate-y-0.5 hover:bg-[#ffd84d] active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting || isSigning ? "Submitting..." : "Submit project"}
            </button>
            <button
              type="button"
              onClick={() => setValues(initialValues)}
              className="yc-dark-reset-red flex items-center justify-center rounded-[18px] border border-skin-stroke bg-white px-5 py-3 font-heading text-lg text-skin-base shadow-[0px_4.02px_0px_0px_rgb(var(--color-shadow-neutral))] transition hover:-translate-y-0.5 hover:bg-[#fff7bf] active:translate-y-1 active:shadow-none"
            >
              Reset
            </button>
          </div>
          {message && (
            <p className="mt-4 rounded-xl border border-skin-stroke bg-skin-muted p-3 text-sm text-secondary">
              {message}
            </p>
          )}
        </section>
      </div>
    </Layout>
  );
}

const FormField = ({
  label,
  value,
  onChange,
  placeholder,
  className = "",
  upload,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
  upload?: {
    isUploading: boolean;
    onUploadStart: () => void;
    onUploadEnd: () => void;
    onError: (message: string) => void;
  };
}) => {
  const id = `round-submission-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !upload) return;

    upload.onUploadStart();
    try {
      onChange(await resizeRoundImageFile(file));
    } catch (error) {
      upload.onError(
        error instanceof Error ? error.message : "Unable to upload image."
      );
    } finally {
      upload.onUploadEnd();
      event.target.value = "";
    }
  };

  return (
    <div className={className}>
      <label htmlFor={id} className="font-heading text-base text-skin-base">
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full rounded-xl border border-skin-stroke bg-skin-muted px-4 py-3 text-base text-skin-base placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-skin-highlighted"
      />
      {upload && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="yc-dark-submit-blue flex w-fit cursor-pointer items-center justify-center rounded-[18px] bg-[#1d9bf0] px-5 py-3 font-heading text-base text-white shadow-[0px_4.02px_0px_0px_#0f5f99] transition hover:-translate-y-0.5 hover:bg-[#45adf5] active:translate-y-1 active:shadow-none">
            {upload.isUploading ? "Uploading..." : "Upload image"}
            <input
              type="file"
              accept={ROUND_IMAGE_UPLOAD_ACCEPT}
              className="sr-only"
              onChange={handleFileChange}
              disabled={upload.isUploading}
            />
          </label>
          {value && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="yc-dark-reset-red flex items-center justify-center rounded-[18px] border border-skin-stroke bg-white px-5 py-3 font-heading text-base text-skin-base shadow-[0px_4.02px_0px_0px_rgb(var(--color-shadow-neutral))] transition hover:-translate-y-0.5 hover:bg-[#fff7bf] active:translate-y-1 active:shadow-none"
            >
              Remove image
            </button>
          )}
        </div>
      )}
      {upload && value && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={value}
          alt="Submission preview"
          className="mt-3 aspect-[16/9] w-full rounded-lg border border-skin-stroke bg-white object-cover"
        />
      )}
    </div>
  );
};
