import Layout from "@/components/Layout";
import { type CommunityProject } from "data/community";
import { isAdminAddress } from "@/utils/admin";
import { getCommunityProjects } from "@/utils/community-projects";
import { normalizeSafeImageUrl } from "@/utils/url-safety";
import type {
  GetServerSidePropsResult,
  InferGetServerSidePropsType,
} from "next";
import Head from "next/head";
import Link from "next/link";
import { useAccount } from "wagmi";

type CommunityPageProps = {
  projects: CommunityProject[];
};

export const getServerSideProps = async (): Promise<
  GetServerSidePropsResult<CommunityPageProps>
> => ({
  props: {
    projects: await getCommunityProjects(),
  },
});

export default function CommunityPage({
  projects,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const { address } = useAccount();
  const isAdmin = isAdminAddress(address);

  return (
    <Layout>
      <Head>
        <title>Projects | Yellow Collective</title>
      </Head>

      <div className="yc-project-page -m-6 flex w-[calc(100%+3rem)] flex-col gap-7 p-6 pb-12 md:mx-auto md:w-full md:max-w-[1120px] md:p-0 md:pb-12">
        <section className="yc-project-surface flex flex-col items-center justify-between gap-5 rounded-2xl border border-skin-stroke bg-white p-6 text-center text-[#212529] shadow-sm md:flex-row md:items-start md:p-8 md:text-left">
          <div className="flex flex-col items-center gap-3 md:items-start">
            <h1 className="font-heading text-[36px] leading-none md:text-[44px]">
              Projects
            </h1>
            <p className="max-w-[720px] text-base leading-snug text-[#212529] md:text-lg">
              A gallery of projects, events, art, and community work from the
              Yellow Collective.
            </p>
          </div>
          <Link
            href="/projects/submit"
            className="flex w-fit shrink-0 items-center justify-center rounded-[18px] bg-[#1d9bf0] px-5 py-3 font-heading text-lg text-white shadow-[0px_4.02px_0px_0px_#0f5f99] transition hover:-translate-y-0.5 hover:bg-[#45adf5] hover:shadow-[0px_6px_0px_0px_#0f5f99] active:translate-y-1 active:shadow-none"
          >
            Submit project
          </Link>
        </section>

        {projects.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {projects.map((project) => {
              const imageUrl = normalizeSafeImageUrl(project.image, {
                allowInternal: true,
                allowDataImages: true,
              });

              return (
                <div
                  key={project.slug}
                  className="yc-project-surface group overflow-hidden rounded-2xl border border-skin-stroke bg-white text-[#212529] shadow-[0px_4.02px_0px_0px_rgb(var(--color-shadow-accent))] transition hover:-translate-y-0.5 hover:shadow-[0px_6px_0px_0px_rgb(var(--color-shadow-accent))] active:translate-y-1 active:shadow-none"
                >
                  <Link
                    href={`/projects/${project.slug}`}
                    aria-label={project.title}
                    className="block"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {imageUrl && (
                      <img
                        src={imageUrl}
                        alt={project.title}
                        className="aspect-square w-full bg-white object-cover transition duration-200 group-hover:scale-[1.03]"
                      />
                    )}
                    <div className="min-h-[86px] border-t border-skin-stroke bg-white p-4">
                      <h2 className="font-heading text-xl leading-tight text-[#212529]">
                        {project.title}
                      </h2>
                    </div>
                  </Link>
                  {isAdmin && (
                    <div className="border-t border-skin-stroke bg-white p-3">
                      <a
                        href={`/admin/dashboard?section=community&mode=existing&project=${project.slug}`}
                        className="yc-project-admin-edit-button flex w-full items-center justify-center rounded-xl border border-skin-stroke bg-white px-3 py-2 font-heading text-sm text-white shadow-[0px_3px_0px_0px_rgb(var(--color-shadow-neutral))] transition hover:-translate-y-0.5 active:translate-y-1 active:shadow-none"
                      >
                        Admin edit
                      </a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="yc-project-surface rounded-2xl border border-skin-stroke bg-white p-6 text-base text-[#212529] md:text-lg">
            No projects have been submitted yet.
          </div>
        )}
      </div>
    </Layout>
  );
}
