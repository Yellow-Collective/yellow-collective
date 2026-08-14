import type { ChangeEvent } from "react";
import {
  ROUND_IMAGE_UPLOAD_ACCEPT,
  resizeRoundImageFile,
} from "@/utils/rounds/round-image-upload";

type RoundImageUploadFieldProps = {
  value: string;
  onChange: (value: string) => void;
  onError: (message: string) => void;
  required?: boolean;
  showUrlInput?: boolean;
  label?: string;
  note?: string;
  className?: string;
  labelClassName?: string;
  inputClassName?: string;
};

const defaultInputClassName =
  "w-full rounded-xl border border-skin-stroke bg-skin-muted px-4 py-3 text-base text-skin-base placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-skin-highlighted";

export default function RoundImageUploadField({
  value,
  onChange,
  onError,
  required = false,
  showUrlInput = false,
  label = "Image",
  note = "Image for the Round preview and banner.",
  className = "",
  labelClassName = "font-heading text-base text-skin-base",
  inputClassName = defaultInputClassName,
}: RoundImageUploadFieldProps) {
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
    <div className={className}>
      <div className={labelClassName}>
        {label}
        {required ? " *" : ""}
      </div>
      <div className="mt-2 flex flex-col gap-3">
        {showUrlInput ? (
          <input
            type="text"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="https://example.com/round-image.png"
            required={required}
            aria-label="Image URL"
            className={inputClassName}
          />
        ) : null}
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
            {value ? (
              <button
                type="button"
                onClick={() => onChange("")}
                className="yc-dark-reset-red yc-dark-reset-white-hover rounded-[18px] border border-skin-stroke bg-white px-5 py-3 font-heading text-base text-skin-base shadow-[0px_4.02px_0px_0px_rgb(var(--color-shadow-neutral))] transition hover:-translate-y-0.5 hover:bg-[#fff7bf] active:translate-y-1 active:shadow-none"
              >
                Remove
              </button>
            ) : null}
          </div>
          {note ? (
            <p className="max-w-[260px] text-sm leading-snug text-secondary">
              {note}
            </p>
          ) : null}
        </div>
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt="Round preview"
            className="aspect-[16/9] w-full rounded-lg border border-skin-stroke bg-white object-cover"
          />
        ) : null}
      </div>
    </div>
  );
}
