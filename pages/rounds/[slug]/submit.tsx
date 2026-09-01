import Layout from "@/components/Layout";
import type { Round } from "data/rounds";
import { getPublicRoundBySlug } from "data/rounds";
import { getRoundSignedRequestAction } from "@/utils/rounds/auth";
import {
  ROUND_IMAGE_UPLOAD_ACCEPT,
  resizeRoundImageFile,
} from "@/utils/rounds/round-image-upload";
import {
  appendRoundSubmissionImages,
  getRoundSubmissionImagesPayloadBytes,
  ROUND_SUBMISSION_MAX_IMAGES,
  ROUND_SUBMISSION_MAX_TOTAL_IMAGE_BYTES,
} from "@/utils/rounds/submission-images";
import { createSignedRequestAuthHeader } from "@/utils/signature-auth-client";
import { getRoundState } from "@/utils/rounds/state";
import { getRoundSubmissionPlaceholders } from "@/utils/rounds/submission-copy";
import { ArrowLeftIcon } from "@heroicons/react/20/solid";
import { TOKEN_NETWORK } from "constants/addresses";
import type {
  GetServerSidePropsContext,
  GetServerSidePropsResult,
  InferGetServerSidePropsType,
} from "next";
import dynamic from "next/dynamic";
import Head from "next/head";
import Link from "next/link";
import type { ChangeEvent } from "react";
import { useState } from "react";
import { useAccount, useSignMessage } from "wagmi";

const CustomConnectButton = dynamic(
  () => import("@/components/CustomConnectButton"),
  { ssr: false }
);

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
  images: [] as string[],
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
  const [submissionStage, setSubmissionStage] = useState<
    "signing" | "submitting" | null
  >(null);

  if (!round) {
    return (
      <Layout>
        <div className="yc-dark-yellow-form-surface mx-auto max-w-[980px] rounded-2xl border border-skin-stroke bg-white p-6 shadow-sm">
          {error || "Round not found."}
        </div>
      </Layout>
    );
  }

  const placeholders = getRoundSubmissionPlaceholders(round.title);
  const state = getRoundState(round);
  const canSubmit =
    state === "submissions_open" &&
    Boolean(
      values.title.trim() &&
      values.description.trim() &&
      values.images.length > 0 &&
      getRoundSubmissionImagesPayloadBytes(values.images) <=
        ROUND_SUBMISSION_MAX_TOTAL_IMAGE_BYTES &&
      !isUploadingImage &&
      address
    );

  const updateValue = (
    field: Exclude<keyof typeof values, "images">,
    value: string
  ) => {
    setMessage("");
    setValues((current) => ({ ...current, [field]: value }));
  };

  const submit = async () => {
    if (!canSubmit || !address) return;

    setIsSubmitting(true);
    setSubmissionStage("signing");
    setMessage("Confirm the signature in your wallet to submit your entry.");

    try {
      const path = `/api/rounds/${round.slug}/submit`;
      const payload = {
        submission: {
          ...values,
          image: values.images[0],
          images: values.images,
        },
      };
      const authorization = await createSignedRequestAuthHeader({
        walletAddress: address,
        chainId: ROUND_SIGNED_REQUEST_CHAIN_ID,
        action: getRoundSignedRequestAction("submit"),
        method: "POST",
        path,
        payload,
        signMessageAsync,
      });
      setSubmissionStage("submitting");
      setMessage("Submitting your entry...");
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
        submitError instanceof Error
          ? submitError.message
          : "Submission failed."
      );
    } finally {
      setIsSubmitting(false);
      setSubmissionStage(null);
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
              placeholder={placeholders.title}
            />
            <FormField
              label="Submission URL (optional)"
              value={values.url}
              onChange={(value) => updateValue("url", value)}
              placeholder={placeholders.url}
            />
          </div>
          <SubmissionImagesField
            images={values.images}
            onAdd={(addedImages) => {
              setMessage("");
              setValues((current) => ({
                ...current,
                images: appendRoundSubmissionImages(
                  current.images,
                  addedImages
                ),
              }));
            }}
            onRemove={(index) => {
              setMessage("");
              setValues((current) => ({
                ...current,
                images: current.images.filter(
                  (_, imageIndex) => imageIndex !== index
                ),
              }));
            }}
            placeholder={placeholders.image}
            className="mt-5"
            isUploading={isUploadingImage}
            onUploadingChange={setIsUploadingImage}
            onError={setMessage}
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
            placeholder={placeholders.description}
            className="mt-2 w-full resize-y rounded-xl border border-skin-stroke bg-skin-muted px-4 py-3 text-base text-skin-base placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-skin-highlighted"
          />

          <div className="mt-6 flex flex-col gap-4 md:flex-row">
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit || isSubmitting || isSigning}
              className="yc-dark-submit-blue flex items-center justify-center rounded-[18px] bg-accent px-5 py-3 font-heading text-lg text-skin-base shadow-[0px_4.02px_0px_0px_#b89400] transition hover:-translate-y-0.5 hover:bg-[#ffd84d] active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submissionStage === "signing" || isSigning
                ? "Confirm in wallet..."
                : submissionStage === "submitting"
                  ? "Submitting..."
                  : "Submit entry"}
            </button>
            <button
              type="button"
              onClick={() => {
                setValues(initialValues);
                setMessage("");
              }}
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) => {
  const id = `round-submission-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

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
    </div>
  );
};

const SubmissionImagesField = ({
  images,
  onAdd,
  onRemove,
  placeholder,
  className = "",
  isUploading,
  onUploadingChange,
  onError,
}: {
  images: string[];
  onAdd: (images: string[]) => void;
  onRemove: (index: number) => void;
  placeholder: string;
  className?: string;
  isUploading: boolean;
  onUploadingChange: (isUploading: boolean) => void;
  onError: (message: string) => void;
}) => {
  const [imageUrl, setImageUrl] = useState("");
  const remaining = ROUND_SUBMISSION_MAX_IMAGES - images.length;

  const addImageUrl = () => {
    const value = imageUrl.trim();
    if (!value) return;
    if (remaining <= 0) {
      onError(`Choose up to ${ROUND_SUBMISSION_MAX_IMAGES} images.`);
      return;
    }
    onAdd([value]);
    setImageUrl("");
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (files.length === 0) return;
    if (files.length > remaining) {
      onError(
        `You can add ${remaining} more image${remaining === 1 ? "" : "s"}.`
      );
      return;
    }

    onUploadingChange(true);
    try {
      const resizedImages: string[] = [];
      for (const file of files) {
        resizedImages.push(await resizeRoundImageFile(file));
      }
      const nextImages = appendRoundSubmissionImages(images, resizedImages);
      if (
        getRoundSubmissionImagesPayloadBytes(nextImages) >
        ROUND_SUBMISSION_MAX_TOTAL_IMAGE_BYTES
      ) {
        throw new Error(
          "The combined image size is too large. Remove an image or choose smaller files."
        );
      }
      onAdd(resizedImages);
    } catch (error) {
      onError(
        error instanceof Error
          ? `No images were added. ${error.message}`
          : "No images were added. Unable to upload images."
      );
    } finally {
      onUploadingChange(false);
    }
  };

  return (
    <fieldset className={className}>
      <legend className="font-heading text-base text-skin-base">
        Submission images
      </legend>
      <p className="mt-1 text-sm text-secondary">
        Add up to {ROUND_SUBMISSION_MAX_IMAGES} images. The first image is the
        cover. Images stay in the order you add them.
      </p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <input
          value={imageUrl}
          onChange={(event) => setImageUrl(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addImageUrl();
            }
          }}
          placeholder={placeholder}
          aria-label="Image URL"
          className="min-w-0 flex-1 rounded-xl border border-skin-stroke bg-skin-muted px-4 py-3 text-base text-skin-base placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-skin-highlighted"
          disabled={remaining <= 0 || isUploading}
        />
        <button
          type="button"
          onClick={addImageUrl}
          disabled={!imageUrl.trim() || remaining <= 0 || isUploading}
          className="yc-dark-yellow-button rounded-[18px] border border-skin-stroke bg-white px-5 py-3 font-heading text-base text-skin-base shadow-[0px_4.02px_0px_0px_rgb(var(--color-shadow-neutral))] transition hover:-translate-y-0.5 hover:bg-[#fff7bf] active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          Add URL
        </button>
        <label
          className={`yc-dark-submit-blue flex w-fit items-center justify-center rounded-[18px] bg-[#1d9bf0] px-5 py-3 font-heading text-base text-white shadow-[0px_4.02px_0px_0px_#0f5f99] transition hover:-translate-y-0.5 hover:bg-[#45adf5] active:translate-y-1 active:shadow-none ${
            isUploading || remaining <= 0
              ? "cursor-not-allowed opacity-50"
              : "cursor-pointer"
          }`}
        >
          {isUploading ? "Processing images..." : "Upload images"}
          <input
            type="file"
            accept={ROUND_IMAGE_UPLOAD_ACCEPT}
            className="sr-only"
            onChange={handleFileChange}
            disabled={isUploading || remaining <= 0}
            multiple
          />
        </label>
      </div>
      {images.length > 0 && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((image, index) => (
            <div
              key={`${image.slice(0, 80)}-${index}`}
              className="overflow-hidden rounded-xl border border-skin-stroke bg-white"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image}
                alt={`Submission preview ${index + 1}`}
                className="aspect-[16/9] w-full object-cover"
              />
              <div className="flex items-center justify-between gap-3 p-3">
                <span className="text-sm text-secondary">
                  {index === 0 ? "Cover image" : `Image ${index + 1}`}
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  className="font-heading text-sm text-[#a3281d] underline underline-offset-2"
                  aria-label={`Remove image ${index + 1}`}
                >
                  Remove image
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="mt-3 text-sm text-secondary" aria-live="polite">
        {images.length} of {ROUND_SUBMISSION_MAX_IMAGES} images added
      </p>
    </fieldset>
  );
};
