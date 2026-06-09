export type TreasuryTransaction = {
  id: string;
  title: string;
  subtitle: string;
  valueLabel?: string;
  href: string;
};

type TreasuryTransactionsProps = {
  transactions: TreasuryTransaction[];
  explorerUrl: string;
};

export default function TreasuryTransactions({
  transactions,
  explorerUrl,
}: TreasuryTransactionsProps) {
  return (
    <section className="rounded-2xl border border-skin-stroke bg-skin-muted p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-heading text-3xl leading-none">
            Recent transactions
          </h2>
          <p className="mt-2 text-sm leading-snug text-secondary">
            Last 30 days from the treasury wallet.
          </p>
        </div>
        <a
          href={explorerUrl}
          target="_blank"
          rel="noreferrer"
          className="w-fit rounded-xl border border-skin-stroke bg-white px-3 py-2 font-heading text-sm leading-none transition hover:bg-[#fff7bf]"
        >
          View all on explorer
        </a>
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-skin-stroke bg-white">
        {transactions.length > 0 ? (
          transactions.map((transaction) => (
            <a
              key={transaction.id}
              href={transaction.href}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between gap-4 border-b border-skin-stroke px-4 py-3 last:border-b-0 hover:bg-[#fff7bf]"
            >
              <span className="min-w-0">
                <span className="block truncate font-heading text-lg leading-none">
                  {transaction.title}
                </span>
                <span className="mt-1 block truncate text-sm text-secondary">
                  {transaction.subtitle}
                </span>
              </span>
              {transaction.valueLabel && (
                <span className="shrink-0 font-heading text-base">
                  {transaction.valueLabel}
                </span>
              )}
            </a>
          ))
        ) : (
          <div className="p-6 text-center text-base text-secondary">
            No transactions in the last 30 days.
          </div>
        )}
      </div>
    </section>
  );
}
