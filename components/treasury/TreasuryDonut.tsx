import { useMemo, useState } from "react";

export type TreasuryDonutItem = {
  id: string;
  name: string;
  valueUsd: number;
  color: string;
  label?: string;
};

type TreasuryDonutProps = {
  items: TreasuryDonutItem[];
  totalLabel: string;
};

const radius = 70;
const circumference = 2 * Math.PI * radius;

const formatPercent = (value: number) =>
  `${value.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;

const formatUsd = (value: number) =>
  value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  });

export default function TreasuryDonut({
  items,
  totalLabel,
}: TreasuryDonutProps) {
  const valueItems = useMemo(
    () => items.filter((item) => Number.isFinite(item.valueUsd) && item.valueUsd > 0),
    [items]
  );
  const totalValue = valueItems.reduce((sum, item) => sum + item.valueUsd, 0);
  const [activeId, setActiveId] = useState(valueItems[0]?.id || "");

  const segments = useMemo(() => {
    let offset = 0;

    return valueItems.map((item) => {
      const percent = totalValue > 0 ? (item.valueUsd / totalValue) * 100 : 0;
      const length = (percent / 100) * circumference;
      const segment = {
        ...item,
        percent,
        strokeDasharray: `${length} ${circumference - length}`,
        strokeDashoffset: -offset,
      };
      offset += length;
      return segment;
    });
  }, [totalValue, valueItems]);

  const activeSegment =
    segments.find((segment) => segment.id === activeId) || segments[0] || null;

  return (
    <div className="rounded-2xl border border-skin-stroke bg-skin-muted p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-3xl leading-none">
            Portfolio allocation
          </h2>
          <p className="mt-2 text-sm leading-snug text-secondary">
            Hover a slice for asset-level value.
          </p>
        </div>
        <span className="rounded-full border border-skin-stroke bg-accent px-3 py-1 font-heading text-sm text-[#212529]">
          Live
        </span>
      </div>

      <div className="mt-6 flex flex-col items-center">
        <div className="relative h-[220px] w-[220px]">
          <svg
            viewBox="0 0 180 180"
            role="img"
            aria-label="Treasury portfolio allocation"
            className="h-full w-full"
          >
            <circle
              cx="90"
              cy="90"
              r={radius}
              fill="transparent"
              stroke="rgb(var(--color-surface-muted))"
              strokeWidth="18"
            />
            {segments.length > 0 ? (
              segments.map((segment) => (
                <circle
                  key={segment.id}
                  cx="90"
                  cy="90"
                  r={radius}
                  fill="transparent"
                  stroke={segment.color}
                  strokeWidth="18"
                  strokeDasharray={segment.strokeDasharray}
                  strokeDashoffset={segment.strokeDashoffset}
                  strokeLinecap="butt"
                  transform="rotate(-90 90 90)"
                  className="cursor-pointer transition-opacity hover:opacity-80"
                  onMouseEnter={() => setActiveId(segment.id)}
                  onFocus={() => setActiveId(segment.id)}
                  tabIndex={0}
                />
              ))
            ) : (
              <circle
                cx="90"
                cy="90"
                r={radius}
                fill="transparent"
                stroke="rgb(var(--color-accent))"
                strokeDasharray={`${circumference * 0.24} ${
                  circumference * 0.76
                }`}
                strokeWidth="18"
                strokeLinecap="round"
                transform="rotate(-90 90 90)"
              />
            )}
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
            <div className="font-heading text-3xl leading-none">
              {activeSegment ? formatUsd(activeSegment.valueUsd) : totalLabel}
            </div>
            <div className="mt-2 text-sm leading-tight text-secondary">
              {activeSegment
                ? `${activeSegment.name} / ${formatPercent(
                    activeSegment.percent
                  )}`
                : "USD unavailable"}
            </div>
          </div>
        </div>

        <div className="mt-6 w-full space-y-3">
          {segments.length > 0 ? (
            segments.map((segment) => (
              <button
                key={segment.id}
                type="button"
                onMouseEnter={() => setActiveId(segment.id)}
                onFocus={() => setActiveId(segment.id)}
                className="yc-force-white flex w-full items-center justify-between gap-3 rounded-xl border border-skin-stroke bg-white px-3 py-2 text-left transition hover:bg-[#fff7bf]"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: segment.color }}
                  />
                  <span className="truncate text-base">{segment.name}</span>
                </span>
                <span className="font-heading text-base">
                  {formatPercent(segment.percent)}
                </span>
              </button>
            ))
          ) : (
            <div className="yc-force-white rounded-xl border border-dashed border-skin-stroke bg-white p-4 text-center text-sm leading-snug text-secondary">
              Allocation appears once live USD pricing is available.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
