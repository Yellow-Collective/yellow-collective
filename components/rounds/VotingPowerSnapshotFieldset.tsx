import type { ReactNode } from "react";

export type VotingSnapshotMode = "voting_start" | "custom";

type VotingPowerSnapshotFieldsetProps = {
  name: string;
  value: VotingSnapshotMode;
  onChange: (value: VotingSnapshotMode) => void;
  disabled?: boolean;
  customDateField?: ReactNode;
  effectiveSnapshotLabel?: string;
  lockedSnapshotBlock?: number | null;
  className?: string;
};

const snapshotOptions: Array<{
  value: VotingSnapshotMode;
  label: string;
  note: string;
}> = [
  {
    value: "voting_start",
    label: "When voting begins",
    note: "Recommended. Follows the Voting starts date.",
  },
  {
    value: "custom",
    label: "Custom date",
    note: "Use delegated voting power from an earlier date.",
  },
];

export default function VotingPowerSnapshotFieldset({
  name,
  value,
  onChange,
  disabled = false,
  customDateField,
  effectiveSnapshotLabel,
  lockedSnapshotBlock,
  className = "",
}: VotingPowerSnapshotFieldsetProps) {
  return (
    <fieldset
      className={`min-w-0 w-full max-w-full rounded-xl border border-skin-stroke bg-skin-muted p-4 ${className}`.trim()}
    >
      <legend className="float-left mb-2 w-full px-0 font-heading text-base font-bold leading-tight text-skin-base">
        Voting power snapshot
      </legend>
      <p className="clear-left mt-0 text-sm leading-snug text-secondary">
        Delegated Collective Noun voting power is fixed at this time. Dates are
        entered in your local timezone.
      </p>
      <div className="mt-3 grid min-w-0 gap-3 md:grid-cols-2">
        {snapshotOptions.map((option) => (
          <label
            key={option.value}
            className={`flex min-w-0 items-start gap-3 rounded-xl border border-skin-stroke bg-white p-3 ${
              disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer"
            }`}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              disabled={disabled}
              className="mt-1 h-4 w-4 shrink-0 accent-[#ffcc00]"
            />
            <span className="min-w-0">
              <span className="block break-words font-heading text-sm text-skin-base">
                {option.label}
              </span>
              <span className="mt-1 block break-words text-xs leading-snug text-secondary">
                {option.note}
              </span>
            </span>
          </label>
        ))}
      </div>
      {value === "custom" && customDateField ? (
        <div className="mt-3 max-w-sm">{customDateField}</div>
      ) : null}
      {effectiveSnapshotLabel ? (
        <p className="mt-3 text-sm leading-snug text-secondary">
          Effective snapshot:{" "}
          <span className="break-words">{effectiveSnapshotLabel}</span>
          {lockedSnapshotBlock !== null && lockedSnapshotBlock !== undefined
            ? ` | Base block ${lockedSnapshotBlock}. Snapshot timing is locked.`
            : ""}
        </p>
      ) : null}
    </fieldset>
  );
}
