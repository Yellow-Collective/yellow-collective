import Layout from "@/components/Layout";
import { RoundSubmissionEditor } from "@/components/rounds/RoundSubmissionEditor";
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
        <Link
          href={`/rounds/${round.slug}`}
          className="inline-block font-heading underline"
        >
          Back to {round.title}
        </Link>
        <RoundSubmissionEditor
          key={id || "list"}
          round={round}
          submissionId={id}
        />
      </div>
    </Layout>
  );
}
