import Image from "next/image";
import Link from "next/link";
import useSWR from "swr";

type MetagovTrackedProposal = {
  nounsProposalId: string;
  nounsTitle: string;
  snapshotId: string;
  snapshotTitle: string;
  snapshotUrl: string;
  status: string;
  updatedAt: string;
  scores?: number[];
  scoresTotal?: number;
  winningChoice?: "FOR" | "AGAINST" | "ABSTAIN" | "NO_VOTES";
  executionMode?: "safe";
  voterAddress?: string;
  executionTxHash?: string;
  safeTxHash?: string;
  failureReason?: string;
};

type MetagovExecutionRecord = {
  choice: "FOR" | "AGAINST" | "ABSTAIN";
  executionMode: "safe";
  voterAddress: string;
  safeTxHash?: string;
  executionTxHash: string;
  blockNumber: number;
  gasUsed: string;
  executedAt: string;
};

type MetagovStatusResponse = {
  stateUpdatedAt: string | null;
  proposal: MetagovTrackedProposal | null;
  execution: MetagovExecutionRecord | null;
};

const fetcher = async (url: string) => {
  const response = await fetch(url, { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Unable to load metagov status.");
  }
  return data as MetagovStatusResponse;
};

const statusLabels: Record<string, string> = {
  created: "Snapshot created",
  active: "Snapshot active",
  closed: "Snapshot closed",
  executed: "Nouns vote executed",
  skipped: "Skipped",
  failed: "Needs retry",
  cancelled: "Cancelled",
};

const choiceLabels: Record<string, string> = {
  FOR: "For",
  AGAINST: "Against",
  ABSTAIN: "Abstain",
  NO_VOTES: "No votes",
};

export default function MetagovStatusCard({
  proposalNumber,
}: {
  proposalNumber: number;
}) {
  const { data, error } = useSWR<MetagovStatusResponse>(
    `/api/metagov/nouns/${proposalNumber}`,
    fetcher
  );
  const proposal = data?.proposal;
  const execution = data?.execution;
  const scores = proposal?.scores || [0, 0, 0];
  const scoresTotal = Number(proposal?.scoresTotal || 0);
  const safeTxHash = execution?.safeTxHash || proposal?.safeTxHash;
  const executionTxHash =
    execution?.executionTxHash || proposal?.executionTxHash;
  const voterAddress = execution?.voterAddress || proposal?.voterAddress;

  return (
    <section className="yc-dark-yellow-surface mt-2 rounded-2xl border border-skin-stroke bg-white p-6 shadow-[0px_4.02px_0px_0px_rgb(var(--color-shadow-accent))] md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-2xl font-heading font-bold text-skin-base">
            Metagov status
          </div>
          <div className="mt-2 text-base text-secondary md:text-lg">
            Read-only bot state for Yellow Collective&apos;s Nouns DAO vote.
          </div>
        </div>
        <div className="w-fit rounded-md bg-skin-proposal-highlighted px-3 py-1 text-center font-heading text-sm text-white">
          {proposal ? statusLabels[proposal.status] || proposal.status : "No state"}
        </div>
      </div>

      {error ? (
        <div className="mt-5 rounded-xl border border-skin-proposal-danger bg-white p-4 text-skin-proposal-danger">
          Unable to load metagov bot state.
        </div>
      ) : !data ? (
        <div className="mt-5 flex items-center gap-3 text-secondary">
          <Image src="/spinner.svg" alt="spinner" width={20} height={20} />
          Loading metagov status...
        </div>
      ) : !proposal ? (
        <div className="mt-5 rounded-xl border border-skin-stroke bg-skin-muted p-4 text-base text-secondary">
          The bot has not persisted state for this Nouns proposal yet.
        </div>
      ) : (
        <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-xl border border-skin-stroke bg-skin-muted p-4">
            <div className="font-heading text-lg font-bold text-skin-base">
              Snapshot decision
            </div>
            <div className="mt-2 text-sm text-secondary">
              {proposal.snapshotTitle}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {["For", "Against", "Abstain"].map((label, index) => (
                <div key={label} className="rounded-lg bg-white p-3">
                  <div className="font-heading text-sm font-bold text-secondary">
                    {label}
                  </div>
                  <div className="mt-1 font-heading text-xl font-bold text-skin-base">
                    {Number(scores[index] || 0).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 text-base text-secondary">
              Winner:{" "}
              <span className="font-heading font-bold text-skin-base">
                {proposal.winningChoice
                  ? choiceLabels[proposal.winningChoice]
                  : "Pending"}
              </span>
              {scoresTotal ? ` from ${scoresTotal.toLocaleString()} votes` : ""}
            </div>
            <div className="mt-2 break-all text-sm text-secondary">
              Snapshot: {proposal.snapshotId}
            </div>
          </div>

          <div className="rounded-xl border border-skin-stroke bg-skin-muted p-4">
            <div className="font-heading text-lg font-bold text-skin-base">
              Execution
            </div>
            {proposal.failureReason ? (
              <div className="mt-3 rounded-lg border border-skin-proposal-danger bg-white p-3 text-sm text-skin-proposal-danger">
                {proposal.failureReason}
              </div>
            ) : null}
            <div className="mt-3 space-y-2 text-base text-secondary">
              <div>
                Mode:{" "}
                <span className="font-heading font-bold text-skin-base">
                  {execution?.executionMode || proposal.executionMode || "Safe"}
                </span>
              </div>
              <div>
                Voter:{" "}
                <span className="break-all font-heading text-skin-base">
                  {voterAddress || "Pending"}
                </span>
              </div>
              <div>
                Safe tx:{" "}
                <span className="break-all font-heading text-skin-base">
                  {safeTxHash || "Pending"}
                </span>
              </div>
              <div>
                Execution tx:{" "}
                <span className="break-all font-heading text-skin-base">
                  {executionTxHash || "Pending"}
                </span>
              </div>
              <div>
                Updated:{" "}
                <span className="font-heading text-skin-base">
                  {formatDate(data.stateUpdatedAt || proposal.updatedAt)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row lg:col-span-2">
            <Link
              href={proposal.snapshotUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-12 items-center justify-center rounded-[18px] border border-[#a90f0c] bg-skin-proposal-danger px-4 font-heading text-base font-bold text-white shadow-[0px_4.02px_0px_0px_#a90f0c] transition hover:-translate-y-0.5 hover:bg-[#f43a35] hover:shadow-[0px_6px_0px_0px_#a90f0c] active:translate-y-1 active:shadow-none"
            >
              View Snapshot state
            </Link>
            {executionTxHash ? (
              <Link
                href={`https://etherscan.io/tx/${executionTxHash}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-12 items-center justify-center rounded-[18px] bg-[#1d9bf0] px-4 font-heading text-base font-bold text-white shadow-[0px_4.02px_0px_0px_#0f5f99] transition hover:-translate-y-0.5 hover:bg-[#45adf5] hover:shadow-[0px_6px_0px_0px_#0f5f99] active:translate-y-1 active:shadow-none"
              >
                View execution
              </Link>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}

const formatDate = (value?: string | null) => {
  if (!value) return "Unknown";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString();
};
