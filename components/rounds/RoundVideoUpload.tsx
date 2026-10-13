import { useEffect, useRef, useState } from "react";
import { ROUND_VIDEO_MAX_BYTES } from "@/utils/rounds/video-policy";
type Props = {
  slug: string;
  wallet?: string;
  disabled: boolean;
  request: (
    operation: "reserve" | "finalize" | "cancel",
    id?: string
  ) => Promise<any>;
  onChange: (id: string) => void;
  onBusy: (busy: boolean) => void;
};
export function RoundVideoUpload({
  slug,
  wallet,
  disabled,
  request,
  onChange,
  onBusy,
}: Props) {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [id, setId] = useState("");
  const [fileName, setFileName] = useState("");
  const fileInput = useRef<HTMLInputElement | null>(null);
  const xhr = useRef<XMLHttpRequest | null>(null);
  const generation = useRef(0);
  const previousWallet = useRef(wallet);
  useEffect(() => {
    fetch(`/api/rounds/${encodeURIComponent(slug)}/videos`)
      .then((r) => r.json())
      .then((result) => setEnabled(result.enabled === true))
      .catch(() => setEnabled(false));
  }, [slug]);
  useEffect(() => {
    if (previousWallet.current !== wallet) {
      generation.current++;
      xhr.current?.abort();
      setId("");
      setFileName("");
      onChange("");
      setBusy(false);
      onBusy(false);
      setMessage("");
      previousWallet.current = wallet;
    }
  }, [wallet, onChange, onBusy]);
  useEffect(
    () => () => {
      generation.current++;
      xhr.current?.abort();
    },
    []
  );
  const upload = async (file: File) => {
    if (
      file.size < 1 ||
      file.size > ROUND_VIDEO_MAX_BYTES ||
      !file.name.toLowerCase().endsWith(".mp4")
    ) {
      setMessage("Choose an MP4 up to 100 MiB.");
      return;
    }
    const attempt = ++generation.current;
    setFileName(file.name);
    setBusy(true);
    onBusy(true);
    onChange("");
    setMessage("Confirm the upload authorization in your wallet.");
    setProgress(0);
    try {
      if (id) await request("cancel", id);
      const reservation = await request("reserve");
      if (attempt !== generation.current) return;
      setId(reservation.id);
      setMessage("Uploading video...");
      const form = new FormData();
      Object.entries(reservation.upload.fields).forEach(([key, value]) =>
        form.append(key, String(value))
      );
      form.append("file", file);
      await new Promise<void>((resolve, reject) => {
        const upload = new XMLHttpRequest();
        xhr.current = upload;
        upload.open("POST", reservation.upload.url);
        upload.timeout = 300000;
        upload.upload.onprogress = (event) => {
          if (event.lengthComputable)
            setProgress(Math.round((event.loaded / event.total) * 100));
        };
        upload.onload = () =>
          upload.status >= 200 && upload.status < 300
            ? resolve()
            : reject(
                new Error("Upload failed. Select the file again to retry.")
              );
        upload.onerror = () =>
          reject(new Error("Upload failed. Check your connection and retry."));
        upload.ontimeout = () =>
          reject(new Error("Upload timed out. Retry with a smaller file."));
        upload.onabort = () => reject(new Error("Upload cancelled."));
        upload.send(form);
      });
      if (attempt !== generation.current) return;
      setMessage("Confirm the validation request in your wallet.");
      await request("finalize", reservation.id);
      if (attempt === generation.current) {
        onChange(reservation.id);
        setMessage("Video ready. Submit your entry to publish it.");
      }
    } catch (error) {
      if (attempt === generation.current)
        setMessage(
          error instanceof Error ? error.message : "Video upload failed."
        );
    } finally {
      if (attempt === generation.current) {
        setBusy(false);
        onBusy(false);
      }
    }
  };
  const cancel = async () => {
    generation.current++;
    xhr.current?.abort();
    setBusy(false);
    onBusy(false);
    onChange("");
    setFileName("");
    setMessage(
      "Video removed. Confirm cancellation to release the reservation."
    );
    try {
      if (id) await request("cancel", id);
      setId("");
    } catch {
      setMessage(
        "Video removed from this entry. Its upload reservation will expire automatically."
      );
    }
  };
  if (!enabled) return null;
  return (
    <fieldset className="min-w-0">
      <legend className="font-heading text-base text-skin-base">
        Optional video
      </legend>
      <p id="round-video-help" className="mt-1 text-sm text-secondary">
        One MP4, H.264 video with optional AAC audio, up to 100 MiB and two
        minutes. Add a separate cover image above. Your wallet authorizes upload
        and validation; this sends no transaction.
      </p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <div className="min-w-0 flex-1 rounded-xl border border-skin-stroke bg-skin-muted px-4 py-3 text-base text-skin-base">
          <p className="truncate" title={fileName || undefined}>
            {fileName || "Choose an MP4 video"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={disabled || busy || !wallet}
          aria-describedby="round-video-help"
          className="yc-dark-submit-blue flex w-fit items-center justify-center rounded-[18px] border border-transparent bg-[#1d9bf0] px-5 py-3 font-heading text-base text-white shadow-[0px_4.02px_0px_0px_#0f5f99] transition-[background-color,box-shadow] hover:bg-[#45adf5] motion-safe:enabled:active:translate-y-1 active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-skin-highlighted focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy
            ? "Processing video..."
            : fileName
              ? "Replace video"
              : "Upload video"}
        </button>
      </div>
      <input
        ref={fileInput}
        id="round-video"
        type="file"
        className="hidden"
        accept="video/mp4,.mp4"
        disabled={disabled || busy || !wallet}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void upload(file);
        }}
      />
      {busy && (
        <progress
          max={100}
          value={progress}
          aria-label="Video upload progress"
          className="mt-3 block h-2 w-full accent-[#1d9bf0]"
        />
      )}
      {id && (
        <button
          type="button"
          onClick={cancel}
          className="yc-dark-yellow-button mt-3 rounded-[18px] border border-skin-stroke bg-white px-5 py-3 font-heading text-base text-skin-base shadow-[0px_4.02px_0px_0px_rgb(var(--color-shadow-neutral))] transition-[background-color,box-shadow] hover:bg-[#fff7bf] motion-safe:enabled:active:translate-y-1 active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-skin-highlighted"
        >
          {busy ? "Cancel video upload" : "Remove video"}
        </button>
      )}
      <p
        role="status"
        aria-live="polite"
        className="mt-3 text-sm text-secondary"
      >
        {message}
      </p>
    </fieldset>
  );
}
