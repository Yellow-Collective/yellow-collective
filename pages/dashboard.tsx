import CustomConnectButton from "@/components/CustomConnectButton";
import { DashboardPanel } from "@/components/dashboard/DashboardPanel";
import Layout from "@/components/Layout";
import { useIsMounted } from "@/hooks/useIsMounted";
import type { DashboardPayload } from "@/utils/dashboard";
import Head from "next/head";
import useSWR from "swr";
import { useAccount } from "wagmi";

const panelDefinitions = [
  ["submissions", "Open for submissions", "Rounds accepting new entries.", "No rounds are accepting submissions.", "/rounds"],
  ["voting", "Round voting", "Rounds ready for community review.", "No rounds are open for voting.", "/rounds"],
  ["yellowProposals", "Yellow proposals", "Active Collective governance votes.", "No Yellow proposals are active.", "/proposals"],
  ["nounsProposals", "Nouns proposals", "Active Yellow Snapshot metagovernance votes.", "No Yellow Nouns votes are active.", "/proposals/nouns"],
] as const;

export default function DashboardPage() {
  const isMounted = useIsMounted();
  const { isConnected } = useAccount();
  const { data, error } = useSWR<DashboardPayload>(
    isMounted && isConnected ? "/api/dashboard" : null,
    { refreshInterval: 60_000, revalidateOnFocus: true }
  );

  return (
    <Layout>
      <Head>
        <title>Dashboard | Yellow Collective</title>
      </Head>
      <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 pb-12">
        <header className="yc-dark-yellow-form-surface rounded-2xl border border-skin-stroke bg-white p-6 shadow-sm md:p-8">
          <h1 className="font-heading text-[42px] leading-none text-skin-base md:text-[58px]">
            Dashboard
          </h1>
          <p className="mt-3 max-w-2xl text-lg leading-snug text-secondary">
            What needs your attention across Yellow Collective.
          </p>
        </header>

        {(!isMounted || !isConnected) ? (
          <section className="yc-dark-yellow-form-surface flex flex-col items-start rounded-2xl border border-skin-stroke bg-white p-6 shadow-sm md:p-8">
            <h2 className="font-heading text-[30px] leading-none text-skin-base">
              Connect your wallet
            </h2>
            <p className="mt-3 max-w-xl text-base text-secondary">
              Connect to see active rounds and governance votes in one place.
            </p>
            {isMounted && (
              <CustomConnectButton className="mt-5 min-h-11 rounded-xl border border-skin-stroke bg-skin-backdrop px-6 text-skin-base" />
            )}
          </section>
        ) : error ? (
          <section role="alert" className="rounded-2xl border border-skin-proposal-danger bg-skin-muted p-6 text-skin-proposal-danger">
            Unable to load the dashboard. Please try again.
          </section>
        ) : !data ? (
          <div aria-busy="true" aria-label="Loading dashboard" className="grid gap-5 lg:grid-cols-2">
            {panelDefinitions.map(([key]) => (
              <div key={key} className="h-72 animate-pulse rounded-2xl border border-skin-stroke bg-skin-muted motion-reduce:animate-none" />
            ))}
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            {panelDefinitions.map(([key, title, description, emptyMessage, viewAllHref]) => (
              <DashboardPanel
                key={key}
                id={`dashboard-${key}`}
                title={title}
                description={description}
                section={data[key]}
                emptyMessage={emptyMessage}
                viewAllHref={viewAllHref}
              />
            ))}
          </div>
        )}
      </main>
    </Layout>
  );
}
