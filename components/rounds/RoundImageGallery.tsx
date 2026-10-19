import { useEffect, useState } from "react";
import { getRoundOriginalImage } from "@/utils/rounds/roundMediaPayload";

/** Only the selected original is mounted. Gallery controls never preload hidden images. */
export const RoundImageGallery = ({
  images,
  title,
}: {
  images: string[];
  title: string;
}) => {
  const [index, setIndex] = useState(0);
  const [retry, setRetry] = useState(0);
  const [loadedSource, setLoadedSource] = useState("");
  const [failedSource, setFailedSource] = useState("");
  const original = getRoundOriginalImage(images[index] || images[0] || "");
  const src = original && retry
    ? `${original}${original.includes("?") ? "&" : "?"}retry=${retry}`
    : original;

  useEffect(() => {
    setIndex(0);
    setRetry(0);
  }, [title]);

  if (!original) {
    return <p role="status" className="p-6 text-center text-secondary">Artwork is unavailable. Refresh the round to try again.</p>;
  }

  return (
    <section aria-label={`${title} gallery`} className="mx-auto mt-6 w-full max-w-[720px]">
      <div className="relative flex min-h-[240px] items-center justify-center overflow-hidden rounded-2xl border border-skin-stroke bg-[#fff7bf]">
        {loadedSource !== src && failedSource !== src && (
          <p role="status" className="absolute inset-0 flex items-center justify-center p-6 text-center text-secondary">Loading original artwork…</p>
        )}
        {failedSource === src ? (
          <div role="alert" className="flex min-h-[240px] flex-col items-center justify-center gap-4 p-6 text-center">
            <p>Unable to load this image. It may have been changed or removed.</p>
            <button type="button" onClick={() => setRetry((value) => value + 1)} className="rounded-lg border border-skin-stroke bg-white px-4 py-2 focus-visible:outline focus-visible:outline-2">Retry image</button>
          </div>
        ) : (
          // Keep the GIF original intact: browser decoding preserves every animation frame.
          // eslint-disable-next-line @next/next/no-img-element
          <img key={src} src={src} alt={`${title} image ${Math.min(index + 1, images.length)} of ${images.length}`} className="relative max-h-[520px] min-h-[240px] w-full object-contain" decoding="async" onLoad={() => setLoadedSource(src)} onError={() => setFailedSource(src)} />
        )}
      </div>
      {images.length > 1 && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2" aria-label="Choose gallery image">
          {images.map((_, imageIndex) => (
            <button key={imageIndex} type="button" aria-label={`Show image ${imageIndex + 1} of ${images.length}`} aria-pressed={index === imageIndex} onClick={() => { setIndex(imageIndex); setRetry(0); }} className={`min-h-10 min-w-10 rounded-lg border border-skin-stroke px-3 py-2 font-heading focus-visible:outline focus-visible:outline-2 ${index === imageIndex ? "bg-[#ffd84d] text-black" : "bg-white text-skin-base"}`}>
              {imageIndex + 1}
            </button>
          ))}
        </div>
      )}
    </section>
  );
};
