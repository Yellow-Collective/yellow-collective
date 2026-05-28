import CustomConnectButton from "@/components/CustomConnectButton";
import Layout from "@/components/Layout";
import { createSignedRequestAuthHeader } from "@/utils/signature-auth-client";
import { getRoundSignedRequestAction } from "@/utils/rounds/auth";
import {
  ROUND_IMAGE_UPLOAD_ACCEPT,
  resizeRoundImageFile,
} from "@/utils/rounds/round-image-upload";
import { ArrowLeftIcon } from "@heroicons/react/20/solid";
import { TOKEN_NETWORK } from "constants/addresses";
import Head from "next/head";
import Link from "next/link";
import type { ChangeEvent } from "react";
import { useMemo, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";

type AwardFormValue = {
  value: string;
};

type FormValues = {
  requesterName: string;
  requesterEmail: string;
  requestedSlug: string;
  title: string;
  description: string;
  content: string;
  image: string;
  url: string;
  timeline: string;
  submissionsOpenAt: string;
  votingStartsAt: string;
  votingEndsAt: string;
  votingStrategy: string;
  votesPerWallet: string;
  winnerCount: string;
  maxSubmissionsPerWallet: string;
  isTraitContest: boolean;
  awards: AwardFormValue[];
};

const prizeCountOptions = Array.from({ length: 10 }, (_, index) => index + 1);
const ROUND_SIGNED_REQUEST_CHAIN_ID = Number(TOKEN_NETWORK);

const createAwardValues = (
  count: number,
  currentAwards: AwardFormValue[] = []
) =>
  Array.from({ length: count }, (_, index) => ({
    value: currentAwards[index]?.value || "",
  }));

const createInitialValues = (): FormValues => ({
  requesterName: "",
  requesterEmail: "",
  requestedSlug: "",
  title: "",
  description: "",
  content: "",
  image: "",
  url: "",
  timeline: "",
  submissionsOpenAt: "",
  votingStartsAt: "",
  votingEndsAt: "",
  votingStrategy: "one_per_nft",
  votesPerWallet: "1",
  winnerCount: "1",
  maxSubmissionsPerWallet: "1",
  isTraitContest: false,
  awards: createAwardValues(1),
});

type StringFormField = Exclude<keyof FormValues, "awards" | "isTraitContest">;

type MessageState = {
  type: "success" | "error";
  text: string;
} | null;

const votingStrategyOptions = [
  {
    value: "one_per_nft",
    label: "1 vote per Collective Noun held",
  },
  {
    value: "one_per_wallet",
    label: "1 vote per wallet",
  },
  {
    value: "fixed_per_wallet",
    label: "Fixed votes per wallet",
  },
];

export default function RequestRoundPage() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync, isLoading: isSigning } = useSignMessage();
  const [values, setValues] = useState<FormValues>(() => createInitialValues());
  const [message, setMessage] = useState<MessageState>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const prizeCount = Number(values.winnerCount) || 1;

  const canSubmit = useMemo(
    () =>
      Boolean(
        values.requesterName.trim() &&
          values.requesterEmail.trim() &&
          slugify(values.title).trim() &&
          values.title.trim().length >= 3 &&
          values.description.trim().length >= 20 &&
          values.content.trim().length >= 20 &&
          values.image.trim() &&
          values.submissionsOpenAt &&
          values.votingStartsAt &&
          values.votingEndsAt &&
          Number(values.winnerCount) > 0 &&
          Number(values.maxSubmissionsPerWallet) > 0 &&
          Number(values.votesPerWallet) > 0 &&
          address &&
          values.awards.length === Number(values.winnerCount) &&
          values.awards.every((award) => award.value.trim())
      ),
    [address, values]
  );

  const updateValue = (field: StringFormField, value: string) => {
    setMessage(null);
    setValues((currentValues) => {
      if (field === "title") {
        return {
          ...currentValues,
          title: value,
          requestedSlug: slugify(value),
        };
      }

      return { ...currentValues, [field]: value };
    });
  };

  const updatePrizeCount = (count: number) => {
    setMessage(null);
    setValues((currentValues) => ({
      ...currentValues,
      winnerCount: String(count),
      awards: createAwardValues(count, currentValues.awards),
    }));
  };

  const updateBooleanValue = (field: "isTraitContest", value: boolean) => {
    setMessage(null);
    setValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }));
  };

  const updateAwardValue = (index: number, value: string) => {
    setMessage(null);
    setValues((currentValues) => ({
      ...currentValues,
      awards: currentValues.awards.map((award, awardIndex) =>
        awardIndex === index ? { value } : award
      ),
    }));
  };

  const submit = async () => {
    if (!address) {
      setMessage({
        type: "error",
        text: "Connect a wallet before requesting a round.",
      });
      return;
    }
    if (!canSubmit) return;

    setIsSubmitting(true);
    setMessage(null);

    try {
      const path = "/api/rounds/request";
      const payload = {
        request: {
          ...values,
          requestedSlug: slugify(values.title),
          walletAddress: address,
          submissionsOpenAt: dateInputToIso(values.submissionsOpenAt),
          votingStartsAt: dateInputToIso(values.votingStartsAt),
          votingEndsAt: dateInputToIso(values.votingEndsAt),
          votesPerWallet: Number(values.votesPerWallet),
          winnerCount: Number(values.winnerCount),
          maxSubmissionsPerWallet: Number(values.maxSubmissionsPerWallet),
          traitSubmissionsEnabled: values.isTraitContest,
          awards: buildAwards(values.awards),
        },
      };
      const authorization = await createSignedRequestAuthHeader({
        walletAddress: address,
        chainId: ROUND_SIGNED_REQUEST_CHAIN_ID,
        action: getRoundSignedRequestAction("request"),
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
        throw new Error(result.error || "Round request failed.");
      }

      setValues(createInitialValues());
      setMessage({
        type: "success",
        text: "Round request submitted. An admin will review it and get back to you.",
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Round request failed.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <Head>
        <title>Request a Round | Yellow Collective</title>
      </Head>

      <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-7 pb-12">
        <Link
          href="/rounds"
          className="flex w-fit items-center gap-2 font-heading text-lg text-skin-base transition hover:opacity-80"
        >
          <span className="yc-dark-yellow-button flex h-10 w-10 items-center justify-center rounded-full border border-skin-stroke bg-white shadow-[0px_4.02px_0px_0px_rgb(var(--color-shadow-neutral))] transition hover:-translate-y-0.5 hover:bg-[#fff7bf] active:translate-y-1 active:shadow-none">
            <ArrowLeftIcon className="h-4 text-skin-base" />
          </span>
          Rounds
        </Link>

        <section className="yc-dark-yellow-form-surface rounded-2xl border border-skin-stroke bg-white p-6 shadow-sm md:p-8">
          <h1 className="font-heading text-[34px] leading-none md:text-[42px]">
            Request a round
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-snug text-secondary md:text-lg">
            Submit the full round setup for admin review. If approved, the round
            can be published directly from this request.
          </p>
        </section>

        <section className="yc-dark-yellow-form-surface rounded-2xl border border-skin-stroke bg-white p-6 shadow-sm md:p-8">
          {!isConnected && (
            <div className="mb-5 rounded-xl border border-skin-stroke bg-[#fff7bf] p-4">
              <p className="mb-3 text-base text-secondary">
                Connect the wallet that should be logged with this round
                request.
              </p>
              <CustomConnectButton className="h-11 rounded-xl border border-skin-stroke bg-skin-backdrop px-6 text-skin-base" />
            </div>
          )}

          <div className="grid gap-5 md:grid-cols-2">
            <FormField
              label="Your name"
              value={values.requesterName}
              onChange={(value) => updateValue("requesterName", value)}
              placeholder="Your name"
              required
            />
            <FormField
              label="Email"
              value={values.requesterEmail}
              onChange={(value) => updateValue("requesterEmail", value)}
              placeholder="you@example.com"
              type="email"
              required
            />
            <FormField
              label="Round title"
              value={values.title}
              onChange={(value) => updateValue("title", value)}
              placeholder="Yellow poster round"
              required
            />
            <FormField
              label="Reference URL"
              value={values.url}
              onChange={(value) => updateValue("url", value)}
              placeholder="example.com"
              note="If there is an announcement, proposal, etc that you want to link out to."
            />
            <ImageUploadField
              value={values.image}
              onChange={(value) => updateValue("image", value)}
              onError={(text) => setMessage({ type: "error", text })}
              required
            />
          </div>

          <input
            type="hidden"
            name="requestedSlug"
            value={values.requestedSlug}
          />

          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-skin-stroke bg-[#fff7bf] p-4 transition hover:bg-[#fff3a3]">
            <input
              type="checkbox"
              checked={values.isTraitContest}
              onChange={(event) =>
                updateBooleanValue("isTraitContest", event.target.checked)
              }
              className="mt-1 h-5 w-5 accent-[#ffcc00]"
            />
            <span>
              <span className="block font-heading text-base text-skin-base">
                Noundry trait round
              </span>
              <span className="mt-1 block text-sm leading-snug text-secondary">
                Let creators submit approved Noundry traits directly to this
                round once it is published.
              </span>
            </span>
          </label>

          <TextAreaField
            label="Summary"
            value={values.description}
            onChange={(value) => updateValue("description", value)}
            placeholder="Short public summary for the round card."
            required
          />
          <TextAreaField
            label="Description"
            value={values.content}
            onChange={(value) => updateValue("content", value)}
            placeholder="Submission rules, judging context, eligibility, and anything participants need to know."
            required
          />
          <TextAreaField
            label="Notes"
            value={values.timeline}
            onChange={(value) => updateValue("timeline", value)}
            placeholder="Any notes or comments for the admins."
          />

          <div className="mt-6 grid gap-5 md:grid-cols-3">
            <DateField
              label="Submissions open"
              value={values.submissionsOpenAt}
              onChange={(value) => updateValue("submissionsOpenAt", value)}
              required
            />
            <DateField
              label="Voting starts"
              value={values.votingStartsAt}
              onChange={(value) => updateValue("votingStartsAt", value)}
              required
            />
            <DateField
              label="Voting ends"
              value={values.votingEndsAt}
              onChange={(value) => updateValue("votingEndsAt", value)}
              required
            />
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <label className="font-heading text-base text-skin-base">
              Voting type *
              <select
                value={values.votingStrategy}
                onChange={(event) =>
                  updateValue("votingStrategy", event.target.value)
                }
                className="mt-2 w-full rounded-xl border border-skin-stroke bg-skin-muted px-4 py-3 text-base text-skin-base focus:outline-none focus:ring-2 focus:ring-skin-highlighted"
              >
                {votingStrategyOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <NumberField
              label="Votes per wallet"
              value={values.votesPerWallet}
              onChange={(value) => updateValue("votesPerWallet", value)}
              disabled={values.votingStrategy !== "fixed_per_wallet"}
              required
            />
            <NumberField
              label="Max submissions / wallet"
              value={values.maxSubmissionsPerWallet}
              onChange={(value) =>
                updateValue("maxSubmissionsPerWallet", value)
              }
              required
            />
          </div>

          <div className="mt-6">
            <label
              htmlFor="round-request-prize-count"
              className="font-heading text-base text-skin-base"
            >
              Number of prizes *
            </label>
            <select
              id="round-request-prize-count"
              value={prizeCount}
              onChange={(event) => updatePrizeCount(Number(event.target.value))}
              className="mt-2 w-full rounded-xl border border-skin-stroke bg-skin-muted px-4 py-3 text-base text-skin-base focus:outline-none focus:ring-2 focus:ring-skin-highlighted md:max-w-xs"
            >
              {prizeCountOptions.map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </select>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {values.awards.map((award, index) => (
                <FormField
                  key={index}
                  label={`${formatRankLabel(index + 1)} prize`}
                  value={award.value}
                  onChange={(value) => updateAwardValue(index, value)}
                  placeholder="1 ETH, 0.25 ETH, merch pack, feature spot..."
                  required
                />
              ))}
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-4 md:flex-row">
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit || isSubmitting || isSigning}
              className="yc-dark-submit-blue flex items-center justify-center rounded-[18px] bg-[#1d9bf0] px-5 py-3 font-heading text-lg text-white shadow-[0px_4.02px_0px_0px_#0f5f99] transition hover:-translate-y-0.5 hover:bg-[#45adf5] active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting || isSigning ? "Submitting..." : "Submit request"}
            </button>
            <button
              type="button"
              onClick={() => setValues(createInitialValues())}
              className="yc-dark-reset-red yc-dark-reset-white-hover flex items-center justify-center rounded-[18px] border border-skin-stroke bg-white px-5 py-3 font-heading text-lg text-skin-base shadow-[0px_4.02px_0px_0px_rgb(var(--color-shadow-neutral))] transition hover:-translate-y-0.5 hover:bg-[#fff7bf] active:translate-y-1 active:shadow-none"
            >
              Reset
            </button>
          </div>
          <p className="mt-4 max-w-3xl rounded-xl border border-skin-stroke bg-[#fff7bf] p-4 text-sm leading-snug text-secondary">
            Prizes for the Round must be transferred to yellowcollective.eth
            prior to the Round being approved. An admin will reach out to
            coordinate once your request is reviewed.
          </p>
          {message && (
            <p
              role={message.type === "error" ? "alert" : "status"}
              className={`mt-4 rounded-xl border p-3 text-sm ${
                message.type === "error"
                  ? "border-skin-proposal-danger bg-skin-proposal-danger bg-opacity-10 text-skin-proposal-danger"
                  : "border-skin-proposal-success bg-white text-skin-proposal-success"
              }`}
            >
              {message.text}
            </p>
          )}
        </section>
      </div>
    </Layout>
  );
}

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const dateInputToIso = (value: string) =>
  value ? new Date(value).toISOString() : "";

const buildAwards = (awards: AwardFormValue[]) =>
  awards
    .map((award, index) => {
      const position = index + 1;

      return {
        position,
        title: `${formatRankLabel(position)} prize`,
        value: award.value.trim(),
        description: "",
      };
    })
    .filter((award) => award.value);

const formatRankLabel = (rank: number) => `Rank ${rank}`;

const fieldId = (label: string) =>
  `round-request-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

const FormField = ({
  label,
  value,
  onChange,
  placeholder,
  note,
  className = "",
  required = false,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  note?: string;
  className?: string;
  required?: boolean;
  type?: string;
}) => {
  const id = fieldId(label);

  return (
    <div className={className}>
      <label htmlFor={id} className="font-heading text-base text-skin-base">
        {label}
        {required ? " *" : ""}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        className="mt-2 w-full rounded-xl border border-skin-stroke bg-skin-muted px-4 py-3 text-base text-skin-base placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-skin-highlighted"
      />
      {note && (
        <p className="mt-2 text-sm leading-snug text-secondary">{note}</p>
      )}
    </div>
  );
};

const ImageUploadField = ({
  value,
  onChange,
  onError,
  required = false,
}: {
  value: string;
  onChange: (value: string) => void;
  onError: (message: string) => void;
  required?: boolean;
}) => {
  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      onChange(await resizeRoundImageFile(file));
    } catch (error) {
      onError(
        error instanceof Error ? error.message : "Unable to upload image."
      );
    } finally {
      event.target.value = "";
    }
  };

  return (
    <div>
      <div className="font-heading text-base text-skin-base">
        Image
        {required ? " *" : ""}
      </div>
      <div className="mt-2 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="yc-dark-submit-blue flex w-fit cursor-pointer items-center justify-center rounded-[18px] bg-[#1d9bf0] px-5 py-3 font-heading text-base text-white shadow-[0px_4.02px_0px_0px_#0f5f99] transition hover:-translate-y-0.5 hover:bg-[#45adf5] active:translate-y-1 active:shadow-none">
              Upload image
              <input
                type="file"
                accept={ROUND_IMAGE_UPLOAD_ACCEPT}
                className="sr-only"
                onChange={handleFileChange}
              />
            </label>
            {value && (
              <button
                type="button"
                onClick={() => onChange("")}
                className="yc-dark-reset-red yc-dark-reset-white-hover rounded-[18px] border border-skin-stroke bg-white px-5 py-3 font-heading text-base text-skin-base shadow-[0px_4.02px_0px_0px_rgb(var(--color-shadow-neutral))] transition hover:-translate-y-0.5 hover:bg-[#fff7bf] active:translate-y-1 active:shadow-none"
              >
                Remove
              </button>
            )}
          </div>
          <p className="max-w-[260px] text-sm leading-snug text-secondary">
            Image for the Round preview and banner.
          </p>
        </div>
        {value && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt="Round preview"
            className="aspect-[16/9] w-full rounded-lg border border-skin-stroke bg-white object-cover"
          />
        )}
      </div>
    </div>
  );
};

const NumberField = ({
  label,
  value,
  onChange,
  required = false,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
}) => {
  const id = fieldId(label);

  return (
    <div>
      <label htmlFor={id} className="font-heading text-base text-skin-base">
        {label}
        {required ? " *" : ""}
      </label>
      <input
        id={id}
        type="number"
        min="1"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        disabled={disabled}
        className="mt-2 w-full rounded-xl border border-skin-stroke bg-skin-muted px-4 py-3 text-base text-skin-base placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-skin-highlighted disabled:cursor-not-allowed disabled:opacity-60"
      />
    </div>
  );
};

const DateField = ({
  label,
  value,
  onChange,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) => {
  const id = fieldId(label);

  return (
    <div>
      <label htmlFor={id} className="font-heading text-base text-skin-base">
        {label}
        {required ? " *" : ""}
      </label>
      <input
        id={id}
        type="datetime-local"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        className="mt-2 w-full rounded-xl border border-skin-stroke bg-skin-muted px-4 py-3 text-base text-skin-base placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-skin-highlighted"
      />
    </div>
  );
};

const TextAreaField = ({
  label,
  value,
  onChange,
  placeholder,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  required?: boolean;
}) => {
  const id = fieldId(label);

  return (
    <div className="mt-5">
      <label htmlFor={id} className="font-heading text-base text-skin-base">
        {label}
        {required ? " *" : ""}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={5}
        placeholder={placeholder}
        required={required}
        className="mt-2 w-full resize-y rounded-xl border border-skin-stroke bg-skin-muted px-4 py-3 text-base text-skin-base placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-skin-highlighted"
      />
    </div>
  );
};
