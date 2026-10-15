export const ROUND_SUBMISSION_MAX_IMAGES = 10;
export const ROUND_SUBMISSION_MAX_TOTAL_IMAGE_BYTES = 2.5 * 1024 * 1024;

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

export const appendRoundSubmissionImages = (
  currentImages: string[],
  addedImages: string[]
) => [...currentImages, ...addedImages].slice(0, ROUND_SUBMISSION_MAX_IMAGES);

export const getRoundSubmissionImagesValidationError = (images: string[]) => {
  if (images.length === 0) return "At least one image is required.";

  if (images.length > ROUND_SUBMISSION_MAX_IMAGES) {
    return `Choose up to ${ROUND_SUBMISSION_MAX_IMAGES} images.`;
  }

  if (
    getRoundSubmissionImagesPayloadBytes(images) >
      ROUND_SUBMISSION_MAX_TOTAL_IMAGE_BYTES ||
    getRoundSubmissionImagesPayloadBytes(images) + (images[0]?.length || 0) >
      3.75 * 1024 * 1024
  ) {
    return "The combined image size is too large. Remove an image or choose smaller files.";
  }

  return undefined;
};

// Walk GIF blocks without decoding/rasterizing frames, preserving animation bytes.
export const getRoundSubmissionGifValidationError = (images: string[]) => {
  for (const image of images) {
    if (!/^data:image\/gif/i.test(image)) continue;
    const match = /^data:image\/gif;base64,([A-Za-z0-9+/]+={0,2})$/.exec(image);
    if (!match || match[1].length % 4 !== 0) return "Choose a valid GIF image.";
    if (match[1].length > Math.ceil((1024 * 1024) / 3) * 4)
      return "Choose a GIF no larger than 1MB to preserve animation.";
    try {
      const bytes = atob(match[1]);
      const word = (offset: number) =>
        bytes.charCodeAt(offset) | (bytes.charCodeAt(offset + 1) << 8);
      const width = word(6),
        height = word(8);
      if (bytes.length > 1024 * 1024)
        return "Choose a GIF no larger than 1MB to preserve animation.";
      if (
        !/^GIF8[79]a/.test(bytes) ||
        bytes.length < 14 ||
        !width ||
        !height ||
        width > 4096 ||
        height > 4096
      )
        throw new Error();
      let offset = 13;
      const packed = bytes.charCodeAt(10);
      if (packed & 0x80) offset += 3 * (1 << ((packed & 7) + 1));
      let frames = 0;
      const skipBlocks = () => {
        while (offset < bytes.length) {
          const size = bytes.charCodeAt(offset++);
          if (!size) return;
          offset += size;
          if (offset >= bytes.length) throw new Error();
        }
        throw new Error();
      };
      while (offset < bytes.length) {
        const marker = bytes.charCodeAt(offset++);
        if (marker === 0x3b) {
          if (!frames || offset !== bytes.length) throw new Error();
          break;
        }
        if (marker === 0x21) {
          offset++; // Extension label followed by bounded data sub-blocks.
          skipBlocks();
        } else if (marker === 0x2c) {
          if (
            offset + 9 >= bytes.length ||
            !word(offset + 4) ||
            !word(offset + 6) ||
            word(offset) + word(offset + 4) > width ||
            word(offset + 2) + word(offset + 6) > height
          )
            throw new Error();
          const framePacked = bytes.charCodeAt(offset + 8);
          offset += 9;
          if (framePacked & 0x80) offset += 3 * (1 << ((framePacked & 7) + 1));
          const codeSize = bytes.charCodeAt(offset++);
          if (codeSize < 2 || codeSize > 8 || !bytes.charCodeAt(offset))
            throw new Error();
          skipBlocks();
          frames++;
        } else throw new Error();
      }
      if (bytes.charCodeAt(bytes.length - 1) !== 0x3b || !frames)
        throw new Error();
    } catch {
      return "Choose a valid GIF image (up to 4096 pixels per side).";
    }
  }
  return undefined;
};
