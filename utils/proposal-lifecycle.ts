export type ProposalLifecycleAction =
  | "queue"
  | "countdown"
  | "execute"
  | "invalid-eta"
  | "none";

export const getProposalLifecycleAction = ({
  state,
  proposalEta,
  blockTimestamp,
  isPreview,
}: {
  state?: number;
  proposalEta?: number;
  blockTimestamp?: number;
  isPreview: boolean;
}): ProposalLifecycleAction => {
  if (isPreview) return "none";
  if (state === 4) return "queue";
  if (state !== 5) return "none";

  if (!proposalEta || !Number.isFinite(proposalEta)) return "invalid-eta";
  if (!Number.isFinite(blockTimestamp)) return "countdown";

  return Number(blockTimestamp) >= proposalEta ? "execute" : "countdown";
};

export const formatExecutionCountdown = (secondsRemaining: number) => {
  const totalMinutes = Math.max(0, Math.ceil(secondsRemaining / 60));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  return [
    days > 0 ? `${days}d` : "",
    hours > 0 ? `${hours}h` : "",
    `${minutes}m`,
  ]
    .filter(Boolean)
    .join(" ");
};
