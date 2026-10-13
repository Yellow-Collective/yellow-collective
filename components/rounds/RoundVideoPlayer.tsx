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
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = setTimeout(() => controller.abort(), 15000);
    setUrl("");
    setError("");
    setBusy(true);
    const load = async () => {
      try {
        const response = await fetch(
          `/api/rounds/${encodeURIComponent(slug)}/video-playback?id=${encodeURIComponent(id)}`,
          { cache: "no-store", signal: controller.signal }
        );
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error || "Unable to load video.");
        if (typeof result.url !== "string" || !result.url)
          throw new Error("Missing playback link.");
        if (active) setUrl(result.url);
      } catch {
        if (active)
          setError("Unable to play video. Retry to refresh the playback link.");
      } finally {
        clearTimeout(timeout);
        if (active) setBusy(false);
      }
    };
    void load();
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [slug, id, attempt]);
  return (
    <div className="my-4 space-y-2">
      <video
        className="max-h-[70vh] w-full rounded-xl"
        controls
        playsInline
        preload="none"
        poster={poster}
        src={url || undefined}
        aria-label={`${title} video`}
        onError={() =>
          setError(
            "Playback interrupted. Refresh the playback link to try again."
          )
        }
      />
      {busy && <p role="status">Loading video...</p>}
      {error && (
        <>
          <button
            type="button"
            disabled={busy}
            className="rounded-xl border border-skin-stroke px-4 py-2"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Retry video playback
          </button>
          <p role="alert">{error}</p>
        </>
      )}
    </div>
  );
}
