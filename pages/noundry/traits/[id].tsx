import Layout from "@/components/Layout";
import WalletIdentityLink from "@/components/WalletIdentityLink";
import { getProfilePath } from "@/utils/profile/identity";
import {
  NoundrySubmission,
  NounPreviewTile,
  buildRandomTraits,
  formatRelativeTime,
  getLayerLabel,
  getSubmissionPreviewTraits,
  getTraitPath,
} from "@/components/noundry/NoundryPreview";
import { ArrowLeftIcon } from "@heroicons/react/20/solid";
import type { PlaygroundArtwork } from "data/nouns-builder/artwork";
import type { Round } from "data/rounds";
import { getRoundSignedRequestAction } from "@/utils/rounds/auth";
import { getNoundryAuthorSignedRequestAction } from "@/utils/noundry/auth";
import { createSignedRequestAuthHeader } from "@/utils/signature-auth-client";
import { TOKEN_NETWORK } from "constants/addresses";
import type { GetServerSideProps } from "next";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { useAccount, useSignMessage } from "wagmi";

const ROUND_SIGNED_REQUEST_CHAIN_ID = Number(TOKEN_NETWORK);

export const getServerSideProps: GetServerSideProps = async () => ({
  props: {},
});

const fetcher = async (url: string) => {
  const response = await fetch(url);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Unable to load Noundry data.");
  }

  return data;
};

export default function NoundryTraitPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { signMessageAsync, isLoading: isSigning } = useSignMessage();
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const id = typeof router.query.id === "string" ? router.query.id : "";
  const { data: artwork, error: artworkError } = useSWR<PlaygroundArtwork>(
    "/api/playground/artwork",
    fetcher
  );
  const {
    data,
    error: submissionsError,
    mutate: mutateSubmissions,
  } = useSWR<{
    submissions: NoundrySubmission[];
  }>("/api/noundry/submissions", fetcher);

  const submission = useMemo(
    () => data?.submissions.find((item) => item.id === id),
    [data?.submissions, id]
  );
  const artistSubmissions = useMemo(
    () =>
      submission
        ? data?.submissions.filter(
            (item) =>
              item.artist.toLowerCase() === submission.artist.toLowerCase()
          ) || []
        : [],
    [data?.submissions, submission]
  );
  const selectedTraits = useMemo(
    () => (submission ? getSubmissionPreviewTraits(submission) : {}),
    [submission]
  );
  const submittedTraitBase = useMemo(
    () =>
      submission && selectedTraits[submission.traitType]
        ? { [submission.traitType]: selectedTraits[submission.traitType] }
        : {},
    [selectedTraits, submission]
  );
  const generatedTraits = useMemo(
    () =>
      artwork && submission
        ? Array.from({ length: 8 }, (_, index) =>
            buildRandomTraits(
              artwork,
              `${submission.id}-generated-${index}`,
              submittedTraitBase
            )
          )
        : [],
    [artwork, submittedTraitBase, submission]
  );
  const collectionTraits = useMemo(
    () =>
      artwork && submission
        ? Array.from({ length: 8 }, (_, index) =>
            buildRandomTraits(
              artwork,
              `${submission.id}-collection-${index}`,
              index === 1 || index === 6 ? submittedTraitBase : {}
            )
          )
        : [],
    [artwork, submittedTraitBase, submission]
  );
  const isCreator =
    Boolean(address && submission) &&
    address?.toLowerCase() === submission?.artist.toLowerCase();
  const eligibleRoundsKey =
    isConnected && isCreator && submission && address
      ? `/api/rounds/eligible-trait-rounds?wallet=${address}&traitId=${submission.id}`
      : null;
  const {
    data: eligibleRoundsData,
    error: eligibleRoundsError,
    mutate: mutateEligibleRounds,
  } = useSWR<{
    rounds: Round[];
  }>(eligibleRoundsKey, fetcher);
  const eligibleRounds = eligibleRoundsData?.rounds || [];

  const loadError = artworkError?.message || submissionsError?.message;

  return (
    <Layout>
      <Head>
        <title>
          {submission
            ? `${submission.title} | Noundry`
            : "Noundry Trait | Yellow Collective"}
        </title>
      </Head>

      <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 pb-12">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/noundry?tab=gallery"
            className="flex w-fit items-center gap-2 font-heading text-sm uppercase text-skin-base transition hover:opacity-80"
          >
            <span className="yc-dark-yellow-button flex h-10 w-10 items-center justify-center rounded-full border border-skin-stroke bg-white shadow-[0px_4.02px_0px_0px_rgb(var(--color-shadow-neutral))] transition hover:-translate-y-0.5 hover:bg-[#fff7bf] hover:shadow-[0px_6px_0px_0px_rgb(var(--color-shadow-neutral))] active:translate-y-1 active:shadow-none">
              <ArrowLeftIcon className="h-4 text-skin-base" />
            </span>
            Back to gallery
          </Link>
          {submission && (
            <div className="flex items-center gap-3">
              {isConnected && isCreator && (
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(true)}
                  className="yc-dark-force-white rounded-[18px] border border-[#8f1d1b] bg-[#d63230] px-5 py-3 font-heading text-base text-white shadow-[0px_4.02px_0px_0px_#8f1d1b] transition hover:-translate-y-0.5 hover:bg-[#e44845] hover:shadow-[0px_6px_0px_0px_#8f1d1b] active:translate-y-1 active:shadow-none"
                >
                  Edit
                </button>
              )}
              <Link
                href={getProfilePath({ address: submission.artist })}
                className="yc-dark-force-white rounded-[18px] border border-[#0f5f99] bg-[#1d9bf0] px-5 py-3 font-heading text-base text-white shadow-[0px_4.02px_0px_0px_#0f5f99] transition hover:-translate-y-0.5 hover:bg-[#45adf5] hover:shadow-[0px_6px_0px_0px_#0f5f99] active:translate-y-1 active:shadow-none"
              >
                Artist profile
              </Link>
            </div>
          )}
        </div>

        {loadError && (
          <section className="yc-dark-yellow-surface rounded-2xl border border-skin-stroke bg-white p-6 text-skin-proposal-danger shadow-sm">
            {loadError}
          </section>
        )}

        {!loadError && !submission && (
          <section className="yc-dark-yellow-surface rounded-2xl border border-dashed border-skin-stroke bg-white p-10 text-center shadow-sm">
            <h1 className="font-heading text-3xl leading-none text-skin-base">
              Trait not found
            </h1>
            <p className="mt-3 text-secondary">
              This submission is not approved or no longer exists.
            </p>
          </section>
        )}

        {submission && (
          <section className="grid gap-6 lg:grid-cols-[minmax(320px,440px)_1fr]">
            <aside className="yc-dark-yellow-surface overflow-hidden rounded-2xl border border-skin-stroke bg-white shadow-sm">
              <div className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h1 className="font-heading text-4xl leading-none text-skin-base md:text-5xl">
                      {submission.title}
                    </h1>
                    <div className="mt-2 font-heading text-lg uppercase text-secondary">
                      {getLayerLabel(submission.traitType)}
                    </div>
                  </div>
                  <div className="rounded-sm bg-[#d8d8df] px-3 py-2 font-heading text-xs uppercase tracking-normal text-secondary">
                    {getLayerLabel(submission.traitType)}
                  </div>
                </div>

                <div className="mt-5 aspect-square bg-[#d7d9e4] p-8">
                  <NounPreviewTile
                    artwork={artwork}
                    submission={submission}
                    traits={selectedTraits}
                    showEditedTrait
                  />
                </div>

                <div className="mt-3 text-sm text-secondary">
                  {formatRelativeTime(submission.createdAt)}
                </div>
                <Link
                  href={getProfilePath({ address: submission.artist })}
                  className="mt-4 flex min-w-0 items-center gap-3 rounded-xl border border-skin-stroke bg-[#f7f7f7] p-3 transition hover:bg-[#fff7bf]"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent font-heading text-sm text-skin-base">
                    {submission.artist.slice(2, 4).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-heading text-base text-skin-base">
                      <WalletIdentityLink
                        address={submission.artist}
                        link={false}
                      />
                    </span>
                    <span className="block text-xs text-secondary">
                      {artistSubmissions.length} submission
                      {artistSubmissions.length === 1 ? "" : "s"}
                    </span>
                  </span>
                </Link>
              </div>
              <div className="border-t border-skin-stroke p-4">
                {isConnected && isCreator && (
                  <button
                    type="button"
                    onClick={() => setIsSubmitModalOpen(true)}
                    className="mb-3 flex w-full items-center justify-center rounded-xl border border-[#0f5f99] bg-[#1d9bf0] px-3 py-2 font-heading text-sm text-white shadow-[0px_3px_0px_0px_#0f5f99] transition hover:-translate-y-0.5 hover:bg-[#45adf5] active:translate-y-1 active:shadow-none"
                  >
                    Submit to a Round
                  </button>
                )}
                <Link
                  href={`/noundry?tab=gallery`}
                  className="yc-dark-force-white flex w-full items-center justify-center rounded-xl border border-[#8f1d1b] bg-[#d63230] px-3 py-2 font-heading text-sm text-white shadow-[0px_3px_0px_0px_#8f1d1b] transition hover:-translate-y-0.5 hover:bg-[#e44845] active:translate-y-1 active:shadow-none"
                >
                  Remix in studio
                </Link>
              </div>
            </aside>

            <div className="flex flex-col gap-6">
              <NounGridSection
                artwork={artwork}
                submission={submission}
                title="Generated with this trait"
                traits={generatedTraits}
                editedIndexes={generatedTraits.map((_, index) => index)}
              />
              <NounGridSection
                artwork={artwork}
                submission={submission}
                title="Randomized from the collection"
                traits={collectionTraits}
                editedIndexes={[1, 6]}
              />
            </div>
          </section>
        )}
      </div>
      {submission && isSubmitModalOpen && (
        <SubmitTraitToRoundModal
          address={address}
          artwork={artwork}
          isSigning={isSigning}
          rounds={eligibleRounds}
          roundsError={eligibleRoundsError?.message}
          roundsLoaded={Boolean(eligibleRoundsData)}
          signMessageAsync={signMessageAsync}
          submission={submission}
          traits={selectedTraits}
          onClose={() => setIsSubmitModalOpen(false)}
          onSubmitted={() => mutateEligibleRounds()}
        />
      )}
      {submission && isConnected && isCreator && isEditModalOpen && (
        <EditTraitModal
          address={address}
          artwork={artwork}
          isSigning={isSigning}
          signMessageAsync={signMessageAsync}
          submission={submission}
          onClose={() => setIsEditModalOpen(false)}
          onDeleted={async () => {
            await mutateSubmissions();
            await router.push("/noundry?tab=gallery");
          }}
          onSaved={async () => {
            await mutateSubmissions();
            setIsEditModalOpen(false);
          }}
        />
      )}
    </Layout>
  );
}

const EditTraitModal = ({
  address,
  artwork,
  isSigning,
  signMessageAsync,
  submission,
  onClose,
  onDeleted,
  onSaved,
}: {
  address?: string;
  artwork?: PlaygroundArtwork;
  isSigning: boolean;
  signMessageAsync: (args: { message: string }) => Promise<string>;
  submission: NoundrySubmission;
  onClose: () => void;
  onDeleted: () => Promise<void>;
  onSaved: () => Promise<void>;
}) => {
  const [title, setTitle] = useState(submission.title);
  const [traitType, setTraitType] = useState(submission.traitType);
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const traitTypes = useMemo(
    () =>
      Array.from(
        new Set([
          submission.traitType,
          ...(artwork?.orderedLayers
            .map((layer) => layer.trait)
            .filter((trait) => trait !== "glasses") || []),
        ])
      ),
    [artwork?.orderedLayers, submission.traitType]
  );
  const isBusy = isSigning || isSaving || isDeleting;

  const sendRequest = async (method: "PATCH" | "DELETE") => {
    if (!address) throw new Error("Wallet not connected.");

    const path = `/api/noundry/submissions/${submission.id}`;
    const payload =
      method === "PATCH"
        ? { submission: { title: title.trim(), traitType } }
        : {};
    const authorization = await createSignedRequestAuthHeader({
      walletAddress: address,
      chainId: ROUND_SIGNED_REQUEST_CHAIN_ID,
      action: getNoundryAuthorSignedRequestAction(
        method === "DELETE" ? "delete" : "update"
      ),
      method,
      path,
      payload,
      signMessageAsync,
    });
    const response = await fetch(path, {
      method,
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(result.error || "Unable to update trait.");
    }
  };

  const save = async () => {
    if (!title.trim()) {
      setMessage("A trait name is required.");
      return;
    }

    try {
      setIsSaving(true);
      setMessage("");
      await sendRequest("PATCH");
      await onSaved();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to update trait."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const deleteTrait = async () => {
    try {
      setIsDeleting(true);
      setMessage("");
      await sendRequest("DELETE");
      await onDeleted();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to delete trait."
      );
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-trait-title"
      onClick={isBusy ? undefined : onClose}
    >
      <div
        className="w-full max-w-[520px] rounded-2xl border border-skin-stroke bg-white p-6 shadow-[0px_6px_0px_0px_rgb(var(--color-shadow-neutral))]"
        onClick={(event) => event.stopPropagation()}
      >
        <h2
          id="edit-trait-title"
          className="font-heading text-4xl leading-none text-skin-base"
        >
          Edit trait
        </h2>
        <p className="mt-3 text-sm leading-snug text-secondary">
          Only the name and trait type can be changed. The submitted artwork,
          artist wallet, and preview composition stay locked.
        </p>

        <div className="mt-6 flex flex-col gap-4">
          <label className="font-heading text-base text-skin-base">
            Trait name
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={80}
              disabled={isBusy}
              className="mt-2 w-full rounded-xl border border-skin-stroke bg-white px-4 py-3 font-sans text-base text-skin-base focus:outline-none focus:ring-2 focus:ring-skin-highlighted disabled:opacity-60"
            />
          </label>
          <label className="font-heading text-base text-skin-base">
            Trait type
            <select
              value={traitType}
              onChange={(event) => setTraitType(event.target.value)}
              disabled={isBusy}
              className="mt-2 w-full rounded-xl border border-skin-stroke bg-white px-4 py-3 font-sans text-base text-skin-base focus:outline-none focus:ring-2 focus:ring-skin-highlighted disabled:opacity-60"
            >
              {traitTypes.map((type) => (
                <option key={type} value={type}>
                  {getLayerLabel(type)}
                </option>
              ))}
            </select>
          </label>
        </div>

        {message && (
          <p className="mt-4 rounded-xl border border-[#e4a09f] bg-[#fff0f0] p-3 text-sm text-[#8f1d1b]">
            {message}
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-skin-stroke pt-5">
          <div>
            {!isConfirmingDelete ? (
              <button
                type="button"
                onClick={() => setIsConfirmingDelete(true)}
                disabled={isBusy}
                className="font-heading text-sm text-[#b42320] underline decoration-2 underline-offset-4 disabled:opacity-50"
              >
                Delete trait
              </button>
            ) : (
              <button
                type="button"
                onClick={deleteTrait}
                disabled={isBusy}
                className="rounded-xl border border-[#8f1d1b] bg-[#d63230] px-4 py-2 font-heading text-sm text-white disabled:opacity-50"
              >
                {isDeleting || isSigning
                  ? "Confirm in wallet..."
                  : "Confirm delete"}
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isBusy}
              className="rounded-xl border border-skin-stroke bg-white px-4 py-2 font-heading text-sm text-skin-base disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={isBusy || !title.trim()}
              className="rounded-xl border border-[#0f5f99] bg-[#1d9bf0] px-4 py-2 font-heading text-sm text-white shadow-[0px_3px_0px_0px_#0f5f99] transition hover:-translate-y-0.5 hover:bg-[#45adf5] active:translate-y-1 active:shadow-none disabled:translate-y-0 disabled:opacity-50 disabled:shadow-none"
            >
              {isSaving || isSigning ? "Confirm in wallet..." : "Save metadata"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const SubmitTraitToRoundModal = ({
  address,
  artwork,
  isSigning,
  rounds,
  roundsError,
  roundsLoaded,
  signMessageAsync,
  submission,
  traits,
  onClose,
  onSubmitted,
}: {
  address?: string;
  artwork?: PlaygroundArtwork;
  isSigning: boolean;
  rounds: Round[];
  roundsError?: string;
  roundsLoaded: boolean;
  signMessageAsync: (args: { message: string }) => Promise<string>;
  submission: NoundrySubmission;
  traits: Record<string, string>;
  onClose: () => void;
  onSubmitted: () => void;
}) => {
  const [step, setStep] = useState<"select" | "details">("select");
  const [selectedSlug, setSelectedSlug] = useState(rounds[0]?.slug || "");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const selectedRound = rounds.find((round) => round.slug === selectedSlug);
  const submittedTraitBase = useMemo(
    () =>
      traits[submission.traitType]
        ? { [submission.traitType]: traits[submission.traitType] }
        : {},
    [submission.traitType, traits]
  );
  const generatedTraits = useMemo(
    () =>
      artwork
        ? Array.from({ length: 4 }, (_, index) =>
            buildRandomTraits(
              artwork,
              `${submission.id}-round-generated-${index}`,
              submittedTraitBase
            )
          )
        : [],
    [artwork, submission.id, submittedTraitBase]
  );
  const collectionTraits = useMemo(
    () =>
      artwork
        ? Array.from({ length: 4 }, (_, index) =>
            buildRandomTraits(
              artwork,
              `${submission.id}-round-collection-${index}`
            )
          )
        : [],
    [artwork, submission.id]
  );

  useEffect(() => {
    if (!selectedSlug && rounds[0]?.slug) {
      setSelectedSlug(rounds[0].slug);
    }
  }, [rounds, selectedSlug]);

  const continueToDetails = () => {
    if (!selectedRound) {
      setMessage(
        rounds.length > 0
          ? "Choose a round first."
          : "There are no active trait rounds accepting this submission right now."
      );
      return;
    }

    setMessage("");
    setStep("details");
  };

  const submit = async () => {
    if (!address) {
      setMessage("Wallet not connected.");
      return;
    }
    if (!selectedRound) {
      setMessage("Choose a round first.");
      return;
    }

    try {
      setIsSubmitting(true);
      setMessage("");
      const path = `/api/rounds/${selectedRound.slug}/submit-trait`;
      const payload = {
        traitId: submission.id,
        description,
      };
      const authorization = await createSignedRequestAuthHeader({
        walletAddress: address,
        chainId: ROUND_SIGNED_REQUEST_CHAIN_ID,
        action: getRoundSignedRequestAction("submit-trait"),
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

      setMessage(
        "Trait submitted successfully. It is now visible on the round page."
      );
      onSubmitted();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to submit trait."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="submit-trait-round-title"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-[620px] overflow-y-auto rounded-2xl border border-skin-stroke bg-white p-6 shadow-[0px_6px_0px_0px_rgb(var(--color-shadow-neutral))]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2
            id="submit-trait-round-title"
            className="font-heading text-4xl leading-none text-skin-base"
          >
            Submit trait to a round
          </h2>
          <div className="rounded-full bg-[#fff7bf] px-3 py-1 font-heading text-xs uppercase text-secondary">
            {step === "select" ? "Choose round" : "Preview"}
          </div>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-[160px_1fr]">
          <div className="overflow-hidden rounded-2xl border border-skin-stroke bg-[#d7d9e4] p-4">
            <NounPreviewTile
              artwork={artwork}
              submission={submission}
              traits={traits}
              showEditedTrait
            />
          </div>
          <div>
            <div className="font-heading text-2xl leading-none text-skin-base">
              {submission.title}
            </div>
            <div className="mt-2 text-sm text-secondary">
              {getLayerLabel(submission.traitType)}
            </div>
            <p className="mt-4 rounded-xl border border-skin-stroke bg-[#fff7bf] p-3 text-sm leading-snug text-secondary">
              This submits the canonical Noundry trait record to the selected
              round.
            </p>
          </div>
        </div>

        {step === "select" && (
          <div className="mt-5 flex flex-col gap-4">
            {!roundsLoaded && rounds.length === 0 && (
              <p className="rounded-xl border border-skin-stroke bg-[#fff7bf] p-4 text-sm text-secondary">
                Loading eligible rounds...
              </p>
            )}
            {roundsError && (
              <p className="rounded-xl border border-skin-stroke bg-[#fff7bf] p-4 text-sm text-skin-proposal-danger">
                {roundsError}
              </p>
            )}
            {rounds.length > 0 ? (
              <label className="block font-heading text-base text-skin-base">
                Eligible round
                <select
                  value={selectedSlug}
                  onChange={(event) => setSelectedSlug(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-skin-stroke bg-white px-4 py-3 font-sans text-base text-skin-base focus:outline-none focus:ring-2 focus:ring-skin-highlighted"
                >
                  {rounds.map((round) => (
                    <option key={round.id} value={round.slug}>
                      {round.title}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              roundsLoaded &&
              !roundsError && (
                <p className="rounded-xl border border-dashed border-skin-stroke bg-[#fff7bf] p-4 text-secondary">
                  There are no active trait contests accepting this submission
                  right now.
                </p>
              )
            )}
          </div>
        )}

        {step === "details" && selectedRound && (
          <div className="mt-5 flex flex-col gap-5">
            <div className="rounded-xl border border-skin-stroke bg-[#fff7bf] p-3 text-sm text-secondary">
              Submitting to{" "}
              <span className="font-heading text-skin-base">
                {selectedRound.title}
              </span>
            </div>
            <label className="block font-heading text-base text-skin-base">
              Submission description
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={4}
                placeholder="Describe why this trait fits the round."
                className="mt-2 w-full rounded-xl border border-skin-stroke bg-white px-4 py-3 font-sans text-base text-skin-base focus:outline-none focus:ring-2 focus:ring-skin-highlighted"
              />
              <span className="mt-1 block font-sans text-xs text-secondary">
                {selectedRound.minDescriptionLength}-
                {selectedRound.maxDescriptionLength} characters. If left blank,
                Yellow will use a Noundry-generated description.
              </span>
            </label>
            <RoundTraitPreviewGrid
              artwork={artwork}
              submission={submission}
              title="Generated with this trait"
              traits={generatedTraits}
              showEditedTrait
            />
            <RoundTraitPreviewGrid
              artwork={artwork}
              submission={submission}
              title="Randomized from the collection"
              traits={collectionTraits}
              showEditedTrait={false}
            />
          </div>
        )}

        {message && (
          <p className="mt-4 rounded-xl border border-skin-stroke bg-[#fff7bf] p-3 text-sm text-secondary">
            {message}
          </p>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {step === "select" ? (
            <button
              type="button"
              onClick={continueToDetails}
              disabled={!selectedRound}
              className="rounded-[18px] bg-accent px-5 py-3 font-heading text-lg text-skin-base shadow-[0px_4.02px_0px_0px_#b89400] transition hover:-translate-y-0.5 hover:bg-[#ffd84d] active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              Okay
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={submit}
                disabled={!selectedRound || isSubmitting || isSigning}
                className="rounded-[18px] bg-accent px-5 py-3 font-heading text-lg text-skin-base shadow-[0px_4.02px_0px_0px_#b89400] transition hover:-translate-y-0.5 hover:bg-[#ffd84d] active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting || isSigning
                  ? "Submitting..."
                  : "Submit to round"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMessage("");
                  setStep("select");
                }}
                className="rounded-[18px] border border-skin-stroke bg-white px-5 py-3 font-heading text-lg text-skin-base shadow-[0px_4.02px_0px_0px_rgb(var(--color-shadow-neutral))] transition hover:-translate-y-0.5 hover:bg-[#fff7bf] active:translate-y-1 active:shadow-none"
              >
                Back
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-[18px] border border-skin-stroke bg-white px-5 py-3 font-heading text-lg text-skin-base shadow-[0px_4.02px_0px_0px_rgb(var(--color-shadow-neutral))] transition hover:-translate-y-0.5 hover:bg-[#fff7bf] active:translate-y-1 active:shadow-none"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

const RoundTraitPreviewGrid = ({
  artwork,
  submission,
  title,
  traits,
  showEditedTrait,
}: {
  artwork?: PlaygroundArtwork;
  submission: NoundrySubmission;
  title: string;
  traits: Record<string, string>[];
  showEditedTrait: boolean;
}) => (
  <section className="rounded-2xl border border-skin-stroke bg-[#f7f7f7] p-3">
    <h3 className="mb-3 font-heading text-base leading-none text-skin-base">
      {title}
    </h3>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {traits.map((traitSet, index) => (
        <NounPreviewTile
          key={`${title}-${index}`}
          artwork={artwork}
          submission={submission}
          traits={traitSet}
          showEditedTrait={showEditedTrait}
        />
      ))}
    </div>
  </section>
);

const NounGridSection = ({
  artwork,
  submission,
  title,
  traits,
  editedIndexes,
}: {
  artwork?: PlaygroundArtwork;
  submission: NoundrySubmission;
  title: string;
  traits: Record<string, string>[];
  editedIndexes: number[];
}) => (
  <section className="yc-dark-yellow-surface rounded-none border-y-4 border-skin-stroke bg-white px-5 py-6 shadow-sm">
    <div className="mb-4 flex items-center justify-between gap-4">
      <h2 className="font-heading text-2xl leading-none text-skin-base">
        {title}
      </h2>
      <Link
        href={getTraitPath(submission.id)}
        className="font-heading text-xs uppercase text-secondary"
      >
        Noundry
      </Link>
    </div>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {traits.map((traitSet, index) => (
        <NounPreviewTile
          key={`${title}-${index}`}
          artwork={artwork}
          submission={submission}
          traits={traitSet}
          showEditedTrait={editedIndexes.includes(index)}
        />
      ))}
    </div>
  </section>
);
