export type AdminRoundDateInputs = {
  submissionsOpenAt: string;
  votingStartsAt: string;
  votingEndsAt: string;
};

export type SavedRoundDates = {
  startsAt?: string;
  submissionsOpenAt?: string;
  votingStartsAt?: string;
  votingEndsAt?: string;
};

export type AdminRoundSnapshotInputs = {
  votingSnapshotMode: "voting_start" | "custom";
  votingSnapshotAt: string;
};

export type SavedRoundSnapshot = {
  votingSnapshotMode?: "voting_start" | "custom";
  votingSnapshotAt?: string | null;
};

export const toDateInput = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 16);
};

export const dateInputToPreservedIso = (
  value: string,
  previousValue?: string
) => {
  if (!value) return previousValue || "";
  if (previousValue && toDateInput(previousValue) === value) {
    return previousValue;
  }

  return new Date(value).toISOString();
};

export const getAdminRoundDatePayload = (
  values: AdminRoundDateInputs,
  current: SavedRoundDates
) => {
  const submissionsOpenAt = dateInputToPreservedIso(
    values.submissionsOpenAt,
    current.submissionsOpenAt
  );

  return {
    startsAt: submissionsOpenAt,
    submissionsOpenAt,
    votingStartsAt: dateInputToPreservedIso(
      values.votingStartsAt,
      current.votingStartsAt
    ),
    votingEndsAt: dateInputToPreservedIso(
      values.votingEndsAt,
      current.votingEndsAt
    ),
  };
};

export const getAdminRoundSnapshotPayload = (
  values: AdminRoundSnapshotInputs,
  current: SavedRoundSnapshot
) => ({
  votingSnapshotMode: values.votingSnapshotMode,
  votingSnapshotAt:
    values.votingSnapshotMode === "custom"
      ? dateInputToPreservedIso(
          values.votingSnapshotAt,
          current.votingSnapshotAt || undefined
        )
      : null,
});
