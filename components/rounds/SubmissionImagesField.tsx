import { useState, type ChangeEvent } from "react";
import { normalizeSafeImageUrl } from "@/utils/url-safety";
import {
  ROUND_IMAGE_UPLOAD_ACCEPT,
  resizeRoundImageFile,
} from "@/utils/rounds/round-image-upload";
import {
  appendRoundSubmissionImages,
  ROUND_SUBMISSION_MAX_IMAGES,
  getRoundSubmissionImagesValidationError,
  getRoundSubmissionGifValidationError,
} from "@/utils/rounds/submission-images";

export const SubmissionImagesField = ({
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
    const safeValue = normalizeSafeImageUrl(value, {
      allowDataImages: true,
      allowInternal: true,
    });
    if (!safeValue) {
      onError("Choose a valid image URL.");
      return;
    }
    const error =
      getRoundSubmissionImagesValidationError([...images, safeValue]) ||
      getRoundSubmissionGifValidationError([safeValue]);
    if (error) {
      onError(error);
      return;
    }
    onAdd([safeValue]);
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
      const imageError = getRoundSubmissionImagesValidationError(nextImages);
      if (imageError) throw new Error(imageError);
      const gifError = getRoundSubmissionGifValidationError(resizedImages);
      if (gifError) throw new Error(gifError);
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
        cover. Images stay in the order you add them. GIFs keep their animation
        (up to 1MB each); other files can be up to 8MB.
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
                src={normalizeSafeImageUrl(image, {
                  allowDataImages: true,
                  allowInternal: true,
                })}
                alt={`Submission preview ${index + 1}`}
                className="aspect-[16/9] w-full object-cover"
              />
              <div className="flex items-center justify-between gap-3 p-3">
                <span className="text-sm text-secondary">
                  {index === 0 ? "Cover image" : `Image ${index + 1}`}
                </span>
                <button
                  type="button"
                  disabled={isUploading}
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
