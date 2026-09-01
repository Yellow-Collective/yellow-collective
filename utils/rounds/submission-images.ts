export const ROUND_SUBMISSION_MAX_IMAGES = 10;
export const ROUND_SUBMISSION_MAX_TOTAL_IMAGE_BYTES = 7 * 1024 * 1024;

type SubmissionImagesInput = {
  image?: unknown;
  images?: unknown;
};

export const normalizeRoundSubmissionImages = ({
  image,
  images,
}: SubmissionImagesInput): string[] => {
  const normalizedImages = Array.isArray(images)
    ? images.map((value) => String(value || "").trim()).filter(Boolean)
    : [];

  if (normalizedImages.length > 0) return normalizedImages;

  const legacyImage = String(image || "").trim();
  return legacyImage ? [legacyImage] : [];
};

export const getRoundSubmissionImagesPayloadBytes = (images: string[]) =>
  images.reduce((total, image) => total + image.length, 0);

export const getRoundSubmissionImagesValidationError = (images: string[]) => {
  if (images.length === 0) return "At least one image is required.";

  if (images.length > ROUND_SUBMISSION_MAX_IMAGES) {
    return `Choose up to ${ROUND_SUBMISSION_MAX_IMAGES} images.`;
  }

  if (
    getRoundSubmissionImagesPayloadBytes(images) >
    ROUND_SUBMISSION_MAX_TOTAL_IMAGE_BYTES
  ) {
    return "The combined image size is too large. Remove an image or choose smaller files.";
  }

  return undefined;
};
