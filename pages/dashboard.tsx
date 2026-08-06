import CustomConnectButton from "@/components/CustomConnectButton";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
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

const isFullWidthPanel = (key: (typeof panelDefinitions)[number][0]) =>
  key === "yellowProposals" || key === "nounsProposals";

export default function DashboardPage() {
  const isMounted = useIsMounted();
  const { isConnected } = useAccount();
  const { data, error } = useSWR<DashboardPayload>(
    "/api/dashboard",
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

        {isMounted && !isConnected && (
          <section className="yc-dark-yellow-form-surface flex flex-col items-start rounded-2xl border border-skin-stroke bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between md:gap-6 md:p-6">
            <div>
              <h2 className="font-heading text-[28px] leading-none text-skin-base">
                Wallet not connected
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-snug text-secondary">
                You can browse active rounds, votes, and activity without a wallet.
                Connect when you want to submit, vote, or use wallet-specific actions.
              </p>
            </div>
            <CustomConnectButton className="mt-4 min-h-11 rounded-xl border border-skin-stroke bg-skin-backdrop px-6 text-skin-base md:mt-0" />
          </section>
        )}

        {error ? (
          <section role="alert" className="rounded-2xl border border-skin-proposal-danger bg-skin-muted p-6 text-skin-proposal-danger">
            Unable to load the dashboard. Please try again.
          </section>
        ) : !data ? (
          <div aria-busy="true" aria-label="Loading dashboard" className="grid gap-5 lg:grid-cols-2">
            {panelDefinitions.map(([key]) => (
              <div
                key={key}
                className={`h-72 animate-pulse rounded-2xl border border-skin-stroke bg-skin-muted motion-reduce:animate-none ${
                  isFullWidthPanel(key) ? "lg:col-span-2" : ""
                }`}
              />
            ))}
          </div>
        ) : (
          <>
            <div className="grid gap-5 lg:grid-cols-2">
              {panelDefinitions.map(([key, title, description, emptyMessage, viewAllHref]) => (
                <div
                  key={key}
                  className={isFullWidthPanel(key) ? "lg:col-span-2" : ""}
                >
                  <DashboardPanel
                    id={`dashboard-${key}`}
                    title={title}
                    description={description}
                    section={data[key]}
                    emptyMessage={emptyMessage}
                    viewAllHref={viewAllHref}
                  />
                </div>
              ))}
            </div>
            <ActivityFeed />
          </>
        )}
      </main>
    </Layout>
  );
}
