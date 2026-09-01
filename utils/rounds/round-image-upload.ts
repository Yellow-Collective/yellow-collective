export const ROUND_IMAGE_UPLOAD_MAX_BYTES = 8 * 1024 * 1024;
// Round submissions store uploaded images inline in a JSON request. Keep the
// encoded image well below the API route's 8 MB request limit.
export const ROUND_IMAGE_UPLOAD_MAX_OUTPUT_BYTES = 500 * 1024;
export const ROUND_IMAGE_UPLOAD_ACCEPT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;
export const ROUND_IMAGE_UPLOAD_ACCEPT =
  ROUND_IMAGE_UPLOAD_ACCEPT_TYPES.join(",");

type RoundImageUploadFile = Pick<File, "type" | "size">;

export const validateRoundImageUploadFile = (file: RoundImageUploadFile) => {
  if (!ROUND_IMAGE_UPLOAD_ACCEPT_TYPES.some((type) => type === file.type)) {
    throw new Error("Choose a supported image file.");
  }

  if (file.size > ROUND_IMAGE_UPLOAD_MAX_BYTES) {
    throw new Error("Choose an image smaller than 8MB.");
  }
};

const getDataUrlByteLength = (dataUrl: string) => {
  const base64 = dataUrl.split(",", 2)[1] || "";
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
};

const encodeRoundImage = (image: HTMLImageElement) => {
  const maxSize = 1600;
  let scale = Math.min(1, maxSize / Math.max(image.width, image.height));
  let quality = 0.88;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("Unable to process image.");

    context.fillStyle = "#ffcc00";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    if (getDataUrlByteLength(dataUrl) <= ROUND_IMAGE_UPLOAD_MAX_OUTPUT_BYTES) {
      return dataUrl;
    }

    if (quality > 0.56) {
      quality -= 0.08;
    } else {
      scale *= 0.8;
      quality = 0.88;
    }
  }

  throw new Error("Image is too detailed to submit. Choose a smaller image.");
};

export const resizeRoundImageFile = (file: File) =>
  new Promise<string>((resolve, reject) => {
    try {
      validateRoundImageUploadFile(file);
    } catch (error) {
      reject(error);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const image = document.createElement("img");
      image.onload = () => {
        try {
          resolve(encodeRoundImage(image));
        } catch (error) {
          reject(error);
        }
      };
      image.onerror = () => reject(new Error("Unable to read image."));
      image.src = String(reader.result || "");
    };
    reader.onerror = () => reject(new Error("Unable to read image."));
    reader.readAsDataURL(file);
  });
