import Layout from "@/components/Layout";
import { RoundSubmissionEditor } from "@/components/rounds/RoundSubmissionEditor";
import { ArrowLeftIcon } from "@heroicons/react/20/solid";
import { getRoundBySlug, type Round } from "data/rounds";
import type { GetServerSideProps } from "next";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";

export const getServerSideProps: GetServerSideProps<{ round: Round }> = async ({
  params,
}) => {
  const slug = typeof params?.slug === "string" ? params.slug : "";
  const round = await getRoundBySlug(slug);
  if (!round || round.status !== "published" || !round.active)
    return { notFound: true };
  return { props: { round: { ...round, image: "" } } };
};
export default function EditSubmissionPage({ round }: { round: Round }) {
  const router = useRouter();
  const id =
    typeof router.query.submission === "string"
      ? router.query.submission
      : undefined;
  return (
    <Layout>
      <Head>
        <title>Edit submission | {round.title}</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <div className="mx-auto w-full max-w-[980px] space-y-5 pb-12">
        <RoundSubmissionEditor
          key={id || "list"}
          round={round}
          submissionId={id}
          navigation={
            <Link
              href={`/rounds/${round.slug}`}
              className="group flex w-fit items-center gap-2 font-heading"
            >
              <span className="yc-dark-yellow-button flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-skin-stroke bg-white shadow-[0px_4.02px_0px_0px_rgb(var(--color-shadow-neutral))] transition group-hover:bg-[#fff7bf] motion-safe:group-hover:-translate-y-0.5 motion-safe:group-active:translate-y-1 group-active:!shadow-none">
                <ArrowLeftIcon
                  aria-hidden="true"
                  className="h-4 text-skin-base"
                />
              </span>
              <span className="underline">Back to {round.title}</span>
            </Link>
          }
        />
      </div>
    </Layout>
  );
}
