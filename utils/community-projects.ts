import {
  communityProjects,
  getInvalidCommunityProjectMemberAddresses,
  normalizeCommunityProjectMemberAddresses,
  type CommunityProject,
} from "data/community";
import {
  getApprovedCommunityProjectBySlug,
  listApprovedCommunityProjects,
} from "data/community-project-submissions";
import { getDummyCommunityProjects } from "data/dummy-content";
import {
  normalizeSafeImageUrl,
  normalizeSafeProjectUrl,
} from "@/utils/url-safety";
import { normalizeCommunityProjectGalleryImages } from "@/utils/community-project-gallery";
import fs from "fs";
import path from "path";

const communityProjectsDirectory = path.join(
  process.cwd(),
  "data",
  "community-projects"
);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const isProjectLinks = (value: unknown): value is CommunityProject["links"] =>
  Array.isArray(value) &&
  value.every(
    (item) =>
      item &&
      typeof item === "object" &&
      typeof (item as { title?: unknown }).title === "string" &&
      typeof (item as { href?: unknown }).href === "string"
  );

const isProjectGalleryImages = (
  value: unknown
): value is NonNullable<CommunityProject["galleryImages"]> =>
  Array.isArray(value) &&
  value.every((item) => {
    if (typeof item === "string") return true;
    if (!item || typeof item !== "object") return false;

    const image = item as {
      src?: unknown;
      caption?: unknown;
      sourceHref?: unknown;
      sourceLabel?: unknown;
    };

    return (
      typeof image.src === "string" &&
      (image.caption === undefined || typeof image.caption === "string") &&
      (image.sourceHref === undefined ||
        typeof image.sourceHref === "string") &&
      (image.sourceLabel === undefined ||
        typeof image.sourceLabel === "string")
    );
  });

const hasInvalidProjectGalleryImage = (
  image: NonNullable<CommunityProject["galleryImages"]>[number]
) => {
  const src = typeof image === "string" ? image : image.src;
  const sourceHref = typeof image === "string" ? "" : image.sourceHref || "";

  return Boolean(
    (src.trim() && !normalizeSafeImageUrl(src, { allowInternal: true })) ||
      (sourceHref.trim() &&
        !normalizeSafeProjectUrl(sourceHref, { allowInternal: true }))
  );
};

const normalizeProject = (project: CommunityProject): CommunityProject => ({
  ...project,
  href: normalizeSafeProjectUrl(project.href, { allowInternal: true }),
  image: normalizeSafeImageUrl(project.image, { allowInternal: true }),
  galleryImages: normalizeCommunityProjectGalleryImages(project.galleryImages),
  links: (project.links || [])
    .map((link) => ({
      ...link,
      href: normalizeSafeProjectUrl(link.href, { allowInternal: true }),
    }))
    .filter((link) => link.title && link.href),
  memberAddresses: normalizeCommunityProjectMemberAddresses(
    project.memberAddresses
  ),
});

const isCommunityProject = (value: unknown): value is CommunityProject => {
  if (!value || typeof value !== "object") return false;

  const project = value as Partial<CommunityProject>;
  if (
    typeof project.slug !== "string" ||
    typeof project.title !== "string" ||
    typeof project.description !== "string" ||
    !isStringArray(project.details) ||
    typeof project.artist !== "string" ||
    typeof project.category !== "string" ||
    typeof project.date !== "string" ||
    typeof project.href !== "string" ||
    typeof project.image !== "string"
  ) {
    return false;
  }

  if (project.galleryImages && !isProjectGalleryImages(project.galleryImages)) {
    return false;
  }

  if (project.links && !isProjectLinks(project.links)) {
    return false;
  }

  if (
    getInvalidCommunityProjectMemberAddresses(project.memberAddresses).length
  ) {
    return false;
  }

  if (
    !normalizeSafeProjectUrl(project.href, { allowInternal: true }) ||
    !normalizeSafeImageUrl(project.image, { allowInternal: true })
  ) {
    return false;
  }

  if (
    project.galleryImages &&
    project.galleryImages.some(hasInvalidProjectGalleryImage)
  ) {
    return false;
  }

  if (
    project.links?.some(
      (link) => !normalizeSafeProjectUrl(link.href, { allowInternal: true })
    )
  ) {
    return false;
  }

  return Boolean(
    project.slug.trim() &&
      project.title.trim() &&
      project.description.trim() &&
      project.details.length &&
      project.artist.trim() &&
      project.category.trim() &&
      project.date.trim() &&
      project.href.trim() &&
      project.image.trim()
  );
};

const getLocalCommunityProjects = (): CommunityProject[] => {
  if (!fs.existsSync(communityProjectsDirectory)) return communityProjects;

  const submittedProjects = fs
    .readdirSync(communityProjectsDirectory)
    .filter((fileName) => fileName.endsWith(".json"))
    .map((fileName) => {
      const filePath = path.join(communityProjectsDirectory, fileName);

      try {
        const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
        return isCommunityProject(parsed) ? normalizeProject(parsed) : null;
      } catch (error) {
        console.warn(`Unable to parse community project ${fileName}`, error);
        return null;
      }
    })
    .filter((project): project is CommunityProject => Boolean(project));

  return [...communityProjects.map(normalizeProject), ...submittedProjects];
};

const dedupeProjects = (projects: CommunityProject[]) => {
  const projectBySlug = new Map<string, CommunityProject>();

  projects.forEach((project) => {
    projectBySlug.set(project.slug, project);
  });

  return Array.from(projectBySlug.values());
};

export const getCommunityProjects = async (): Promise<CommunityProject[]> => {
  const localProjects = getLocalCommunityProjects();

  try {
    const [approvedProjects, dummyProjects] = await Promise.all([
      listApprovedCommunityProjects(),
      getDummyCommunityProjects(),
    ]);
    return dedupeProjects([
      ...localProjects,
      ...approvedProjects,
      ...dummyProjects,
    ]);
  } catch (error) {
    console.warn("Unable to load approved community projects", error);
    const dummyProjects = await getDummyCommunityProjects();
    return dedupeProjects([...localProjects, ...dummyProjects]);
  }
};

export const getCommunityProject = async (slug: string) => {
  try {
    const approvedProject = await getApprovedCommunityProjectBySlug(slug);
    if (approvedProject) return approvedProject;
  } catch (error) {
    console.warn(`Unable to load approved community project ${slug}`, error);
  }

  const project = getLocalCommunityProjects().find(
    (project) => project.slug === slug
  );

  if (project) return normalizeProject(project);

  const dummyProject = (await getDummyCommunityProjects()).find(
    (project) => project.slug === slug
  );

  return dummyProject ? normalizeProject(dummyProject) : undefined;
};

export const getCommunityProjectsForMember = async (address: string) => {
  const normalizedAddress = normalizeCommunityProjectMemberAddresses([
    address,
  ])[0];
  if (!normalizedAddress) return [];

  const projects = await getCommunityProjects();
  const normalizedKey = normalizedAddress.toLowerCase();

  return projects.filter((project) =>
    normalizeCommunityProjectMemberAddresses(project.memberAddresses).some(
      (memberAddress) => memberAddress.toLowerCase() === normalizedKey
    )
  );
};
