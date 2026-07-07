import { getAddress, isAddress } from "viem";

export type CommunityProjectGalleryImage = {
  src: string;
  caption?: string;
  sourceHref?: string;
  sourceLabel?: string;
};

export type CommunityProject = {
  slug: string;
  title: string;
  description: string;
  details: string[];
  artist: string;
  memberAddresses?: string[];
  category: string;
  date: string;
  href: string;
  image: string;
  galleryImages?: Array<string | CommunityProjectGalleryImage>;
  links?: Array<{
    title: string;
    href: string;
  }>;
};

export const communityProjects: CommunityProject[] = [];

export const normalizeCommunityProjectMemberAddresses = (value: unknown) => {
  if (!Array.isArray(value)) return [];

  const addresses = new Map<string, string>();

  value.forEach((item) => {
    if (typeof item !== "string" || !isAddress(item)) return;

    const address = getAddress(item);
    addresses.set(address.toLowerCase(), address);
  });

  return Array.from(addresses.values());
};

export const getInvalidCommunityProjectMemberAddresses = (value: unknown) => {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) return ["memberAddresses"];

  return value.filter((item) => typeof item !== "string" || !isAddress(item));
};
