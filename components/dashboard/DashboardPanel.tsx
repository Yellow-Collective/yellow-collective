import type {
  DashboardActionItem,
  DashboardSection,
} from "@/utils/dashboard";
import Link from "next/link";

type DashboardPanelProps = {
  id: string;
  title: string;
  description: string;
  section: DashboardSection;
  emptyMessage: string;
  viewAllHref: string;
};

const formatDeadline = (deadline: number) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(deadline));

const ActionRow = ({ item }: { item: DashboardActionItem }) => (
  <li className="rounded-xl border border-skin-stroke bg-skin-muted p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="font-heading text-sm text-secondary">{item.label}</span>
      <span className="rounded-full bg-[#fff7bf] px-2.5 py-1 text-xs font-semibold text-[#6d5600]">
        {item.status}
      </span>
    </div>
    <h3 className="mt-2 break-words font-heading text-xl leading-tight text-skin-base">
      {item.title}
    </h3>
    <div className="mt-3 text-sm text-secondary">
      {item.deadlineLabel} {formatDeadline(item.deadline)}
    </div>
    {item.stats.length > 0 && (
      <div className="mt-1 flex flex-wrap gap-x-3 text-sm text-secondary">
        {item.stats.map((stat) => (
          <span key={stat}>{stat}</span>
        ))}
      </div>
    )}
    <Link
      href={item.href}
      className="yc-dark-submit-blue mt-4 inline-flex min-h-11 items-center justify-center rounded-[18px] bg-[#1d9bf0] px-4 py-2 font-heading text-base text-white shadow-[0px_4.02px_0px_0px_#0f5f99] transition hover:-translate-y-0.5 hover:bg-[#45adf5] hover:shadow-[0px_6px_0px_0px_#0f5f99] active:translate-y-1 active:shadow-none motion-reduce:transform-none"
    >
      {item.actionLabel}
    </Link>
  </li>
);

export const DashboardPanel = ({
  id,
  title,
  description,
  section,
  emptyMessage,
  viewAllHref,
}: DashboardPanelProps) => (
  <section
    aria-labelledby={id}
    className="yc-dark-yellow-form-surface flex min-h-[280px] flex-col rounded-2xl border border-skin-stroke bg-white p-5 shadow-[0px_4.02px_0px_0px_rgb(var(--color-shadow-neutral))] md:p-6"
  >
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 id={id} className="font-heading text-[28px] leading-none text-skin-base">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-snug text-secondary">{description}</p>
      </div>
      <span className="shrink-0 rounded-full border border-skin-stroke bg-[#fff7bf] px-3 py-1 font-heading text-sm text-[#212529]">
        {section.total}
      </span>
    </div>

    {section.error ? (
      <div role="alert" className="mt-5 rounded-xl border border-skin-proposal-danger bg-white p-4 text-sm text-skin-proposal-danger">
        {section.error}
      </div>
    ) : section.items.length > 0 ? (
      <ul className="mt-5 flex flex-col gap-3" role="list">
        {section.items.map((item) => (
          <ActionRow key={item.id} item={item} />
        ))}
      </ul>
    ) : (
      <div role="status" className="mt-5 rounded-xl border border-skin-stroke bg-skin-muted p-4 text-sm text-secondary">
        {emptyMessage}
      </div>
    )}

    {section.total > section.items.length && (
      <Link href={viewAllHref} className="mt-5 w-fit font-heading text-base text-skin-base underline decoration-2 underline-offset-4">
        View all
      </Link>
    )}
  </section>
);
