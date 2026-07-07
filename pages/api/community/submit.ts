import type { NextApiRequest, NextApiResponse } from "next";
import {
  getInvalidCommunityProjectMemberAddresses,
  type CommunityProjectGalleryImage,
  type CommunityProject,
} from "data/community";
import {
  createCommunityProjectSubmission,
  normalizeCommunityProjectInput,
  validateCommunityProjectInput,
} from "data/community-project-submissions";
import { applyRateLimit } from "@/utils/rate-limit";
import { normalizeCommunityProjectGalleryImages } from "@/utils/community-project-gallery";
import { normalizeSafeProjectUrl } from "@/utils/url-safety";

type UploadedImagePayload = {
  name: string;
  type: string;
  dataUrl: string;
  caption?: string;
  sourceHref?: string;
  sourceLabel?: string;
};

type SubmitCommunityProjectBody = {
  project?: Partial<CommunityProject>;
  image?: UploadedImagePayload | null;
  galleryImageUploads?: UploadedImagePayload[] | null;
};

const ACCEPTED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_GALLERY_UPLOADS = 6;

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "40mb",
    },
  },
};

const validateUploadedImage = (image?: UploadedImagePayload | null) => {
  if (!image) return undefined;

  if (!ACCEPTED_IMAGE_TYPES.has(image.type)) {
    throw new Error("Image must be PNG, JPG, WEBP, or GIF.");
  }

  const match = image.dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match || match[1] !== image.type) {
    throw new Error("Invalid image upload.");
  }

  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new Error("Image must be smaller than 5MB.");
  }

  return image.dataUrl;
};

const validateUploadedImageSource = (image: UploadedImagePayload) => {
  if (
    image.sourceHref?.trim() &&
    !normalizeSafeProjectUrl(image.sourceHref, { allowInternal: true })
  ) {
    throw new Error("Gallery image source links must be valid URLs.");
  }
};

const validateUploadedImages = (
  images?: UploadedImagePayload[] | null
): CommunityProjectGalleryImage[] => {
  if (!images) return [];

  if (!Array.isArray(images)) {
    throw new Error("Invalid gallery image uploads.");
  }

  if (images.length > MAX_GALLERY_UPLOADS) {
    throw new Error(`Upload ${MAX_GALLERY_UPLOADS} gallery images or fewer.`);
  }

  return images
    .map((image) => {
      const src = validateUploadedImage(image);
      validateUploadedImageSource(image);

      return normalizeCommunityProjectGalleryImages(
        [
          {
            src,
            caption: image.caption,
            sourceHref: image.sourceHref,
            sourceLabel: image.sourceLabel,
          },
        ],
        { allowDataImages: true }
      )[0];
    })
    .filter(
      (image): image is CommunityProjectGalleryImage => Boolean(image?.src)
    );
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  if (
    !applyRateLimit(req, res, {
      keyPrefix: "community-submit",
      limit: 8,
      windowMs: 10 * 60 * 1000,
    })
  ) {
    return;
  }

  try {
    const body = req.body as SubmitCommunityProjectBody;
    const invalidMemberAddresses = getInvalidCommunityProjectMemberAddresses(
      body.project?.memberAddresses
    );

    if (invalidMemberAddresses.length > 0) {
      return res.status(400).json({
        error: "Project members must be valid wallet addresses.",
      });
    }

    const project = normalizeCommunityProjectInput(body.project || {});
    const uploadedImage = validateUploadedImage(body.image);
    const uploadedGalleryImages = validateUploadedImages(
      body.galleryImageUploads
    );
    const submission = {
      ...project,
      image: uploadedImage || project.image,
      galleryImages: [
        ...(project.galleryImages || []),
        ...uploadedGalleryImages,
      ],
    };
    const submissionValidationError = validateCommunityProjectInput(submission);

    if (submissionValidationError) {
      return res.status(400).json({ error: submissionValidationError });
    }

    const savedProject = await createCommunityProjectSubmission(submission);
    return res.status(201).json({ project: savedProject });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to submit project.";

    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505"
    ) {
      return res.status(409).json({
        error: "A project with this slug already exists.",
      });
    }

    console.error("Community project submission failed", error);
    return res.status(500).json({ error: message });
  }
}
