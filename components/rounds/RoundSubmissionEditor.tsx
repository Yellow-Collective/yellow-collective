import type { Round, RoundSubmission } from "data/rounds";
import { useEffect, useRef, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { SubmissionImagesField } from "./SubmissionImagesField";
import { appendRoundSubmissionImages } from "@/utils/rounds/submission-images";
import { canEditRoundSubmission } from "@/utils/rounds/submission-edit";
import { getRoundSignedRequestAction } from "@/utils/rounds/auth";
import { createSignedRequestAuthHeader } from "@/utils/signature-auth-client";
import { TOKEN_NETWORK } from "constants/addresses";

type OwnSummary = Pick<
  RoundSubmission,
  "id" | "title" | "status" | "walletAddress" | "userEditedAt"
>;
const emptyDraft = {
  title: "",
  description: "",
  images: [] as string[],
  url: "",
};

export const RoundSubmissionEditor = ({
  round,
  submissionId,
}: {
  round: Round;
  submissionId?: string;
}) => {
  const { address, status, connector } = useAccount();
  const walletReady = Boolean(address && status === "connected" && connector);
  const { signMessageAsync } = useSignMessage();
  const walletRef = useRef(address);
  walletRef.current = address;
  const draftOwner = useRef(address?.toLowerCase());
  const draftRoute = useRef(`${round.slug}:${submissionId || ""}`);
  const operation = useRef(0);
  const inFlight = useRef(false);
  const context = `${round.slug}:${submissionId || ""}:${address || ""}:${status}`;
  const previousContext = useRef(context);
  if (previousContext.current !== context) {
    operation.current++;
    inFlight.current = false;
    previousContext.current = context;
  }
  const [submissions, setSubmissions] = useState<OwnSummary[] | null>(null);
  const [submission, setSubmission] = useState<RoundSubmission | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const route = `${round.slug}:${submissionId || ""}`;
    const owner = address?.toLowerCase();
    if (
      draftRoute.current !== route ||
      (owner && draftOwner.current !== owner)
    ) {
      setSubmissions(null);
      setSubmission(null);
      setDraft(emptyDraft);
      setMessage("");
    }
    if (owner) draftOwner.current = owner;
    draftRoute.current = route;
    setBusy(false);
  }, [address, status, submissionId, round.slug]);
  useEffect(
    () => () => {
      operation.current++;
    },
    []
  );

  const request = async (
    path: string,
    method: "GET" | "PATCH",
    payload: Record<string, unknown> = {}
  ) => {
    if (!address || !walletReady)
      throw new Error(
        "Reconnect the wallet that submitted this entry using the wallet button, then try again."
      );
    const requestedWallet = address;
    const requestedOperation = operation.current;
    setMessage(
      method === "PATCH"
        ? "Confirm the signature in your wallet to save your one-time edit."
        : "Confirm the signature in your wallet to load your submission."
    );
    const authorization = await createSignedRequestAuthHeader({
      walletAddress: address,
      chainId: Number(TOKEN_NETWORK),
      action: getRoundSignedRequestAction(
        method === "GET" ? "submission-read" : "edit"
      ),
      method,
      path,
      payload,
      signMessageAsync,
      bounded: true,
    });
    if (
      walletRef.current !== requestedWallet ||
      operation.current !== requestedOperation
    )
      throw new Error("Wallet changed. Load your submission again.");
    const response = await fetch(path, {
      method,
      headers: {
        Authorization: authorization,
        ...(method === "PATCH" ? { "Content-Type": "application/json" } : {}),
      },
      cache: "no-store",
      ...(method === "PATCH" ? { body: JSON.stringify(payload) } : {}),
      signal: AbortSignal.timeout(30000),
    });
    const data = await response.json();
    if (
      walletRef.current !== requestedWallet ||
      operation.current !== requestedOperation
    )
      throw new Error("Wallet changed. Load your submission again.");
    if (!response.ok)
      throw new Error(data.error || "Unable to load or save this submission.");
    return data;
  };
  const apply = (saved: RoundSubmission) => {
    setSubmission(saved);
    setDraft({
      title: saved.title,
      description: saved.description,
      images: saved.images,
      url: saved.url,
    });
  };
  const load = async (id?: string) => {
    if (inFlight.current) return;
    inFlight.current = true;
    const attempt = ++operation.current;
    setBusy(true);
    try {
      if (id) {
        const data = await request(
          `/api/rounds/${round.slug}/submissions/${encodeURIComponent(id)}/edit`,
          "GET"
        );
        if (attempt !== operation.current) return;
        apply(data.submission);
        setMessage(
          data.submission.userEditedAt
            ? "Your one-time edit has already been used."
            : "Submission loaded. Review your changes before saving."
        );
      } else {
        const data = await request(
          `/api/rounds/${round.slug}/my-submissions`,
          "GET"
        );
        if (attempt !== operation.current) return;
        setSubmissions(data.submissions);
        setMessage(
          data.submissions.length
            ? "Choose a submission to edit."
            : "This wallet has no editable submissions in this round."
        );
      }
    } catch (error) {
      if (attempt !== operation.current) return;
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load your submission."
      );
    } finally {
      if (attempt === operation.current) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  };
  const editable = Boolean(
    walletReady &&
    submission &&
    canEditRoundSubmission(round, submission, address, new Date(now))
  );
  const changed = Boolean(
    submission &&
    (draft.title !== submission.title ||
      draft.description !== submission.description ||
      draft.url !== submission.url ||
      JSON.stringify(draft.images) !== JSON.stringify(submission.images))
  );
  const save = async () => {
    if (
      !submission ||
      !editable ||
      !changed ||
      busy ||
      uploading ||
      inFlight.current
    )
      return;
    if (
      !window.confirm(
        "You can edit this submission only once. Saving will use your one-time edit, and you will not be able to edit it again. Save these edits?"
      )
    )
      return;
    inFlight.current = true;
    const attempt = ++operation.current;
    setBusy(true);
    try {
      const changes = {
        title: draft.title,
        description: draft.description,
        url: draft.url,
        ...(JSON.stringify(draft.images) !== JSON.stringify(submission.images)
          ? { images: draft.images }
          : {}),
      };
      const data = await request(
        `/api/rounds/${round.slug}/submissions/${encodeURIComponent(submission.id)}/edit`,
        "PATCH",
        { submission: changes }
      );
      if (attempt !== operation.current) return;
      apply(data.submission);
      setMessage("Edits saved. Your one-time edit has now been used.");
    } catch (error) {
      if (attempt !== operation.current) return;
      setMessage(
        `${error instanceof Error ? error.message : "Unable to save edits."} Reload the saved submission to check its status before trying again.`
      );
    } finally {
      if (attempt === operation.current) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  };
  const controlClass =
    "mt-2 w-full rounded-xl border border-skin-stroke bg-skin-muted px-4 py-3 text-base text-skin-base disabled:opacity-60";
  const buttonClass =
    "rounded-xl border border-skin-stroke bg-accent px-5 py-3 font-heading text-skin-base disabled:cursor-not-allowed disabled:opacity-50";
  return (
    <section className="yc-dark-yellow-form-surface rounded-2xl border border-skin-stroke bg-white p-5 md:p-7">
      <h1 className="font-heading text-3xl">Edit your submission</h1>
      <p className="mt-3 rounded-xl border border-skin-stroke bg-[#fff7bf] p-4 text-skin-base">
        You can edit each submission only once, before voting begins. Saving
        your edits uses this one-time opportunity. Existing video and source
        trait stay unchanged.
      </p>
      {!walletReady && (
        <p className="mt-4" role="status">
          Connect or reconnect the wallet that submitted your entry using the
          wallet button. Wait for the connection to finish before loading.
        </p>
      )}
      <button
        type="button"
        className="yc-dark-submit-blue mt-4 inline-flex items-center justify-center rounded-xl bg-[#1d9bf0] px-5 py-3 font-heading text-white shadow-[0px_4.02px_0px_0px_#0f5f99] transition enabled:hover:bg-[#45adf5] motion-safe:enabled:hover:-translate-y-0.5 motion-safe:enabled:active:translate-y-1 enabled:active:!shadow-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 disabled:!shadow-none"
        disabled={!walletReady || busy || uploading}
        onClick={() => load(submission?.id || submissionId)}
      >
        {busy
          ? "Waiting for wallet or request..."
          : submission
            ? "Reload saved submission"
            : submissionId
              ? "Load my submission"
              : "Load my submissions"}
      </button>
      {submissions &&
        address?.toLowerCase() === draftOwner.current &&
        draftRoute.current === `${round.slug}:${submissionId || ""}` && (
          <ul className="mt-4 space-y-2">
            {submissions.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={buttonClass}
                  disabled={busy || uploading}
                  onClick={() => load(item.id)}
                >
                  {item.title} ({item.status})
                  {item.userEditedAt ? " (edit used)" : ""}
                </button>
              </li>
            ))}
          </ul>
        )}
      {submission &&
        address?.toLowerCase() === submission.walletAddress.toLowerCase() &&
        draftRoute.current === `${round.slug}:${submissionId || ""}` && (
          <div className="mt-5 space-y-4">
            {!editable && (
              <p role="status">
                {submission.userEditedAt
                  ? "Your one-time edit has already been used."
                  : "Editing is unavailable. Voting may have begun or this entry is no longer eligible."}
              </p>
            )}
            <fieldset
              disabled={!editable || busy || uploading}
              className="space-y-4"
            >
              <label className="block font-heading">
                Title
                <input
                  className={controlClass}
                  value={draft.title}
                  minLength={round.minTitleLength}
                  maxLength={round.maxTitleLength}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="block font-heading">
                Description
                <textarea
                  className={controlClass}
                  rows={6}
                  value={draft.description}
                  minLength={round.minDescriptionLength}
                  maxLength={round.maxDescriptionLength}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                />
              </label>
              {submission.submissionType !== "trait" && (
                <label className="block font-heading">
                  Submission URL (optional)
                  <input
                    className={controlClass}
                    value={draft.url}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        url: event.target.value,
                      }))
                    }
                  />
                </label>
              )}
            </fieldset>
            {submission.submissionType === "trait" ? (
              <p className="text-sm text-secondary">
                Trait edits can change title and description. The canonical
                artwork, link and source stay unchanged.
              </p>
            ) : (
              <fieldset disabled={!editable || busy}>
                <SubmissionImagesField
                  images={draft.images}
                  placeholder="https://example.com/image.gif"
                  isUploading={uploading || busy || !editable}
                  onUploadingChange={setUploading}
                  onError={setMessage}
                  onAdd={(added) =>
                    setDraft((current) => ({
                      ...current,
                      images: appendRoundSubmissionImages(
                        current.images,
                        added
                      ),
                    }))
                  }
                  onRemove={(index) =>
                    setDraft((current) => ({
                      ...current,
                      images: current.images.filter(
                        (_, imageIndex) => imageIndex !== index
                      ),
                    }))
                  }
                />
              </fieldset>
            )}
            <button
              type="button"
              className={buttonClass}
              disabled={
                !editable ||
                !changed ||
                busy ||
                uploading ||
                !draft.images.length
              }
              onClick={save}
            >
              {busy ? "Saving..." : "Save edits"}
            </button>
          </div>
        )}
      <p
        className="mt-4 text-sm text-secondary"
        role="status"
        aria-live="polite"
      >
        {message}
      </p>
    </section>
  );
};
