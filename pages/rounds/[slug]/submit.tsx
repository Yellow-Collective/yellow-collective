import { RoundVideoUpload } from "@/components/rounds/RoundVideoUpload";
import Layout from "@/components/Layout";
import type { Round } from "data/rounds";
import { getPublicRoundBySlug } from "data/rounds";
import { getRoundSignedRequestAction } from "@/utils/rounds/auth";
import { SubmissionImagesField } from "@/components/rounds/SubmissionImagesField";
import {
  appendRoundSubmissionImages,
  getRoundSubmissionImagesPayloadBytes,
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
import { useRef, useState } from "react";
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
class SubmissionRejectedError extends Error {}

export const getServerSideProps = async ({
  params,
}: GetServerSidePropsContext): Promise<
  GetServerSidePropsResult<SubmitRoundProps>
> => {
  const slug = typeof params?.slug === "string" ? params.slug : "";

  try {
    const loaded = await getPublicRoundBySlug(slug, { includeInlineMedia: false });
    if (!loaded) return { notFound: true };
    const { submissions, voteActivity, ...round } = loaded;

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
  const { address, status, connector } = useAccount();
  const walletReady = Boolean(address && status === "connected" && connector);
  const { signMessageAsync } = useSignMessage();
  const [videoUploadId, setVideoUploadId] = useState("");
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [videoReset, setVideoReset] = useState(0);
  const [values, setValues] = useState(initialValues);
  const [message, setMessage] = useState("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionUnknown, setSubmissionUnknown] = useState(false);
  const submitInFlight = useRef(false);
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
      !isUploadingVideo &&
      walletReady &&
      !submissionUnknown
    );

  const updateValue = (
    field: Exclude<keyof typeof values, "images">,
    value: string
  ) => {
    setMessage("");
    setValues((current) => ({ ...current, [field]: value }));
  };

  const videoRequest = async (
    operation: "reserve" | "finalize" | "cancel",
    id?: string
  ) => {
    if (!address || !walletReady)
      throw new Error(
        "Reconnect your wallet using the wallet button and wait for the connection to finish, then try again."
      );
    const path = `/api/rounds/${round.slug}/videos`;
    const payload = { operation, ...(id ? { id } : {}) };
    const authorization = await createSignedRequestAuthHeader({
      walletAddress: address,
      chainId: ROUND_SIGNED_REQUEST_CHAIN_ID,
      action: getRoundSignedRequestAction(
        operation === "reserve"
          ? "video-reserve"
          : operation === "finalize"
            ? "video-finalize"
            : "video-cancel"
      ),
      method: "POST",
      path,
      payload,
      signMessageAsync,
      bounded: true,
    });
    const response = await fetch(path, {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(100000),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Video request failed.");
    return result;
  };

  const submit = async () => {
    if (!canSubmit || !address || submitInFlight.current) return;
    submitInFlight.current = true;
    let dispatched = false;
    let uncertain = false;

    setIsSubmitting(true);
    setSubmissionStage("signing");
    setMessage("Confirm the signature in your wallet to submit your entry.");

    try {
      const path = `/api/rounds/${round.slug}/submit`;
      const payload = {
        submission: {
          ...values,
          ...(videoUploadId ? { videoUploadId } : {}),
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
        bounded: true,
      });
      setSubmissionStage("submitting");
      setMessage("Submitting your entry...");
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      dispatched = true;
      try {
        await Promise.race([
          (async () => {
            const response = await fetch(path, {
              method: "POST",
              headers: {
                Authorization: authorization,
                "Content-Type": "application/json",
              },
              cache: "no-store",
              body: JSON.stringify(payload),
              signal: controller.signal,
            });
            const result = await response.json();
            // This route only emits these statuses from signature verification,
            // before createRoundSubmission is entered.
            if (
              !response.ok &&
              (result?.outcome === "not_saved" ||
                [401, 403, 409].includes(response.status))
            ) {
              throw new SubmissionRejectedError(
                result.error ||
                  "Submission was not saved. Review your entry and try again."
              );
            }
            // Even a 400 can follow a committed insert whose readback failed.
            if (
              !response.ok ||
              typeof result?.submission?.id !== "string" ||
              !result.submission.id
            ) {
              throw new Error("Submission response could not be confirmed.");
            }
          })(),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
              reject(new Error("Submission confirmation timed out."));
              controller.abort();
            }, 30000);
          }),
        ]);
      } finally {
        clearTimeout(timer);
      }

      setMessage("Submission received. It is now visible on the round page.");
      setValues(initialValues);
      setVideoUploadId("");
      setVideoReset((current) => current + 1);
    } catch (submitError) {
      if (dispatched && !(submitError instanceof SubmissionRejectedError)) {
        uncertain = true;
        setSubmissionUnknown(true);
        setMessage("");
      } else {
        setMessage(
          submitError instanceof Error
            ? submitError.message
            : "Submission failed."
        );
      }
    } finally {
      submitInFlight.current = uncertain;
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
          {!walletReady && (
            <div className="mb-5 rounded-xl border border-skin-stroke bg-[#fff7bf] p-4">
              <p className="mb-3 text-base text-secondary">
                Connect or reconnect the wallet that should be attached to this
                submission. Wait for the connection to finish before uploading
                or submitting.
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
          <RoundVideoUpload
            key={videoReset}
            slug={round.slug}
            wallet={address}
            disabled={isSubmitting || submissionUnknown || !walletReady}
            request={videoRequest}
            onChange={setVideoUploadId}
            onBusy={setIsUploadingVideo}
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
              disabled={!canSubmit || isSubmitting}
              className="yc-dark-submit-blue flex items-center justify-center rounded-[18px] bg-accent px-5 py-3 font-heading text-lg text-skin-base shadow-[0px_4.02px_0px_0px_#b89400] transition hover:-translate-y-0.5 hover:bg-[#ffd84d] active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submissionStage === "signing"
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
          {submissionUnknown && (
            <div
              role="status"
              className="mt-4 rounded-xl border border-skin-stroke bg-skin-muted p-3 text-sm text-secondary"
            >
              <p>
                We could not confirm whether your submission was saved. It may
                already exist. Another submission is blocked in this form to
                avoid a duplicate; your inputs have been kept. Check My
                submissions. If the entry is missing, contact the round
                organizers to confirm its status before submitting again. Do not
                reload this form to retry.
              </p>
              <Link
                href={`/rounds/${round.slug}/edit`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-block font-heading underline"
              >
                Check My submissions (opens a new tab)
              </Link>
            </div>
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
