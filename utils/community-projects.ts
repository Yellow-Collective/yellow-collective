import { communityProjects, type CommunityProject } from "data/community";
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

  if (project.galleryImages && !isStringArray(project.galleryImages)) {
    return false;
  }

  if (project.links && !isProjectLinks(project.links)) {
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

export const getCommunityProjects = async (): Promise<CommunityProject[]> => {
  if (!fs.existsSync(communityProjectsDirectory)) return communityProjects;

  const submittedProjects = fs
    .readdirSync(communityProjectsDirectory)
    .filter((fileName) => fileName.endsWith(".json"))
    .map((fileName) => {
      const filePath = path.join(communityProjectsDirectory, fileName);

      try {
        const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
        return isCommunityProject(parsed) ? parsed : null;
      } catch (error) {
        console.warn(`Unable to parse community project ${fileName}`, error);
        return null;
      }
    })
    .filter((project): project is CommunityProject => Boolean(project));

  return [...communityProjects, ...submittedProjects];
};
