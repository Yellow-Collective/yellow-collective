export const ROUND_IMAGE_UPLOAD_MAX_BYTES = 8 * 1024 * 1024;
export const ROUND_IMAGE_UPLOAD_ACCEPT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;
export const ROUND_IMAGE_UPLOAD_ACCEPT = ROUND_IMAGE_UPLOAD_ACCEPT_TYPES.join(
  ","
);

type RoundImageUploadFile = Pick<File, "type" | "size">;

export const validateRoundImageUploadFile = (file: RoundImageUploadFile) => {
  if (!ROUND_IMAGE_UPLOAD_ACCEPT_TYPES.some((type) => type === file.type)) {
    throw new Error("Choose a supported image file.");
  }

  if (file.size > ROUND_IMAGE_UPLOAD_MAX_BYTES) {
    throw new Error("Choose an image smaller than 8MB.");
  }
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
        const maxSize = 1600;
        const scale = Math.min(
          1,
          maxSize / Math.max(image.width, image.height)
        );
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Unable to process image."));
          return;
        }

        context.fillStyle = "#ffcc00";
        context.fillRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.88));
      };
      image.onerror = () => reject(new Error("Unable to read image."));
      image.src = String(reader.result || "");
    };
    reader.onerror = () => reject(new Error("Unable to read image."));
    reader.readAsDataURL(file);
  });
