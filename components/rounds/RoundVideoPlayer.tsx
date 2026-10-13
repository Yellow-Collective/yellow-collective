import { useEffect, useState } from "react";
export function RoundVideoPlayer({
  slug,
  id,
  poster,
  title,
}: {
  slug: string;
  id: string;
  poster: string;
  title: string;
}) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    setUrl("");
    setError("");
  }, [slug, id]);
  const load = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/rounds/${encodeURIComponent(slug)}/video-playback?id=${encodeURIComponent(id)}`,
        { cache: "no-store", signal: AbortSignal.timeout(15000) }
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Unable to load video.");
      setUrl(result.url);
    } catch {
      setError("Unable to play video. Retry to refresh the playback link.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="my-4 space-y-2">
      {url && (
        <video
          className="max-h-[70vh] w-full rounded-xl"
          controls
          playsInline
          preload="none"
          poster={poster}
          src={url}
          aria-label={`${title} video`}
          onError={() =>
            setError(
              "Playback interrupted. Refresh the playback link to try again."
            )
          }
        />
      )}
      <button
        type="button"
        disabled={busy}
        className="rounded-xl border border-skin-stroke px-4 py-2"
        onClick={load}
      >
        {busy
          ? "Loading video..."
          : url
            ? "Refresh video playback"
            : "Open video player"}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
