import Layout from "@/components/Layout";
import WalletIdentityLink from "@/components/WalletIdentityLink";
import { type CommunityProject } from "data/community";
import { getCommunityProject } from "@/utils/community-projects";
import { areSameWalletAddress } from "@/utils/profile/identity";
import { isAdminAddress } from "@/utils/admin";
import { getSafeLinkProps, normalizeSafeImageUrl } from "@/utils/url-safety";
import { normalizeCommunityProjectGalleryImages } from "@/utils/community-project-gallery";
import { getDaoMemberSummaries, type DaoMemberSummary } from "data/members";
import type { CommunityProjectGalleryImage } from "data/community";
import type {
  GetServerSidePropsContext,
  GetServerSidePropsResult,
  InferGetServerSidePropsType,
} from "next";
import { ArrowLeftIcon } from "@heroicons/react/20/solid";
import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { useAccount } from "wagmi";

type CommunityDetailProps = {
  project: CommunityProject;
  projectMembers: ProjectMemberSummary[];
};

type ProjectMemberSummary = Pick<
  DaoMemberSummary,
  "address" | "displayName" | "avatarUrl" | "firstTokenImage"
>;

export const getServerSideProps = async ({
  params,
}: GetServerSidePropsContext): Promise<
  GetServerSidePropsResult<CommunityDetailProps>
> => {
  const project = params?.slug
    ? await getCommunityProject(String(params.slug))
    : undefined;

  if (!project) return { notFound: true };

  const memberAddresses = project.memberAddresses || [];
  const projectMembers =
    memberAddresses.length > 0 ? await getProjectMembers(memberAddresses) : [];

  return {
    props: { project, projectMembers },
  };
};

const getProjectMembers = async (memberAddresses: string[]) => {
  try {
    const daoMembers = await getDaoMemberSummaries();

    return memberAddresses.map((address) => {
      const member = daoMembers.find((daoMember) =>
        areSameWalletAddress(daoMember.address, address)
      );

      return {
        address,
        displayName: member?.displayName || "",
        avatarUrl: member?.avatarUrl || null,
        firstTokenImage: member?.firstTokenImage || "",
      };
    });
  } catch (error) {
    console.warn("Unable to load project members", error);

    return memberAddresses.map((address) => ({
      address,
      displayName: "",
      avatarUrl: null,
      firstTokenImage: "",
    }));
  }
};

export default function CommunityDetailPage({
  project,
  projectMembers,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const { address } = useAccount();
  const isAdmin = isAdminAddress(address);
  const [selectedImage, setSelectedImage] =
    useState<CommunityProjectGalleryImage | null>(null);
  const imageUrl = normalizeSafeImageUrl(project.image, {
    allowInternal: true,
    allowDataImages: true,
  });
  const galleryImages = normalizeCommunityProjectGalleryImages(
    project.galleryImages,
    {
      allowDataImages: true,
    }
  );
  const sourceLinkProps = getSafeLinkProps(project.href, {
    allowInternal: true,
  });

  return (
    <Layout>
      <Head>
        <title>{project.title} | Yellow Collective</title>
      </Head>

      <div className="mx-auto flex w-full max-w-[980px] flex-col gap-7 pb-12">
        <Link
          href="/projects"
          className="flex w-fit items-center gap-2 font-heading text-lg text-skin-base transition hover:opacity-80"
        >
          <span className="yc-dark-yellow-button flex h-10 w-10 items-center justify-center rounded-full border border-skin-stroke bg-white shadow-[0px_4.02px_0px_0px_rgb(var(--color-shadow-neutral))] transition hover:-translate-y-0.5 hover:bg-[#fff7bf] hover:shadow-[0px_6px_0px_0px_rgb(var(--color-shadow-neutral))] active:translate-y-1 active:shadow-none">
            <ArrowLeftIcon className="h-4 text-skin-base" />
          </span>
          Projects
        </Link>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        {imageUrl && (
          <img
            src={imageUrl}
            alt={project.title}
            className="max-h-[520px] w-full rounded-2xl border border-skin-stroke bg-skin-muted object-cover shadow-sm"
          />
        )}

        <div className="grid gap-8 md:grid-cols-[1fr_280px]">
          <section className="yc-dark-surface flex flex-col gap-5 rounded-2xl border border-skin-stroke bg-white p-5 shadow-sm md:p-7">
            <div className="caption font-semibold text-secondary">
              {project.category} / {project.date}
            </div>
            <h1 className="font-heading text-[34px] leading-none md:text-[42px]">
              {project.title}
            </h1>
            <p className="text-lg leading-snug text-skin-base">
              {project.description}
            </p>
            <div className="flex flex-col gap-4 text-base leading-snug text-secondary md:text-lg">
              {project.details.map((detail) => (
                <p key={detail}>{detail}</p>
              ))}
            </div>
            {galleryImages.length > 0 && (
              <div className="grid grid-cols-2 gap-4 pt-2">
                {galleryImages.map((image, index) => (
                  <button
                    key={`${image.src}-${index}`}
                    type="button"
                    onClick={() => setSelectedImage(image)}
                    className="group block overflow-hidden rounded-2xl border border-skin-stroke bg-skin-muted shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={image.src}
                      alt={`${project.title} gallery image ${index + 1}`}
                      className="aspect-square h-full w-full object-cover transition duration-200 group-hover:scale-[1.03]"
                    />
                  </button>
                ))}
              </div>
            )}
          </section>

          <aside className="yc-dark-surface h-fit rounded-2xl border border-skin-stroke bg-skin-muted p-5 shadow-sm">
            <dl className="flex flex-col gap-4 text-base">
              <div>
                <dt className="font-heading text-xl">Category</dt>
                <dd className="mt-1 text-secondary">{project.category}</dd>
              </div>
              <div>
                <dt className="font-heading text-xl">Artist</dt>
                <dd className="mt-1 text-secondary">
                  <WalletIdentityLink
                    address={project.artist}
                    fallback="full"
                  />
                </dd>
              </div>
              {projectMembers.length > 0 && (
                <div>
                  <dt className="font-heading text-xl">Project Members</dt>
                  <dd className="mt-2 flex flex-col gap-2">
                    {projectMembers.map((member) => {
                      const imageUrl =
                        member.avatarUrl || member.firstTokenImage || "";

                      return (
                        <WalletIdentityLink
                          key={member.address}
                          address={member.address}
                          className="yc-dark-surface flex min-w-0 items-center gap-2 rounded-xl border border-skin-stroke bg-white p-2 text-skin-base transition hover:bg-[#fff7bf]"
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#ffcc00] font-heading text-xs text-skin-base">
                            {imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={imageUrl}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              "YC"
                            )}
                          </span>
                          <span className="min-w-0 truncate font-heading text-sm">
                            {member.displayName || member.address}
                          </span>
                        </WalletIdentityLink>
                      );
                    })}
                  </dd>
                </div>
              )}
            </dl>

            {sourceLinkProps && (
              <Link
                {...sourceLinkProps}
                className="yc-dark-yellow-button mt-6 flex w-full items-center justify-center rounded-[18px] bg-accent px-5 py-3 font-heading text-lg text-skin-base shadow-[0px_4.02px_0px_0px_#b89400] transition hover:-translate-y-0.5 hover:bg-[#ffd84d] hover:shadow-[0px_6px_0px_0px_#b89400] active:translate-y-1 active:shadow-none"
              >
                View source
              </Link>
            )}
            {isAdmin && (
              <Link
                href={`/admin/dashboard?section=community&mode=existing&project=${project.slug}`}
                className="yc-project-admin-edit-button mt-3 flex w-full items-center justify-center rounded-[18px] border border-skin-stroke bg-white px-5 py-3 font-heading text-lg text-white shadow-[0px_4.02px_0px_0px_rgb(var(--color-shadow-neutral))] transition hover:-translate-y-0.5 hover:shadow-[0px_6px_0px_0px_rgb(var(--color-shadow-neutral))] active:translate-y-1 active:shadow-none"
              >
                Admin edit
              </Link>
            )}
            {project.links && project.links.length > 0 && (
              <div className="mt-5 flex flex-col gap-3">
                {project.links.map((link) => {
                  const linkProps = getSafeLinkProps(link.href, {
                    allowInternal: true,
                  });

                  return (
                    linkProps && (
                      <Link
                        key={`${link.title}-${link.href}`}
                        {...linkProps}
                        className="font-heading text-base text-skin-base underline transition hover:opacity-70"
                      >
                        {link.title}
                      </Link>
                    )
                  );
                })}
              </div>
            )}
          </aside>
        </div>
      </div>

      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
          onClick={() => setSelectedImage(null)}
          role="presentation"
        >
          <div className="relative max-h-full max-w-5xl">
            <button
              type="button"
              onClick={() => setSelectedImage(null)}
              className="yc-dark-text-black absolute left-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white font-heading text-xl text-skin-base shadow-[0px_4.02px_0px_0px_rgb(var(--color-shadow-neutral))] transition hover:-translate-y-0.5 hover:bg-[#fff7bf] hover:shadow-[0px_6px_0px_0px_rgb(var(--color-shadow-neutral))] active:translate-y-1 active:shadow-none"
              aria-label="Close image"
            >
              X
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedImage.src}
              alt={`${project.title} enlarged gallery image`}
              className="max-h-[86vh] max-w-full rounded-2xl border border-skin-stroke bg-skin-muted object-contain shadow-xl"
              onClick={(event) => event.stopPropagation()}
            />
            {(selectedImage.caption || selectedImage.sourceHref) && (
              <div
                className="absolute bottom-0 left-0 right-0 rounded-b-2xl border-x border-b border-skin-stroke bg-black/75 px-5 py-4 text-white shadow-xl"
                onClick={(event) => event.stopPropagation()}
              >
                {selectedImage.caption && (
                  <p className="text-sm leading-snug md:text-base">
                    {selectedImage.caption}
                  </p>
                )}
                {selectedImage.sourceHref &&
                  (() => {
                    const selectedSourceLinkProps = getSafeLinkProps(
                      selectedImage.sourceHref || "",
                      {
                        allowInternal: true,
                      }
                    );

                    return selectedSourceLinkProps ? (
                      <Link
                        {...selectedSourceLinkProps}
                        className="mt-2 inline-flex font-heading text-sm text-[#ffcc00] underline transition hover:opacity-80"
                      >
                        {selectedImage.sourceLabel || "Source"}
                      </Link>
                    ) : null;
                  })()}
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}
