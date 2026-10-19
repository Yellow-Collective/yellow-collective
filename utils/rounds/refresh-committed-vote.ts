// A committed vote is successful even when the subsequent display refresh fails.
export const refreshCommittedVote = async (
  refreshes: Array<() => Promise<unknown>>
): Promise<string> => {
  const results = await Promise.allSettled(
    refreshes.map((refresh) => Promise.resolve().then(refresh))
  );
  return results.some((result) => result.status === "rejected")
    ? "Votes submitted. The display could not refresh; reload to see updated totals. Do not resubmit these votes."
    : "Votes submitted.";
};
