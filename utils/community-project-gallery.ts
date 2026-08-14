import type { CommunityProjectGalleryImage } from "data/community";
import {
  normalizeSafeImageUrl,
  normalizeSafeProjectUrl,
} from "@/utils/url-safety";

type GalleryImageInput =
  | string
  | Partial<CommunityProjectGalleryImage>
  | null
  | undefined;

type NormalizeGalleryImagesOptions = {
  allowDataImages?: boolean;
};

const MAX_CAPTION_LENGTH = 500;
const MAX_SOURCE_LABEL_LENGTH = 80;

const cleanText = (value: unknown, maxLength: number) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

export const normalizeCommunityProjectGalleryImages = (
  value: unknown,
  options: NormalizeGalleryImagesOptions = {}
): CommunityProjectGalleryImage[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item: GalleryImageInput) => {
      const rawSrc = typeof item === "string" ? item : item?.src;
      const src = normalizeSafeImageUrl(rawSrc, {
        allowInternal: true,
        allowDataImages: options.allowDataImages,
      });

      if (!src) return null;

      const caption =
        typeof item === "string"
          ? ""
          : cleanText(item?.caption, MAX_CAPTION_LENGTH);
      const sourceHref =
        typeof item === "string"
          ? ""
          : normalizeSafeProjectUrl(item?.sourceHref || "", {
              allowInternal: true,
            });
      const sourceLabel =
        typeof item === "string"
          ? ""
          : cleanText(item?.sourceLabel, MAX_SOURCE_LABEL_LENGTH);

      return {
        src,
        ...(caption ? { caption } : {}),
        ...(sourceHref ? { sourceHref } : {}),
        ...(sourceHref && sourceLabel ? { sourceLabel } : {}),
      };
    })
    .filter(
      (item): item is CommunityProjectGalleryImage =>
        Boolean(item && item.src)
    );
};

export const formatCommunityProjectGalleryImages = (
  images?: CommunityProjectGalleryImage[]
) =>
  (images || [])
    .map((image) =>
      [
        image.src,
        image.caption || "",
        image.sourceHref || "",
        image.sourceLabel || "",
      ]
        .join(" | ")
        .replace(/(?: \| )+$/g, "")
    )
    .join("\n");

export const parseCommunityProjectGalleryImages = (value: string) =>
  normalizeCommunityProjectGalleryImages(
    value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [src, caption = "", sourceHref = "", sourceLabel = ""] =
          line.split("|").map((part) => part.trim());

        return {
          src,
          caption,
          sourceHref,
          sourceLabel,
        };
      }),
    { allowDataImages: true }
  );
