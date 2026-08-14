import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (filePath) => readFileSync(resolve(process.cwd(), filePath), "utf8");

const communityTypes = read("data/community.ts");
const galleryUtils = read("utils/community-project-gallery.ts");
const projectDetailPage = read("pages/community/[slug].tsx");
const submitPage = read("pages/community/submit.tsx");
const adminDashboard = read("pages/admin/dashboard.tsx");

assert.match(
  communityTypes,
  /export type CommunityProjectGalleryImage = \{/,
  "Community project gallery images must support structured metadata."
);
assert.match(
  galleryUtils,
  /normalizeCommunityProjectGalleryImages/,
  "Gallery image metadata must be normalized through the shared helper."
);
assert.match(
  galleryUtils,
  /formatCommunityProjectGalleryImages/,
  "Admin editing must be able to serialize gallery captions."
);
assert.match(
  galleryUtils,
  /parseCommunityProjectGalleryImages/,
  "Admin editing must be able to parse gallery captions."
);
assert.match(
  projectDetailPage,
  /useState<CommunityProjectGalleryImage \| null>/,
  "Expanded project images must keep caption and source metadata."
);
assert.match(
  projectDetailPage,
  /selectedImage\.caption \|\| selectedImage\.sourceHref/,
  "Caption UI should render only when an expanded image has metadata."
);
assert.match(
  projectDetailPage,
  /absolute bottom-0/,
  "Expanded image captions should sit at the bottom of the image modal."
);
assert.match(
  projectDetailPage,
  /selectedImage\.sourceLabel \|\| "Source"/,
  "Expanded image captions should expose the source link label."
);
assert.match(
  submitPage,
  /placeholder="Caption or description"/,
  "Project submissions must allow gallery image captions."
);
assert.match(
  submitPage,
  /placeholder="Source URL"/,
  "Project submissions must allow gallery image source links."
);
assert.match(
  adminDashboard,
  /URL \| Caption \| Source URL \| Source label/,
  "Admin project editing must document the gallery caption row format."
);

console.log("ok - community project gallery captions stay modal-only");
