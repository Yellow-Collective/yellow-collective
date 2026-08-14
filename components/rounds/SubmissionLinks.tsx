import type { RoundSubmission } from "data/rounds";

export const SubmissionLinks = ({
  submission,
}: {
  submission: Pick<RoundSubmission, "submissionType" | "url">;
}) => (
  <section className="mt-5 rounded-2xl border border-skin-stroke bg-[#f7f7f7] p-4">
    <h3 className="font-heading text-lg leading-none text-skin-base">Links</h3>
    <div className="mt-3 flex flex-col gap-2">
      <a
        href={submission.url || "#"}
        target="_blank"
        rel="noreferrer"
        className="flex items-center justify-between gap-3 rounded-xl border border-skin-stroke bg-white px-4 py-3 font-heading text-base text-skin-base underline-offset-4 transition hover:bg-[#fff7bf] hover:underline"
      >
        <span>
          {submission.submissionType === "trait"
            ? "Noundry trait page"
            : "Submission link"}
        </span>
        <span className="truncate text-sm font-sans text-secondary">
          {submission.url}
        </span>
      </a>
    </div>
  </section>
);
