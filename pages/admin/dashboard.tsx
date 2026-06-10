import Layout from "@/components/Layout";
import CoinMediaPreview from "@/components/coins/CoinMediaPreview";
import ProjectMemberSelector from "@/components/community/ProjectMemberSelector";
import {
  ADMIN_PERMISSION_DEFINITIONS,
  GLOBAL_ADMIN_WALLET_ADDRESS,
  normalizeAdminWalletAddress,
  type AdminAccessRecord,
  type AdminPermission,
} from "@/utils/admin-permissions";
import { getAdminSessionSignedRequestAction } from "@/utils/admin-auth";
import {
  getAdminRoundDatePayload,
  toDateInput,
  type SavedRoundDates,
} from "@/utils/rounds/admin-round-form";
import { createSignedRequestAuthHeader } from "@/utils/signature-auth-client";
import { getSafeLinkProps, normalizeSafeImageUrl } from "@/utils/url-safety";
import { TOKEN_NETWORK } from "constants/addresses";
import type { CommunityProject } from "data/community";
import type { CommunityProjectRecord } from "data/community-project-submissions";
import type { GalleryCoin } from "data/coins";
import type { DaoMemberSummary } from "data/members";
import type { NoundrySubmission } from "data/noundry/submissions";
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  NOTIFICATION_ALERT_GROUPS,
  buildNotificationCopy,
  validateNotificationSettings,
  validateNotificationCopy,
  type NotificationAlertKey,
  type NotificationSettings,
} from "@/utils/notifications/settings";
import type {
  Round,
  RoundSubmission,
  RoundInput,
  RoundRequest,
} from "data/rounds";
import type { GetServerSideProps } from "next";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import useSWR, { type Fetcher, type KeyedMutator } from "swr";
import { useAccount, useSignMessage } from "wagmi";

type AdminPermissionSection = Exclude<AdminPermission, "testing">;
type AdminSection = AdminPermissionSection | "access";
type CommunityListMode = "queue" | "existing";
type ProjectEditorMode = "edit" | "preview";
type RoundListMode = "draft" | "published" | "archived";

type AdminAuth = {
  adminAddress: string;
  permissions: AdminPermission[];
  isGlobal: boolean;
};

type AdminRequestBody = Record<string, unknown>;
type AdminSWRKey = readonly [string, AdminAuth];
type AdminAccessResponseRecord = AdminAccessRecord & { isGlobal: boolean };
type NotificationEventRecord = {
  id: string;
  eventType: string;
  sourceId: string;
  title: string;
  body: string;
  targetUrl: string;
  targetFids: number[];
  dryRun: boolean;
  response: {
    campaign_id?: string;
    success_count?: number;
    failure_count?: number;
    not_attempted_count?: number;
    retryable_fids?: number[];
  } | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
};
type NotificationAudienceRecord = {
  fid: number;
  username: string | null;
  displayName: string | null;
  pfpUrl: string | null;
  walletAddress: string | null;
  notificationsEnabled: boolean;
  notificationUrl: string | null;
  tokenCreatedAt: string | null;
  tokenUpdatedAt: string | null;
  lastSyncedAt: string | null;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
};
type AdminAccessResponse = {
  admins: AdminAccessResponseRecord[];
  permissionDefinitions: typeof ADMIN_PERMISSION_DEFINITIONS;
};

const adminSections: { id: AdminSection; label: string }[] = [
  {
    id: "access",
    label: "Admin Access",
  },
  {
    id: "community",
    label: "Community Projects",
  },
  {
    id: "noundry",
    label: "Noundry Gallery",
  },
  {
    id: "gallery",
    label: "Gallery",
  },
  {
    id: "rounds",
    label: "Rounds",
  },
  {
    id: "nouns",
    label: "Nouns + Metagov",
  },
  {
    id: "notifications",
    label: "Notifications",
  },
];

const adminSectionIds = new Set(adminSections.map((section) => section.id));

const communityListModes: { id: CommunityListMode; label: string }[] = [
  {
    id: "queue",
    label: "Queue",
  },
  {
    id: "existing",
    label: "Existing projects",
  },
];
const projectEditorModes: { id: ProjectEditorMode; label: string }[] = [
  {
    id: "edit",
    label: "Edit",
  },
  {
    id: "preview",
    label: "Preview",
  },
];

const fieldClass =
  "w-full rounded-[18px] border border-skin-stroke bg-white px-4 py-3 text-base text-skin-base outline-none transition focus:border-[#d7aa00] focus:ring-2 focus:ring-[#ffcc00]/30";
const labelClass = "block text-sm font-semibold text-secondary";
const primaryButtonClass =
  "whitespace-nowrap rounded-[18px] bg-accent px-5 py-3 font-heading text-base text-skin-base shadow-[0px_4.02px_0px_0px_#b89400] transition hover:-translate-y-0.5 hover:bg-[#ffd84d] hover:shadow-[0px_6px_0px_0px_#b89400] active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50";
const saveButtonClass =
  "yc-admin-save-button whitespace-nowrap rounded-[18px] bg-[#16a34a] px-5 py-3 font-heading text-base text-white shadow-[0px_4.02px_0px_0px_#15803d] transition hover:-translate-y-0.5 hover:bg-[#22c55e] hover:shadow-[0px_6px_0px_0px_#15803d] active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButtonClass =
  "whitespace-nowrap rounded-[18px] border border-skin-stroke bg-white px-5 py-3 font-heading text-base text-skin-base shadow-[0px_4.02px_0px_0px_rgb(var(--color-shadow-neutral))] transition hover:-translate-y-0.5 hover:bg-[#fff7bf] hover:shadow-[0px_6px_0px_0px_rgb(var(--color-shadow-neutral))] active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50";
const dangerButtonClass =
  "yc-dark-reset-red whitespace-nowrap rounded-[18px] bg-[#c93d2f] px-5 py-3 font-heading text-base text-white shadow-[0px_4.02px_0px_0px_#7f2219] transition hover:-translate-y-0.5 hover:bg-[#d95042] hover:shadow-[0px_6px_0px_0px_#7f2219] active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50";
const blueButtonClass =
  "yc-dark-submit-blue whitespace-nowrap rounded-[18px] bg-[#1d9bf0] px-5 py-3 font-heading text-base text-white shadow-[0px_4.02px_0px_0px_#0f5f99] transition hover:-translate-y-0.5 hover:bg-[#45adf5] hover:shadow-[0px_6px_0px_0px_#0f5f99] active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50";

const ADMIN_CHAIN_ID = Number(TOKEN_NETWORK);

const createAdminSession = async (
  adminAddress: string,
  signMessageAsync: (args: { message: string }) => Promise<string>
) => {
  const authorization = await createSignedRequestAuthHeader({
    walletAddress: adminAddress,
    chainId: ADMIN_CHAIN_ID,
    action: getAdminSessionSignedRequestAction(),
    method: "POST",
    path: "/api/admin/session",
    payload: {},
    signMessageAsync,
  });
  const response = await fetch("/api/admin/session", {
    method: "POST",
    headers: { Authorization: authorization },
    cache: "no-store",
    credentials: "same-origin",
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Unable to authorize admin session.");
  }

  return data as AdminAuth;
};

const createAdminFetcher =
  <T,>(): Fetcher<T, AdminSWRKey> =>
  async (key) => {
    const [url] = key;
    const response = await fetch(url, {
      cache: "no-store",
      credentials: "same-origin",
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Admin request failed.");
    }

    return data;
  };

const memberSummariesFetcher = async (url: string) => {
  const response = await fetch(url);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Unable to load members.");
  }

  return data as { members: DaoMemberSummary[] };
};

const communityProjectsFetcher = createAdminFetcher<{
  projects: CommunityProjectRecord[];
}>();

const noundrySubmissionsFetcher = createAdminFetcher<{
  submissions: NoundrySubmission[];
}>();

const galleryFetcher = createAdminFetcher<{
  coins: GalleryCoin[];
  galleryPublicEnabled: boolean;
}>();

const roundsFetcher = createAdminFetcher<{
  rounds: Round[];
}>();

const roundsSettingsFetcher = createAdminFetcher<{
  roundsPublicEnabled: boolean;
}>();

const testingSettingsFetcher = createAdminFetcher<{
  dummyContentEnabled: boolean;
}>();

const nounsSettingsFetcher = createAdminFetcher<{
  nounsMetagovEnabled: boolean;
}>();

const notificationsSettingsFetcher = createAdminFetcher<{
  settings: NotificationSettings;
}>();

const notificationsEventsFetcher = createAdminFetcher<{
  events: NotificationEventRecord[];
}>();

const notificationsAudienceFetcher = createAdminFetcher<{
  audience: NotificationAudienceRecord[];
  syncedCount?: number;
}>();

const adminAccessFetcher = createAdminFetcher<AdminAccessResponse>();

const roundSubmissionsFetcher = createAdminFetcher<{
  submissions: RoundSubmission[];
}>();

const roundRequestsFetcher = createAdminFetcher<{
  requests: RoundRequest[];
}>();

export const getServerSideProps: GetServerSideProps = async () => ({
  props: {},
});

const sendAdminRequest = async (
  path: string,
  auth: AdminAuth,
  method: "PATCH" | "DELETE" | "POST",
  body: AdminRequestBody = {}
) => {
  void auth;
  const response = await fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
  const responseText = await response.text();
  const data = responseText
    ? (() => {
        try {
          return JSON.parse(responseText);
        } catch {
          return { error: responseText };
        }
      })()
    : {};

  if (!response.ok) {
    throw new Error(data.error || "Admin update failed.");
  }

  return data;
};

const toLines = (items?: string[]) => (items || []).join("\n");

const fromLines = (value: string) =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

const formatLinks = (links?: CommunityProject["links"]) =>
  (links || []).map((link) => `${link.title} | ${link.href}`).join("\n");

const parseLinks = (value: string) =>
  fromLines(value)
    .map((line) => {
      const [title, ...hrefParts] = line.split("|");
      return {
        title: title.trim(),
        href: hrefParts.join("|").trim(),
      };
    })
    .filter((link) => link.title && link.href);

const formatTraits = (traits: Record<string, string>) =>
  Object.entries(traits || {})
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");

const parseTraits = (value: string) =>
  Object.fromEntries(
    fromLines(value)
      .map((line) => {
        const [key, ...valueParts] = line.split(":");
        return [key.trim(), valueParts.join(":").trim()];
      })
      .filter(([key, value]) => key && value)
  );

const formatAwards = (awards: Round["awards"] = []) =>
  awards
    .map(
      (award) =>
        `${award.position} | ${award.title} | ${award.value} | ${award.description}`
    )
    .join("\n");

const parseAwards = (value: string) =>
  fromLines(value)
    .map((line, index) => {
      const [position, title, awardValue, ...descriptionParts] =
        line.split("|");

      return {
        position: Number(position?.trim()) || index + 1,
        title: title?.trim() || "",
        value: awardValue?.trim() || "",
        description: descriptionParts.join("|").trim(),
      };
    })
    .filter((award) => award.title || award.value || award.description);

const formatVotingStrategy = (
  strategy: Round["votingStrategy"],
  votesPerWallet = 1
) =>
  strategy === "one_per_wallet"
    ? "1 vote per wallet"
    : strategy === "fixed_per_wallet"
      ? `${votesPerWallet} votes per wallet`
      : "1 vote per delegated Collective Noun vote";

const getQueryValue = (value: string | string[] | undefined) =>
  typeof value === "string" ? value : value?.[0];

const getAdminSectionFromQuery = (
  value: string | string[] | undefined
): AdminSection =>
  adminSectionIds.has(getQueryValue(value) as AdminSection)
    ? (getQueryValue(value) as AdminSection)
    : "community";

export default function AdminDashboardPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { signMessageAsync, isLoading: isSigning } = useSignMessage();
  const [adminAuth, setAdminAuth] = useState<AdminAuth | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(false);
  const activeSection = getAdminSectionFromQuery(router.query.section);
  const hasPermission = (permission: AdminPermission) =>
    Boolean(adminAuth?.permissions.includes(permission));
  const canAccessSection = (section: AdminSection) =>
    Boolean(
      adminAuth &&
        (section === "access" ? adminAuth.isGlobal : hasPermission(section))
    );
  const visibleAdminSections = adminAuth
    ? adminSections.filter((section) => canAccessSection(section.id))
    : adminSections;
  const activeSectionAllowed = canAccessSection(activeSection);

  const communityKey = adminAuth && hasPermission("community")
    ? (["/api/admin/community-projects", adminAuth] as const)
    : null;
  const noundryKey = adminAuth && hasPermission("noundry")
    ? (["/api/admin/noundry-submissions", adminAuth] as const)
    : null;
  const galleryKey = adminAuth && hasPermission("gallery")
    ? (["/api/admin/gallery", adminAuth] as const)
    : null;
  const roundsKey = adminAuth && hasPermission("rounds")
    ? (["/api/admin/rounds", adminAuth] as const)
    : null;
  const roundsSettingsKey = adminAuth && hasPermission("rounds")
    ? (["/api/admin/rounds/settings", adminAuth] as const)
    : null;
  const testingSettingsKey = adminAuth && hasPermission("testing")
    ? (["/api/admin/testing/settings", adminAuth] as const)
    : null;
  const nounsSettingsKey = adminAuth && hasPermission("nouns")
    ? (["/api/admin/nouns/settings", adminAuth] as const)
    : null;
  const notificationsSettingsKey = adminAuth && hasPermission("notifications")
    ? (["/api/admin/notifications/settings", adminAuth] as const)
    : null;
  const notificationsEventsKey = adminAuth && hasPermission("notifications")
    ? (["/api/admin/notifications/events", adminAuth] as const)
    : null;
  const notificationsAudienceKey = adminAuth && hasPermission("notifications")
    ? (["/api/admin/notifications/audience", adminAuth] as const)
    : null;
  const roundRequestsKey = adminAuth && hasPermission("rounds")
    ? (["/api/admin/rounds/requests", adminAuth] as const)
    : null;
  const adminAccessKey = adminAuth?.isGlobal
    ? (["/api/admin/access", adminAuth] as const)
    : null;

  const {
    data: communityData,
    error: communityError,
    mutate: mutateCommunity,
  } = useSWR<{ projects: CommunityProjectRecord[] }, Error, AdminSWRKey | null>(
    communityKey,
    communityProjectsFetcher
  );
  const {
    data: noundryData,
    error: noundryError,
    mutate: mutateNoundry,
  } = useSWR<{ submissions: NoundrySubmission[] }, Error, AdminSWRKey | null>(
    noundryKey,
    noundrySubmissionsFetcher
  );
  const {
    data: galleryData,
    error: galleryError,
    mutate: mutateGallery,
  } = useSWR<
    { coins: GalleryCoin[]; galleryPublicEnabled: boolean },
    Error,
    AdminSWRKey | null
  >(galleryKey, galleryFetcher);

  const {
    data: roundsData,
    error: roundsError,
    mutate: mutateRounds,
  } = useSWR<{ rounds: Round[] }, Error, AdminSWRKey | null>(
    roundsKey,
    roundsFetcher
  );
  const {
    data: roundsSettingsData,
    error: roundsSettingsError,
    mutate: mutateRoundsSettings,
  } = useSWR<{ roundsPublicEnabled: boolean }, Error, AdminSWRKey | null>(
    roundsSettingsKey,
    roundsSettingsFetcher
  );
  const {
    data: testingSettingsData,
    error: testingSettingsError,
    mutate: mutateTestingSettings,
  } = useSWR<{ dummyContentEnabled: boolean }, Error, AdminSWRKey | null>(
    testingSettingsKey,
    testingSettingsFetcher
  );
  const {
    data: nounsSettingsData,
    error: nounsSettingsError,
    mutate: mutateNounsSettings,
  } = useSWR<{ nounsMetagovEnabled: boolean }, Error, AdminSWRKey | null>(
    nounsSettingsKey,
    nounsSettingsFetcher
  );
  const {
    data: notificationsSettingsData,
    error: notificationsSettingsError,
    mutate: mutateNotificationsSettings,
  } = useSWR<{ settings: NotificationSettings }, Error, AdminSWRKey | null>(
    notificationsSettingsKey,
    notificationsSettingsFetcher
  );
  const {
    data: notificationsEventsData,
    error: notificationsEventsError,
    mutate: mutateNotificationsEvents,
  } = useSWR<{ events: NotificationEventRecord[] }, Error, AdminSWRKey | null>(
    notificationsEventsKey,
    notificationsEventsFetcher
  );
  const {
    data: notificationsAudienceData,
    error: notificationsAudienceError,
    mutate: mutateNotificationsAudience,
  } = useSWR<
    { audience: NotificationAudienceRecord[]; syncedCount?: number },
    Error,
    AdminSWRKey | null
  >(notificationsAudienceKey, notificationsAudienceFetcher);
  const {
    data: adminAccessData,
    error: adminAccessError,
    mutate: mutateAdminAccess,
  } = useSWR<AdminAccessResponse, Error, AdminSWRKey | null>(
    adminAccessKey,
    adminAccessFetcher
  );
  const {
    data: roundRequestsData,
    error: roundRequestsError,
    mutate: mutateRoundRequests,
  } = useSWR<{ requests: RoundRequest[] }, Error, AdminSWRKey | null>(
    roundRequestsKey,
    roundRequestsFetcher
  );

  useEffect(() => {
    if (!address || !adminAuth) return;
    if (adminAuth.adminAddress.toLowerCase() !== address.toLowerCase()) {
      setAdminAuth(null);
    }
  }, [address, adminAuth]);

  useEffect(() => {
    if (!address || adminAuth) return;

    let isMounted = true;
    setIsCheckingSession(true);
    void fetch("/api/admin/session", {
      cache: "no-store",
      credentials: "same-origin",
    })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as AdminAuth;
      })
      .then((data) => {
        if (
          isMounted &&
          data?.adminAddress &&
          data.adminAddress.toLowerCase() === address.toLowerCase()
        ) {
          setAdminAuth(data);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (isMounted) setIsCheckingSession(false);
      });

    return () => {
      isMounted = false;
    };
  }, [address, adminAuth]);

  useEffect(() => {
    if (!adminAuth || activeSectionAllowed || visibleAdminSections.length === 0) {
      return;
    }

    void router.replace(
      {
        pathname: "/admin/dashboard",
        query: { section: visibleAdminSections[0].id },
      },
      undefined,
      { shallow: true }
    );
  }, [activeSectionAllowed, adminAuth, router, visibleAdminSections]);

  const authorize = async () => {
    if (!address) return;

    try {
      setAuthError(null);
      const session = await createAdminSession(address, signMessageAsync);
      setAdminAuth(session);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to authorize admin.";
      setAuthError(message);
    }
  };

  const setSection = (section: AdminSection) => {
    void router.push(
      { pathname: "/admin/dashboard", query: { section } },
      undefined,
      { shallow: true }
    );
  };

  return (
    <Layout>
      <Head>
        <title>Admin Dashboard | Yellow Collective</title>
      </Head>

      <div className="yc-admin-dashboard mx-auto flex w-full max-w-[1440px] flex-col gap-7 pb-12">
        <section className="yc-dark-yellow-surface rounded-2xl border border-skin-stroke bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="font-heading text-[42px] leading-none text-skin-base md:text-[58px]">
                Admin Dashboard
              </h1>
              <p className="mt-4 max-w-3xl text-lg leading-snug text-secondary">
                Review database submissions, approve community projects, and
                manage Gallery, Noundry, rounds, and Nouns metagov access.
              </p>
            </div>
            {isConnected && (
              <button
                type="button"
                onClick={authorize}
                disabled={isSigning || isCheckingSession}
                className={dangerButtonClass}
              >
                {adminAuth
                  ? "Admin access active"
                  : isSigning
                    ? "Signing..."
                    : isCheckingSession
                      ? "Checking..."
                    : "Unlock admin requests"}
              </button>
            )}
          </div>
        </section>

        {!isConnected && (
          <AdminNotice title="Connect wallet">
            Connect the admin wallet to load this dashboard.
          </AdminNotice>
        )}
        {isConnected && authError && (
          <AdminNotice title="Signature failed">{authError}</AdminNotice>
        )}
        {isConnected && !adminAuth && !isCheckingSession && (
          <AdminNotice title="Signature required">
            Unlock admin requests once. The server will verify whether this
            wallet has dashboard access.
          </AdminNotice>
        )}

        {adminAuth && (
          <section className="flex flex-col gap-6">
            <div className="flex flex-nowrap justify-center gap-1 overflow-x-auto border-b border-skin-stroke sm:gap-3">
              {visibleAdminSections.map((section) => {
                const isActive = activeSection === section.id;

                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setSection(section.id)}
                    className={`proposal-detail-tab min-w-0 flex-1 whitespace-nowrap rounded-t-xl border border-b-0 border-skin-stroke px-2 py-3 text-center font-heading text-sm font-bold leading-none shadow-[4px_0px_0px_0px_rgb(var(--color-shadow-neutral))] transition-colors active:translate-x-1 active:shadow-none sm:flex-none sm:px-5 sm:text-base ${
                      isActive
                        ? "proposal-detail-tab-active bg-white text-skin-base"
                        : "proposal-detail-tab-inactive bg-[#fff7bf] text-secondary hover:bg-white"
                    }`}
                  >
                    {section.label}
                  </button>
                );
              })}
            </div>
            {visibleAdminSections.length === 0 ? (
              <AdminNotice title="No admin sections enabled">
                This wallet is an admin, but it does not currently have access
                to any dashboard sections.
              </AdminNotice>
            ) : !activeSectionAllowed ? (
              <AdminNotice title="Access denied">
                This wallet does not have access to that dashboard section.
              </AdminNotice>
            ) : (
              <>
                {activeSection === "access" ? (
                  <AdminAccessPanel
                    adminAuth={adminAuth}
                    admins={adminAccessData?.admins || []}
                    permissionDefinitions={
                      adminAccessData?.permissionDefinitions ||
                      ADMIN_PERMISSION_DEFINITIONS
                    }
                    error={adminAccessError?.message}
                    isLoading={!adminAccessData && !adminAccessError}
                    mutate={mutateAdminAccess}
                  />
                ) : (
                  <>
                    {hasPermission("testing") && (
                      <TestingSettingsPanel
                        adminAuth={adminAuth}
                        dummyContentEnabled={
                          testingSettingsData?.dummyContentEnabled || false
                        }
                        error={testingSettingsError?.message}
                        isLoading={!testingSettingsData && !testingSettingsError}
                        mutate={mutateTestingSettings}
                      />
                    )}
                    {activeSection === "community" ? (
                      <CommunityAdminPanel
                        adminAuth={adminAuth}
                        projects={communityData?.projects || []}
                        error={communityError?.message}
                        isLoading={!communityData && !communityError}
                        mutate={mutateCommunity}
                      />
                    ) : activeSection === "noundry" ? (
                      <NoundryAdminPanel
                        adminAuth={adminAuth}
                        submissions={noundryData?.submissions || []}
                        error={noundryError?.message}
                        isLoading={!noundryData && !noundryError}
                        mutate={mutateNoundry}
                      />
                    ) : activeSection === "gallery" ? (
                      <GalleryAdminPanel
                        adminAuth={adminAuth}
                        coins={galleryData?.coins || []}
                        galleryPublicEnabled={
                          galleryData?.galleryPublicEnabled ?? true
                        }
                        error={galleryError?.message}
                        isLoading={!galleryData && !galleryError}
                        mutate={mutateGallery}
                      />
                    ) : activeSection === "nouns" ? (
                      <NounsMetagovAdminPanel
                        adminAuth={adminAuth}
                        nounsMetagovEnabled={
                          nounsSettingsData?.nounsMetagovEnabled ?? true
                        }
                        error={nounsSettingsError?.message}
                        isLoading={!nounsSettingsData && !nounsSettingsError}
                        mutate={mutateNounsSettings}
                      />
                    ) : activeSection === "notifications" ? (
                      <NotificationsAdminPanel
                        adminAuth={adminAuth}
                        settings={
                          notificationsSettingsData?.settings ||
                          DEFAULT_NOTIFICATION_SETTINGS
                        }
                        error={notificationsSettingsError?.message}
                        logError={notificationsEventsError?.message}
                        audienceError={notificationsAudienceError?.message}
                        isLoading={
                          !notificationsSettingsData &&
                          !notificationsSettingsError
                        }
                        isLogLoading={
                          !notificationsEventsData && !notificationsEventsError
                        }
                        isAudienceLoading={
                          !notificationsAudienceData &&
                          !notificationsAudienceError
                        }
                        events={notificationsEventsData?.events || []}
                        audience={notificationsAudienceData?.audience || []}
                        mutate={mutateNotificationsSettings}
                        mutateEvents={mutateNotificationsEvents}
                        mutateAudience={mutateNotificationsAudience}
                      />
                    ) : (
                      <RoundsAdminPanel
                        adminAuth={adminAuth}
                        rounds={roundsData?.rounds || []}
                        requests={roundRequestsData?.requests || []}
                        roundsPublicEnabled={
                          roundsSettingsData?.roundsPublicEnabled || false
                        }
                        error={
                          roundsError?.message ||
                          roundsSettingsError?.message ||
                          roundRequestsError?.message
                        }
                        isLoading={
                          (!roundsData && !roundsError) ||
                          (!roundsSettingsData && !roundsSettingsError) ||
                          (!roundRequestsData && !roundRequestsError)
                        }
                        mutate={mutateRounds}
                        mutateSettings={mutateRoundsSettings}
                        mutateRequests={mutateRoundRequests}
                      />
                    )}
                  </>
                )}
              </>
            )}
          </section>
        )}
      </div>
    </Layout>
  );
}

const AdminNotice = ({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) => (
  <section className="yc-dark-yellow-surface rounded-2xl border border-skin-stroke bg-white p-6 shadow-sm">
    <h2 className="font-heading text-2xl leading-none text-skin-base">
      {title}
    </h2>
    <p className="mt-2 text-base text-secondary">{children}</p>
  </section>
);

const AdminAccessPanel = ({
  adminAuth,
  admins,
  permissionDefinitions,
  error,
  isLoading,
  mutate,
}: {
  adminAuth: AdminAuth;
  admins: AdminAccessResponseRecord[];
  permissionDefinitions: typeof ADMIN_PERMISSION_DEFINITIONS;
  error?: string;
  isLoading: boolean;
  mutate: KeyedMutator<AdminAccessResponse>;
}) => {
  const [newAdminWallet, setNewAdminWallet] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const editableAdmins = admins
    .filter((admin) => !admin.isGlobal)
    .map(({ isGlobal, ...admin }) => admin);

  const saveAdmins = async (
    nextAdmins: AdminAccessRecord[],
    successMessage: string
  ) => {
    try {
      setIsSaving(true);
      setLocalError(null);
      setMessage(null);
      const result = await sendAdminRequest(
        "/api/admin/access",
        adminAuth,
        "PATCH",
        { admins: nextAdmins }
      );
      await mutate(result as AdminAccessResponse, { revalidate: false });
      setMessage(successMessage);
    } catch (saveError) {
      const nextError =
        saveError instanceof Error
          ? saveError.message
          : "Unable to update admin access.";
      setLocalError(nextError);
    } finally {
      setIsSaving(false);
    }
  };

  const addAdmin = async () => {
    const walletAddress = normalizeAdminWalletAddress(newAdminWallet);

    if (!walletAddress) {
      setLocalError("Enter a valid wallet address.");
      return;
    }

    if (walletAddress === GLOBAL_ADMIN_WALLET_ADDRESS) {
      setLocalError("The global admin wallet is already included.");
      return;
    }

    if (
      admins.some(
        (admin) => admin.walletAddress.toLowerCase() === walletAddress.toLowerCase()
      )
    ) {
      setLocalError("That wallet is already an admin.");
      return;
    }

    await saveAdmins(
      [...editableAdmins, { walletAddress, permissions: [] }],
      "Admin wallet added."
    );
    setNewAdminWallet("");
  };

  const removeAdmin = async (walletAddress: string) => {
    await saveAdmins(
      editableAdmins.filter((admin) => admin.walletAddress !== walletAddress),
      "Admin wallet removed."
    );
  };

  const togglePermission = async (
    walletAddress: string,
    permission: AdminPermission
  ) => {
    const nextAdmins = editableAdmins.map((admin) => {
      if (admin.walletAddress !== walletAddress) return admin;

      const hasExistingPermission = admin.permissions.includes(permission);
      return {
        ...admin,
        permissions: hasExistingPermission
          ? admin.permissions.filter((item) => item !== permission)
          : [...admin.permissions, permission],
      };
    });

    await saveAdmins(nextAdmins, "Admin permissions updated.");
  };

  return (
    <section className="yc-dark-yellow-form-surface flex flex-col gap-5 rounded-2xl border border-skin-stroke bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="font-heading text-3xl leading-none text-skin-base">
            Admin Access
          </h2>
          <p className="mt-2 max-w-3xl text-base leading-snug text-secondary">
            Add admin wallets and choose which dashboard areas each wallet can
            access.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 md:w-[420px]">
          <label className={labelClass} htmlFor="new-admin-wallet">
            Add admin wallet
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="new-admin-wallet"
              className={fieldClass}
              value={newAdminWallet}
              onChange={(event) => setNewAdminWallet(event.target.value)}
              placeholder="0x..."
              disabled={isSaving}
            />
            <button
              type="button"
              onClick={addAdmin}
              disabled={isSaving || !newAdminWallet.trim()}
              className={primaryButtonClass}
            >
              Add
            </button>
          </div>
        </div>
      </div>

      {(error || localError || message) && (
        <p
          className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
            error || localError
              ? "border-[#c93d2f]/40 bg-[#c93d2f]/10 text-[#8c1d1d]"
              : "border-[#16a34a]/40 bg-[#16a34a]/10 text-[#166534]"
          }`}
        >
          {error || localError || message}
        </p>
      )}

      {isLoading ? (
        <p className="text-base text-secondary">Loading admin access...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-separate border-spacing-y-3">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-secondary">
                <th className="px-3 py-2">Wallet</th>
                {permissionDefinitions.map((permission) => (
                  <th key={permission.id} className="px-3 py-2">
                    {permission.label}
                  </th>
                ))}
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((admin) => (
                <tr key={admin.walletAddress} className="bg-[#fff7bf]">
                  <td className="rounded-l-2xl px-3 py-4 font-mono text-sm text-skin-base">
                    <div className="flex flex-col gap-1">
                      <span>{admin.walletAddress}</span>
                      {admin.isGlobal && (
                        <span className="w-fit rounded-full bg-accent px-2 py-1 font-sans text-xs font-bold text-skin-base">
                          Global admin
                        </span>
                      )}
                    </div>
                  </td>
                  {permissionDefinitions.map((permission) => (
                    <td key={permission.id} className="px-3 py-4 text-center">
                      <input
                        type="checkbox"
                        checked={
                          admin.isGlobal ||
                          admin.permissions.includes(permission.id)
                        }
                        disabled={admin.isGlobal || isSaving}
                        onChange={() =>
                          togglePermission(admin.walletAddress, permission.id)
                        }
                        className="h-5 w-5 accent-[#16a34a]"
                        aria-label={`${permission.label} access for ${admin.walletAddress}`}
                      />
                    </td>
                  ))}
                  <td className="rounded-r-2xl px-3 py-4">
                    <button
                      type="button"
                      onClick={() => removeAdmin(admin.walletAddress)}
                      disabled={admin.isGlobal || isSaving}
                      className={dangerButtonClass}
                    >
                      {admin.isGlobal ? "Locked" : "Remove"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

const TestingSettingsPanel = ({
  adminAuth,
  dummyContentEnabled,
  error,
  isLoading,
  mutate,
}: {
  adminAuth: AdminAuth;
  dummyContentEnabled: boolean;
  error?: string;
  isLoading: boolean;
  mutate: KeyedMutator<{ dummyContentEnabled: boolean }>;
}) => {
  const [isUpdating, setIsUpdating] = useState(false);

  const updateDummyContent = async (enabled: boolean) => {
    try {
      setIsUpdating(true);
      await sendAdminRequest(
        "/api/admin/testing/settings",
        adminAuth,
        "PATCH",
        { dummyContentEnabled: enabled }
      );
      await mutate();
    } catch (testingError) {
      window.alert(
        testingError instanceof Error
          ? testingError.message
          : "Unable to update dummy testing content."
      );
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <section className="yc-dark-yellow-form-surface flex flex-col gap-4 rounded-2xl border border-skin-stroke bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
      <div>
        <h2 className="font-heading text-2xl leading-none text-skin-base">
          Testing content
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-snug text-secondary">
          Toggle dummy rounds, community projects, and content coin posts on
          public pages. This does not write or delete production records.
        </p>
        {error && (
          <p className="mt-2 text-sm font-semibold text-skin-proposal-danger">
            {error}
          </p>
        )}
      </div>
      <RoundsVisibilitySwitch
        enabled={dummyContentEnabled}
        isUpdating={isUpdating || isLoading}
        onChange={updateDummyContent}
      />
    </section>
  );
};

const NounsMetagovAdminPanel = ({
  adminAuth,
  nounsMetagovEnabled,
  error,
  isLoading,
  mutate,
}: {
  adminAuth: AdminAuth;
  nounsMetagovEnabled: boolean;
  error?: string;
  isLoading: boolean;
  mutate: KeyedMutator<{ nounsMetagovEnabled: boolean }>;
}) => {
  const [isUpdating, setIsUpdating] = useState(false);

  const updateNounsMetagov = async (enabled: boolean) => {
    try {
      setIsUpdating(true);
      await sendAdminRequest("/api/admin/nouns/settings", adminAuth, "PATCH", {
        nounsMetagovEnabled: enabled,
      });
      await mutate();
    } catch (nounsError) {
      window.alert(
        nounsError instanceof Error
          ? nounsError.message
          : "Unable to update Nouns metagov access."
      );
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <section className="yc-dark-yellow-form-surface flex flex-col gap-5 rounded-2xl border border-skin-stroke bg-white p-6 shadow-sm md:flex-row md:items-start md:justify-between">
      <div>
        <h2 className="font-heading text-3xl leading-none text-skin-base">
          Nouns proposals and metagov
        </h2>
        <p className="mt-3 max-w-3xl text-base leading-snug text-secondary">
          Turning this off hides the Yellow/Nouns proposal selector and blocks
          public access to Nouns proposal pages and Snapshot metagov actions.
          Connected admin wallets can still access the Nouns proposal pages.
        </p>
        {error && (
          <p className="mt-3 text-sm font-semibold text-skin-proposal-danger">
            {error}
          </p>
        )}
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/proposals/nouns" className={secondaryButtonClass}>
            Open Nouns proposals
          </Link>
          <Link href="/proposals" className={secondaryButtonClass}>
            Open Yellow proposals
          </Link>
        </div>
      </div>
      <RoundsVisibilitySwitch
        enabled={nounsMetagovEnabled}
        isUpdating={isUpdating || isLoading}
        onChange={updateNounsMetagov}
      />
    </section>
  );
};

const NotificationsAdminPanel = ({
  adminAuth,
  settings,
  events,
  audience,
  error,
  logError,
  audienceError,
  isLoading,
  isLogLoading,
  isAudienceLoading,
  mutate,
  mutateEvents,
  mutateAudience,
}: {
  adminAuth: AdminAuth;
  settings: NotificationSettings;
  events: NotificationEventRecord[];
  audience: NotificationAudienceRecord[];
  error?: string;
  logError?: string;
  audienceError?: string;
  isLoading: boolean;
  isLogLoading: boolean;
  isAudienceLoading: boolean;
  mutate: KeyedMutator<{ settings: NotificationSettings }>;
  mutateEvents: KeyedMutator<{ events: NotificationEventRecord[] }>;
  mutateAudience: KeyedMutator<{
    audience: NotificationAudienceRecord[];
    syncedCount?: number;
  }>;
}) => {
  const [draft, setDraft] = useState(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testFid, setTestFid] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const [settingsMessage, setSettingsMessage] = useState("");

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  const updateAlert = (
    key: NotificationAlertKey,
    next: Partial<NotificationSettings["alerts"][NotificationAlertKey]>
  ) => {
    setDraft((current) => ({
      ...current,
      alerts: {
        ...current.alerts,
        [key]: {
          ...current.alerts[key],
          ...next,
        },
      },
    }));
  };

  const saveSettings = async () => {
    const errors = validateNotificationSettings(draft);
    if (errors.length) {
      setSettingsMessage(errors.join(" "));
      return;
    }

    try {
      setIsSaving(true);
      setSettingsMessage("");
      await sendAdminRequest(
        "/api/admin/notifications/settings",
        adminAuth,
        "PATCH",
        { settings: draft }
      );
      await mutate();
      setSettingsMessage("Notification settings saved.");
    } catch (saveError) {
      setSettingsMessage(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save notification settings."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const sendTest = async () => {
    const fid = Number(testFid);
    if (!Number.isInteger(fid) || fid <= 0) {
      setTestMessage("Enter a valid FID.");
      return;
    }

    try {
      setIsTesting(true);
      setTestMessage("");
      const firstAlert = draft.alerts.round_published;
      const copy = buildNotificationCopy({
        alert: firstAlert,
        variables: {
          roundTitle: "Test Round",
          roundSlug: "test-round",
        },
      });
      const errors = validateNotificationCopy({
        ...copy,
        targetUrl: "https://yellowcollective.art/rounds",
      });
      if (errors.length) {
        setTestMessage(errors.join(" "));
        return;
      }

      const response = await sendAdminRequest(
        "/api/admin/notifications/test",
        adminAuth,
        "POST",
        {
          title: copy.title,
          body: copy.body,
          targetUrl: "/rounds",
          targetFids: [fid],
          dryRun: draft.dryRun,
        }
      );
      setTestMessage(
        `Test sent. Success: ${Number(
          (response as { success_count?: number }).success_count || 0
        )}`
      );
      await mutateEvents();
    } catch (testError) {
      setTestMessage(
        testError instanceof Error
          ? testError.message
          : "Unable to send test notification."
      );
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <section className="yc-dark-yellow-form-surface flex flex-col gap-6 rounded-2xl border border-skin-stroke bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="font-heading text-3xl leading-none text-skin-base">
            Notifications
          </h2>
          <p className="mt-3 max-w-3xl text-base leading-snug text-secondary">
            Control which Mini App alerts are sent and edit the copy used for
            broadcasts. Test sends always require a specific FID.
          </p>
          {error && (
            <p className="mt-3 text-sm font-semibold text-skin-proposal-danger">
              {error}
            </p>
          )}
          {settingsMessage && (
            <p className="mt-3 text-sm font-semibold text-secondary">
              {settingsMessage}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="flex items-center gap-2 rounded-xl border border-skin-stroke bg-[#fff7bf] px-4 py-3 text-sm font-semibold text-skin-base">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  enabled: event.target.checked,
                }))
              }
            />
            Enabled
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-skin-stroke bg-[#fff7bf] px-4 py-3 text-sm font-semibold text-skin-base">
            <input
              type="checkbox"
              checked={draft.dryRun}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  dryRun: event.target.checked,
                }))
              }
            />
            Dry run
          </label>
          <button
            type="button"
            onClick={saveSettings}
            disabled={isSaving || isLoading}
            className={saveButtonClass}
          >
            {isSaving ? "Saving..." : "Save settings"}
          </button>
        </div>
      </div>

      <NotificationAudiencePanel
        adminAuth={adminAuth}
        audience={audience}
        error={audienceError}
        isLoading={isAudienceLoading}
        mutate={mutateAudience}
      />

      <div className="grid gap-5">
        {NOTIFICATION_ALERT_GROUPS.map((group) => (
          <section
            key={group.id}
            className="rounded-2xl border border-skin-stroke bg-[#fff7bf] p-4"
          >
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h3 className="font-heading text-2xl leading-none text-skin-base">
                  {group.label}
                </h3>
                <p className="mt-2 text-sm text-secondary">
                  Variables: {group.variables.map((item) => `{${item}}`).join(", ")}
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-4">
              {group.alerts.map((key) => {
                const alert = draft.alerts[key];

                return (
                  <div
                    key={key}
                    className="grid gap-3 rounded-xl border border-skin-stroke bg-white p-4 md:grid-cols-[180px_1fr_1fr]"
                  >
                    <label className="flex items-center gap-2 text-sm font-semibold text-skin-base">
                      <input
                        type="checkbox"
                        checked={alert.enabled}
                        onChange={(event) =>
                          updateAlert(key, { enabled: event.target.checked })
                        }
                      />
                      {key.replaceAll("_", " ")}
                    </label>
                    <label className="flex flex-col gap-1 text-sm font-semibold text-secondary">
                      Title
                      <input
                        value={alert.titleTemplate}
                        onChange={(event) =>
                          updateAlert(key, {
                            titleTemplate: event.target.value,
                          })
                        }
                        className={fieldClass}
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm font-semibold text-secondary">
                      Body
                      <input
                        value={alert.bodyTemplate}
                        onChange={(event) =>
                          updateAlert(key, { bodyTemplate: event.target.value })
                        }
                        className={fieldClass}
                      />
                    </label>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-skin-stroke bg-white p-4 md:flex-row md:items-end">
        <label className="flex flex-1 flex-col gap-1 text-sm font-semibold text-secondary">
          Test FID
          <input
            value={testFid}
            onChange={(event) => setTestFid(event.target.value)}
            className={fieldClass}
            inputMode="numeric"
            placeholder="13870"
          />
        </label>
        <button
          type="button"
          onClick={sendTest}
          disabled={isTesting}
          className={blueButtonClass}
        >
          {isTesting ? "Sending..." : "Send test"}
        </button>
        {testMessage && (
          <p className="text-sm font-semibold text-secondary">{testMessage}</p>
        )}
      </div>

      <NotificationLogPanel
        events={events}
        error={logError}
        isLoading={isLogLoading}
        mutate={mutateEvents}
      />
    </section>
  );
};

const formatNotificationDate = (value?: string | null) => {
  if (!value) return "Not sent";

  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  });
};

const NotificationLogPanel = ({
  events,
  error,
  isLoading,
  mutate,
}: {
  events: NotificationEventRecord[];
  error?: string;
  isLoading: boolean;
  mutate: KeyedMutator<{ events: NotificationEventRecord[] }>;
}) => (
  <section className="rounded-2xl border border-skin-stroke bg-white p-4">
    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div>
        <h3 className="font-heading text-2xl leading-none text-skin-base">
          Sent notification log
        </h3>
        <p className="mt-2 max-w-3xl text-sm leading-snug text-secondary">
          This shows every notification recorded by Yellow. It can show the
          list of who received targeted notifications. Broadcast recipient lists
          are not returned by Neynar, so broadcasts show aggregate delivery
          counts and retryable FIDs only.
        </p>
        {error && (
          <p className="mt-2 text-sm font-semibold text-skin-proposal-danger">
            {error}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => void mutate()}
        disabled={isLoading}
        className={secondaryButtonClass}
      >
        Refresh log
      </button>
    </div>

    <div className="mt-4 overflow-x-auto">
      {isLoading ? (
        <p className="text-base text-secondary">Loading notification log...</p>
      ) : events.length === 0 ? (
        <p className="text-base text-secondary">
          No notifications have been recorded yet.
        </p>
      ) : (
        <table className="w-full min-w-[920px] border-separate border-spacing-y-2 text-left">
          <thead>
            <tr className="text-sm text-secondary">
              <th className="px-3 py-2">Sent</th>
              <th className="px-3 py-2">Alert</th>
              <th className="px-3 py-2">Copy</th>
              <th className="px-3 py-2">Recipients</th>
              <th className="px-3 py-2">Result</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => {
              const response = event.response || {};
              const retryableFids = response.retryable_fids || [];

              return (
                <tr key={event.id} className="bg-[#fff7bf] align-top">
                  <td className="rounded-l-2xl px-3 py-4 text-sm text-secondary">
                    {formatNotificationDate(event.sentAt)}
                    {event.dryRun && (
                      <span className="mt-1 block font-semibold">Dry run</span>
                    )}
                  </td>
                  <td className="px-3 py-4">
                    <div className="font-semibold text-skin-base">
                      {event.eventType.replaceAll("_", " ")}
                    </div>
                    <a
                      href={event.targetUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 block break-all text-sm text-secondary underline"
                    >
                      {event.targetUrl}
                    </a>
                  </td>
                  <td className="px-3 py-4">
                    <div className="font-semibold text-skin-base">
                      {event.title}
                    </div>
                    <div className="mt-1 text-sm text-secondary">
                      {event.body}
                    </div>
                  </td>
                  <td className="px-3 py-4 text-sm text-secondary">
                    {event.targetFids.length > 0 ? (
                      <span>FIDs: {event.targetFids.join(", ")}</span>
                    ) : (
                      <span>Broadcast to all enabled Mini App users</span>
                    )}
                    {retryableFids.length > 0 && (
                      <span className="mt-1 block">
                        Retryable: {retryableFids.join(", ")}
                      </span>
                    )}
                  </td>
                  <td className="rounded-r-2xl px-3 py-4 text-sm text-secondary">
                    <div>Success: {Number(response.success_count || 0)}</div>
                    <div>Failed: {Number(response.failure_count || 0)}</div>
                    <div>
                      Not attempted:{" "}
                      {Number(response.not_attempted_count || 0)}
                    </div>
                    {response.campaign_id && (
                      <div className="mt-1 break-all">
                        Campaign: {response.campaign_id}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  </section>
);

const NotificationAudiencePanel = ({
  adminAuth,
  audience,
  error,
  isLoading,
  mutate,
}: {
  adminAuth: AdminAuth;
  audience: NotificationAudienceRecord[];
  error?: string;
  isLoading: boolean;
  mutate: KeyedMutator<{
    audience: NotificationAudienceRecord[];
    syncedCount?: number;
  }>;
}) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [message, setMessage] = useState("");
  const enabledCount = audience.filter((user) => user.notificationsEnabled)
    .length;

  const syncAudience = async () => {
    try {
      setIsSyncing(true);
      setMessage("");
      const response = await sendAdminRequest(
        "/api/admin/notifications/audience",
        adminAuth,
        "POST",
        {}
      );
      await mutate(response as {
        audience: NotificationAudienceRecord[];
        syncedCount?: number;
      }, { revalidate: false });
      const syncedCount = Number(
        (response as { syncedCount?: number }).syncedCount || 0
      );
      setMessage(
        syncedCount === 0
          ? "Neynar returned 0 enabled notification tokens. If a user just enabled alerts, remove and re-add the Mini App, then force-refresh the Farcaster domain manifest and sync again."
          : `Synced ${syncedCount} enabled Mini App users from Neynar.`
      );
    } catch (syncError) {
      setMessage(
        syncError instanceof Error
          ? syncError.message
          : "Unable to sync Neynar audience."
      );
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <section className="rounded-2xl border border-skin-stroke bg-white p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="font-heading text-2xl leading-none text-skin-base">
            Mini App notification audience
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-snug text-secondary">
            Sync the current Neynar notification tokens to see who has enabled
            Mini App notifications. Token secrets are not stored or shown.
          </p>
          <p className="mt-2 text-sm font-semibold text-secondary">
            {enabledCount} enabled / {audience.length} known Mini App users
          </p>
          {(error || message) && (
            <p
              className={`mt-2 text-sm font-semibold ${
                error ? "text-skin-proposal-danger" : "text-secondary"
              }`}
            >
              {error || message}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => void mutate()}
            disabled={isLoading || isSyncing}
            className={secondaryButtonClass}
          >
            Refresh audience
          </button>
          <button
            type="button"
            onClick={syncAudience}
            disabled={isLoading || isSyncing}
            className={blueButtonClass}
          >
            {isSyncing ? "Syncing..." : "Sync Neynar audience"}
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        {isLoading ? (
          <p className="text-base text-secondary">Loading audience...</p>
        ) : audience.length === 0 ? (
          <p className="text-base text-secondary">
            No Mini App notification users have been synced yet.
          </p>
        ) : (
          <table className="w-full min-w-[820px] border-separate border-spacing-y-2 text-left">
            <thead>
              <tr className="text-sm text-secondary">
                <th className="px-3 py-2">FID</th>
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Token updated</th>
                <th className="px-3 py-2">Last synced</th>
              </tr>
            </thead>
            <tbody>
              {audience.map((user) => (
                <tr key={user.fid} className="bg-[#fff7bf] align-top">
                  <td className="rounded-l-2xl px-3 py-4 font-semibold text-skin-base">
                    {user.fid}
                  </td>
                  <td className="px-3 py-4 text-sm text-secondary">
                    <div className="font-semibold text-skin-base">
                      {user.displayName || user.username || "Unknown"}
                    </div>
                    {user.username && (
                      <div className="mt-1">@{user.username}</div>
                    )}
                    {user.walletAddress && (
                      <div className="mt-1 break-all">
                        {user.walletAddress}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-4">
                    <StatusPill
                      status={
                        user.notificationsEnabled
                          ? "enabled"
                          : user.lastSyncedAt
                            ? "no Neynar token"
                            : "disabled"
                      }
                    />
                  </td>
                  <td className="px-3 py-4 text-sm text-secondary">
                    {formatNotificationDate(user.tokenUpdatedAt)}
                  </td>
                  <td className="rounded-r-2xl px-3 py-4 text-sm text-secondary">
                    {formatNotificationDate(user.lastSyncedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
};

const StatusPill = ({ status }: { status: string }) => {
  const color =
    status === "approved" ||
    status === "published" ||
    status === "visible" ||
    status === "enabled"
      ? "bg-[#e7f7df] text-[#276514]"
      : status === "removed" ||
          status === "archived" ||
          status === "rejected" ||
          status === "hidden" ||
          status === "disabled"
        ? "bg-[#f8d7d7] text-[#8c1d1d]"
        : "bg-[#fff7bf] text-[#6d5600]";

  return (
    <span
      className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${color}`}
    >
      {status}
    </span>
  );
};

const CommunityAdminPanel = ({
  adminAuth,
  projects,
  error,
  isLoading,
  mutate,
}: {
  adminAuth: AdminAuth;
  projects: CommunityProjectRecord[];
  error?: string;
  isLoading: boolean;
  mutate: KeyedMutator<{ projects: CommunityProjectRecord[] }>;
}) => {
  const router = useRouter();
  const requestedSlug = getQueryValue(router.query.project);
  const requestedMode = getQueryValue(router.query.mode);
  const requestedProject = requestedSlug
    ? projects.find((project) => project.slug === requestedSlug)
    : undefined;
  const activeMode: CommunityListMode =
    requestedMode === "existing" ||
    (!requestedMode && requestedProject?.status === "approved")
      ? "existing"
      : "queue";
  const visibleProjects = useMemo(
    () =>
      activeMode === "queue"
        ? projects.filter((project) => project.status === "pending")
        : projects.filter((project) => project.status === "approved"),
    [activeMode, projects]
  );
  const projectCounts = useMemo(
    () => ({
      queue: projects.filter((project) => project.status === "pending").length,
      existing: projects.filter((project) => project.status === "approved")
        .length,
    }),
    [projects]
  );
  const selectedProject = useMemo(
    () =>
      visibleProjects.find((project) => project.slug === requestedSlug) ||
      visibleProjects[0],
    [requestedSlug, visibleProjects]
  );

  const selectProject = (project: CommunityProjectRecord) => {
    void router.push(
      {
        pathname: "/admin/dashboard",
        query: {
          section: "community",
          mode: activeMode,
          project: project.slug,
        },
      },
      undefined,
      { shallow: true }
    );
  };

  const setCommunityMode = (mode: CommunityListMode) => {
    void router.push(
      {
        pathname: "/admin/dashboard",
        query: { section: "community", mode },
      },
      undefined,
      { shallow: true }
    );
  };

  return (
    <section className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
      <AdminList
        title="Community Projects"
        error={error}
        isLoading={isLoading}
        header={
          <div className="mt-4 flex gap-1.5 rounded-xl border border-[rgb(var(--color-selector-stroke))] bg-[#f1f1f1] p-1 shadow-[0px_4px_0px_0px_rgb(var(--color-selector-stroke))]">
            {communityListModes.map((mode) => {
              const isActive = activeMode === mode.id;
              const count = projectCounts[mode.id];

              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setCommunityMode(mode.id)}
                  className={`flex-1 rounded-lg px-3 py-2 font-heading text-sm transition ${
                    isActive
                      ? "translate-y-[-1px] bg-accent text-skin-base shadow-[0px_3px_0px_0px_#b89400]"
                      : "text-secondary hover:bg-[#fff7bf] hover:text-skin-base"
                  }`}
                >
                  {mode.label} ({count})
                </button>
              );
            })}
          </div>
        }
      >
        {visibleProjects.map((project) => (
          <button
            key={project.id}
            type="button"
            onClick={() => selectProject(project)}
            className={`w-full rounded-xl border px-4 py-3 text-left transition ${
              selectedProject?.id === project.id
                ? "border-[#d7aa00] bg-[#fff7bf]"
                : "border-skin-stroke bg-white hover:bg-[#fffbe0]"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-heading text-lg leading-tight text-skin-base">
                  {project.title}
                </div>
                <div className="mt-1 text-sm text-secondary">
                  {project.slug}
                </div>
              </div>
              <StatusPill status={project.status} />
            </div>
          </button>
        ))}
        {!isLoading && !error && visibleProjects.length === 0 && (
          <p className="rounded-xl border border-dashed border-skin-stroke bg-white p-4 text-sm leading-snug text-secondary">
            {activeMode === "queue"
              ? "No submitted projects need review."
              : "No approved projects yet."}
          </p>
        )}
      </AdminList>

      {selectedProject ? (
        <ProjectEditor
          key={selectedProject.id}
          adminAuth={adminAuth}
          project={selectedProject}
          mutate={mutate}
        />
      ) : (
        <EmptyEditor
          title={
            activeMode === "queue"
              ? "No submitted projects need review"
              : "No approved community projects"
          }
        />
      )}
    </section>
  );
};

const NoundryAdminPanel = ({
  adminAuth,
  submissions,
  error,
  isLoading,
  mutate,
}: {
  adminAuth: AdminAuth;
  submissions: NoundrySubmission[];
  error?: string;
  isLoading: boolean;
  mutate: KeyedMutator<{ submissions: NoundrySubmission[] }>;
}) => {
  const router = useRouter();
  const requestedId = getQueryValue(router.query.submission);
  const selectedSubmission = useMemo(
    () =>
      submissions.find((submission) => submission.id === requestedId) ||
      submissions[0],
    [requestedId, submissions]
  );

  const selectSubmission = (submission: NoundrySubmission) => {
    void router.push(
      {
        pathname: "/admin/dashboard",
        query: { section: "noundry", submission: submission.id },
      },
      undefined,
      { shallow: true }
    );
  };

  return (
    <section className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
      <AdminList title="Noundry Gallery" error={error} isLoading={isLoading}>
        {submissions.map((submission) => (
          <button
            key={submission.id}
            type="button"
            onClick={() => selectSubmission(submission)}
            className={`w-full rounded-xl border px-4 py-3 text-left transition ${
              selectedSubmission?.id === submission.id
                ? "border-[#d7aa00] bg-[#fff7bf]"
                : "border-skin-stroke bg-white hover:bg-[#fffbe0]"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-heading text-lg leading-tight text-skin-base">
                  {submission.title}
                </div>
                <div className="mt-1 text-sm text-secondary">
                  {submission.traitType}
                </div>
              </div>
              {submission.status !== "approved" && (
                <StatusPill status={submission.status} />
              )}
            </div>
          </button>
        ))}
      </AdminList>

      {selectedSubmission ? (
        <NoundryEditor
          key={selectedSubmission.id}
          adminAuth={adminAuth}
          submission={selectedSubmission}
          mutate={mutate}
        />
      ) : (
        <EmptyEditor title="No gallery submissions yet" />
      )}
    </section>
  );
};

const GalleryAdminPanel = ({
  adminAuth,
  coins,
  galleryPublicEnabled,
  error,
  isLoading,
  mutate,
}: {
  adminAuth: AdminAuth;
  coins: GalleryCoin[];
  galleryPublicEnabled: boolean;
  error?: string;
  isLoading: boolean;
  mutate: KeyedMutator<{
    coins: GalleryCoin[];
    galleryPublicEnabled: boolean;
  }>;
}) => {
  const router = useRouter();
  const [isUpdatingVisibility, setIsUpdatingVisibility] = useState(false);
  const requestedAddress = getQueryValue(router.query.coin);
  const selectedCoin = useMemo(
    () =>
      coins.find(
        (coin) => coin.address.toLowerCase() === requestedAddress?.toLowerCase()
      ) || coins[0],
    [coins, requestedAddress]
  );

  const selectCoin = (coin: GalleryCoin) => {
    void router.push(
      {
        pathname: "/admin/dashboard",
        query: { section: "gallery", coin: coin.address },
      },
      undefined,
      { shallow: true }
    );
  };

  const updateGalleryVisibility = async (enabled: boolean) => {
    try {
      setIsUpdatingVisibility(true);
      await sendAdminRequest(
        "/api/admin/gallery/settings",
        adminAuth,
        "PATCH",
        { galleryPublicEnabled: enabled }
      );
      await mutate();
    } catch (visibilityError) {
      window.alert(
        visibilityError instanceof Error
          ? visibilityError.message
          : "Unable to update gallery visibility."
      );
    } finally {
      setIsUpdatingVisibility(false);
    }
  };

  return (
    <section className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
      <AdminList
        title="Gallery"
        surfaceClassName="yc-dark-yellow-form-surface"
        titleAction={
          <RoundsVisibilitySwitch
            enabled={galleryPublicEnabled}
            isUpdating={isUpdatingVisibility}
            onChange={updateGalleryVisibility}
          />
        }
        error={error}
        isLoading={isLoading}
      >
        {coins.map((coin) => (
          <button
            key={coin.address}
            type="button"
            onClick={() => selectCoin(coin)}
            className={`w-full rounded-xl border px-4 py-3 text-left transition ${
              selectedCoin?.address === coin.address
                ? "border-[#d7aa00] bg-[#fff7bf]"
                : "border-skin-stroke bg-white hover:bg-[#fffbe0]"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="break-words font-heading text-lg leading-tight text-skin-base">
                  {coin.title}
                </div>
                <div className="mt-1 break-all font-mono text-xs text-secondary">
                  {coin.address}
                </div>
              </div>
              <StatusPill status={coin.hidden ? "hidden" : "visible"} />
            </div>
          </button>
        ))}
        {!isLoading && !error && coins.length === 0 && (
          <p className="rounded-xl border border-dashed border-skin-stroke bg-white p-4 text-sm leading-snug text-secondary">
            No content coins have been added to the Gallery yet.
          </p>
        )}
      </AdminList>

      {selectedCoin ? (
        <GalleryCoinEditor
          key={selectedCoin.address}
          adminAuth={adminAuth}
          coin={selectedCoin}
          galleryPublicEnabled={galleryPublicEnabled}
          mutate={mutate}
        />
      ) : (
        <EmptyEditor
          title="No content coins yet"
          surfaceClassName="yc-dark-yellow-form-surface"
        />
      )}
    </section>
  );
};

const RoundsAdminPanel = ({
  adminAuth,
  rounds,
  requests,
  roundsPublicEnabled,
  error,
  isLoading,
  mutate,
  mutateSettings,
  mutateRequests,
}: {
  adminAuth: AdminAuth;
  rounds: Round[];
  requests: RoundRequest[];
  roundsPublicEnabled: boolean;
  error?: string;
  isLoading: boolean;
  mutate: KeyedMutator<{ rounds: Round[] }>;
  mutateSettings: KeyedMutator<{ roundsPublicEnabled: boolean }>;
  mutateRequests: KeyedMutator<{ requests: RoundRequest[] }>;
}) => {
  const router = useRouter();
  const [isUpdatingVisibility, setIsUpdatingVisibility] = useState(false);
  const [selectedSubmission, setSelectedSubmission] =
    useState<RoundSubmission | null>(null);
  const requestedRoundId = getQueryValue(router.query.round);
  const requestedRequestId = getQueryValue(router.query.request);
  const activeRoundMode = (getQueryValue(router.query.roundMode) ||
    "draft") as RoundListMode;
  const visibleRounds = useMemo(
    () => rounds.filter((round) => round.status === activeRoundMode),
    [activeRoundMode, rounds]
  );
  const selectedRound = useMemo(
    () =>
      visibleRounds.find((round) => round.id === requestedRoundId) ||
      visibleRounds[0],
    [requestedRoundId, visibleRounds]
  );
  const submissionsKey =
    adminAuth && selectedRound
      ? ([
          `/api/admin/rounds/${selectedRound.id}/submissions`,
          adminAuth,
        ] as const)
      : null;
  const {
    data: submissionData,
    error: submissionsError,
    mutate: mutateSubmissions,
  } = useSWR<{ submissions: RoundSubmission[] }, Error, AdminSWRKey | null>(
    submissionsKey,
    roundSubmissionsFetcher
  );
  const submissions = useMemo(
    () => submissionData?.submissions || [],
    [submissionData?.submissions]
  );
  const selectedRequest = useMemo(
    () => requests.find((request) => request.id === requestedRequestId),
    [requestedRequestId, requests]
  );
  const roundCounts = useMemo(
    () => ({
      draft: rounds.filter((round) => round.status === "draft").length,
      published: rounds.filter((round) => round.status === "published").length,
      archived: rounds.filter((round) => round.status === "archived").length,
    }),
    [rounds]
  );
  const requestCounts = useMemo(
    () => ({
      pending: requests.filter((request) => request.status === "pending")
        .length,
      closed: requests.filter(
        (request) =>
          request.status === "approved" || request.status === "rejected"
      ).length,
    }),
    [requests]
  );

  useEffect(() => {
    setSelectedSubmission(null);
  }, [selectedRound?.id]);

  const selectRound = (round: Round) => {
    void router.push(
      {
        pathname: "/admin/dashboard",
        query: {
          section: "rounds",
          roundMode: activeRoundMode,
          round: round.id,
        },
      },
      undefined,
      { shallow: true }
    );
  };

  const selectRequest = (request: RoundRequest) => {
    void router.push(
      {
        pathname: "/admin/dashboard",
        query: {
          section: "rounds",
          roundMode: activeRoundMode,
          request: request.id,
        },
      },
      undefined,
      { shallow: true }
    );
  };

  const setRoundMode = (mode: RoundListMode) => {
    void router.push(
      {
        pathname: "/admin/dashboard",
        query: {
          section: "rounds",
          roundMode: mode,
        },
      },
      undefined,
      { shallow: true }
    );
  };

  const createNewRound = async () => {
    try {
      const data = await sendAdminRequest(
        "/api/admin/rounds",
        adminAuth,
        "POST",
        { round: {} }
      );
      await mutate();
      const round = data.round as Round | undefined;
      if (round) {
        void router.push(
          {
            pathname: "/admin/dashboard",
            query: {
              section: "rounds",
              roundMode: "draft",
              round: round.id,
            },
          },
          undefined,
          { shallow: true }
        );
      }
    } catch (createError) {
      window.alert(
        createError instanceof Error
          ? createError.message
          : "Unable to create round."
      );
    }
  };

  const updateRoundsVisibility = async (enabled: boolean) => {
    try {
      setIsUpdatingVisibility(true);
      await sendAdminRequest("/api/admin/rounds/settings", adminAuth, "PATCH", {
        roundsPublicEnabled: enabled,
      });
      await mutateSettings();
    } catch (visibilityError) {
      window.alert(
        visibilityError instanceof Error
          ? visibilityError.message
          : "Unable to update rounds visibility."
      );
    } finally {
      setIsUpdatingVisibility(false);
    }
  };

  return (
    <section className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
      <AdminList
        title="Rounds"
        surfaceClassName="yc-dark-yellow-form-surface"
        titleAction={
          <RoundsVisibilitySwitch
            enabled={roundsPublicEnabled}
            isUpdating={isUpdatingVisibility}
            onChange={updateRoundsVisibility}
          />
        }
        error={error || submissionsError?.message}
        isLoading={
          isLoading ||
          Boolean(selectedRound && !submissionData && !submissionsError)
        }
        header={
          <div className="mt-4 flex flex-col gap-4">
            <button
              type="button"
              onClick={createNewRound}
              className={blueButtonClass}
            >
              Create round
            </button>
            <AdminModeTabs
              modes={[
                ["draft", `Draft (${roundCounts.draft})`],
                ["published", `Published (${roundCounts.published})`],
                ["archived", `Archived (${roundCounts.archived})`],
              ]}
              activeMode={activeRoundMode}
              onChange={(mode) => setRoundMode(mode as RoundListMode)}
            />
          </div>
        }
      >
        {visibleRounds.map((round) => (
          <button
            key={round.id}
            type="button"
            onClick={() => selectRound(round)}
            className={`w-full rounded-xl border px-4 py-3 text-left transition ${
              selectedRound?.id === round.id
                ? "border-[#d7aa00] bg-[#fff7bf]"
                : "border-skin-stroke bg-white hover:bg-[#fffbe0]"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-heading text-lg leading-tight text-skin-base">
                  {round.title}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-secondary">
                  <span>/rounds/{round.slug}</span>
                  {round.isTraitContest && (
                    <span className="rounded-full bg-[#dff3ff] px-2 py-0.5 font-semibold text-[#0f5f99]">
                      Noundry trait round
                    </span>
                  )}
                </div>
              </div>
              <StatusPill status={round.status} />
            </div>
          </button>
        ))}
        {!isLoading && !error && visibleRounds.length === 0 && (
          <p className="rounded-xl border border-dashed border-skin-stroke bg-white p-4 text-sm leading-snug text-secondary">
            No {activeRoundMode} rounds yet.
          </p>
        )}

        <div className="mt-3 border-t border-skin-stroke pt-4">
          <h3 className="font-heading text-xl leading-none text-skin-base">
            Round requests
          </h3>
          <div className="mt-2 text-sm text-secondary">
            {requestCounts.pending} pending / {requestCounts.closed} closed
          </div>
          <div className="mt-3 flex flex-col gap-3">
            {requests.slice(0, 20).map((request) => (
              <button
                key={request.id}
                type="button"
                onClick={() => selectRequest(request)}
                className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                  selectedRequest?.id === request.id
                    ? "border-[#d7aa00] bg-[#fff7bf]"
                    : "border-skin-stroke bg-white hover:bg-[#fffbe0]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="break-words font-heading text-lg leading-tight text-skin-base">
                      {request.title}
                    </div>
                    <div className="mt-1 text-sm text-secondary">
                      {new Date(request.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <StatusPill status={request.status} />
                </div>
              </button>
            ))}
            {requests.length === 0 && (
              <p className="rounded-xl border border-dashed border-skin-stroke bg-white p-4 text-sm leading-snug text-secondary">
                No round requests yet.
              </p>
            )}
          </div>
        </div>
      </AdminList>

      {selectedRequest ? (
        <RoundRequestEditor
          key={selectedRequest.id}
          adminAuth={adminAuth}
          request={selectedRequest}
          mutateRounds={mutate}
          mutateRequests={mutateRequests}
        />
      ) : selectedRound ? (
        <div className="flex flex-col gap-5">
          <RoundEditor
            key={selectedRound.id}
            adminAuth={adminAuth}
            round={selectedRound}
            mutate={mutate}
          />
          <RoundSubmissionsManager
            submissions={submissions}
            isLoading={Boolean(
              selectedRound && !submissionData && !submissionsError
            )}
            error={submissionsError?.message}
            onSelect={setSelectedSubmission}
          />
        </div>
      ) : (
        <EmptyEditor
          title="No rounds yet"
          surfaceClassName="yc-dark-yellow-form-surface"
        />
      )}
      {selectedRound && selectedSubmission && (
        <RoundSubmissionModal
          adminAuth={adminAuth}
          round={selectedRound}
          submission={selectedSubmission}
          mutateSubmissions={mutateSubmissions}
          onClose={() => setSelectedSubmission(null)}
        />
      )}
    </section>
  );
};

const AdminModeTabs = ({
  modes,
  activeMode,
  onChange,
}: {
  modes: [string, string][];
  activeMode: string;
  onChange: (mode: string) => void;
}) => (
  <div className="flex gap-1.5 rounded-xl border border-[rgb(var(--color-selector-stroke))] bg-[#f1f1f1] p-1 shadow-[0px_4px_0px_0px_rgb(var(--color-selector-stroke))]">
    {modes.map(([mode, label]) => {
      const isActive = activeMode === mode;

      return (
        <button
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
          className={`flex-1 rounded-lg px-3 py-2 font-heading text-sm transition ${
            isActive
              ? "translate-y-[-1px] bg-accent text-skin-base shadow-[0px_3px_0px_0px_#b89400]"
              : "text-secondary hover:bg-[#fff7bf] hover:text-skin-base"
          }`}
        >
          {label}
        </button>
      );
    })}
  </div>
);

const RoundsVisibilitySwitch = ({
  enabled,
  isUpdating,
  onChange,
}: {
  enabled: boolean;
  isUpdating: boolean;
  onChange: (enabled: boolean) => void;
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={enabled}
    disabled={isUpdating}
    onClick={() => onChange(!enabled)}
    className="flex shrink-0 items-center gap-2 rounded-full border border-skin-stroke bg-skin-muted px-2 py-1 text-xs font-semibold text-skin-base transition hover:bg-[#fff7bf] disabled:cursor-not-allowed disabled:opacity-50"
  >
    <span>{enabled ? "On" : "Off"}</span>
    <span
      className={`flex h-5 w-9 items-center rounded-full p-0.5 transition ${
        enabled ? "bg-positive" : "bg-secondary"
      }`}
    >
      <span
        className={`h-4 w-4 rounded-full bg-white shadow transition ${
          enabled ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </span>
  </button>
);

const getRoundPayloadFromForm = ({
  title,
  slug,
  description,
  content,
  image,
  submissionsOpenAt,
  votingStartsAt,
  votingEndsAt,
  currentDates,
  active,
  featured,
  isTraitContest,
  status,
  votingStrategy,
  votesPerWallet,
  winnerCount,
  maxSubmissionsPerWallet,
  minTitleLength,
  maxTitleLength,
  minDescriptionLength,
  maxDescriptionLength,
  awards,
}: {
  title: string;
  slug: string;
  description: string;
  content: string;
  image: string;
  submissionsOpenAt: string;
  votingStartsAt: string;
  votingEndsAt: string;
  currentDates: SavedRoundDates;
  active: boolean;
  featured: boolean;
  isTraitContest: boolean;
  status: Round["status"];
  votingStrategy: Round["votingStrategy"];
  votesPerWallet: number;
  winnerCount: number;
  maxSubmissionsPerWallet: number;
  minTitleLength: number;
  maxTitleLength: number;
  minDescriptionLength: number;
  maxDescriptionLength: number;
  awards: RoundInput["awards"];
}): RoundInput => {
  const dates = getAdminRoundDatePayload(
    {
      submissionsOpenAt,
      votingStartsAt,
      votingEndsAt,
    },
    currentDates
  );

  return {
    title,
    slug,
    description,
    content,
    image,
    ...dates,
    active,
    featured,
    isTraitContest,
    traitSubmissionsEnabled: isTraitContest,
    status,
    votingStrategy,
    votesPerWallet,
    winnerCount,
    maxSubmissionsPerWallet,
    minTitleLength,
    maxTitleLength,
    minDescriptionLength,
    maxDescriptionLength,
    awards,
  };
};

const validateRoundPublishForm = (round: RoundInput) => {
  if (
    !round.title ||
    !round.slug ||
    !round.description ||
    !round.content ||
    !round.image
  ) {
    return "Title, slug, description, content, and image are required before publishing.";
  }

  const dates = [
    round.startsAt,
    round.submissionsOpenAt,
    round.votingStartsAt,
    round.votingEndsAt,
    round.votingEndsAt,
  ].map((value) => new Date(String(value)).getTime());

  if (
    dates.some((date) => Number.isNaN(date)) ||
    dates[0] > dates[1] ||
    dates[1] > dates[2] ||
    dates[2] >= dates[3] ||
    dates[3] !== dates[4]
  ) {
    return "Dates must be valid and ordered from start through voting end.";
  }

  return undefined;
};

const RoundEditor = ({
  adminAuth,
  round,
  mutate,
}: {
  adminAuth: AdminAuth;
  round: Round;
  mutate: KeyedMutator<{ rounds: Round[] }>;
}) => {
  const [title, setTitle] = useState(round.title);
  const [slug, setSlug] = useState(round.slug);
  const [description, setDescription] = useState(round.description);
  const [content, setContent] = useState(round.content);
  const [image, setImage] = useState(round.image);
  const [submissionsOpenAt, setSubmissionsOpenAt] = useState(
    toDateInput(round.submissionsOpenAt)
  );
  const [votingStartsAt, setVotingStartsAt] = useState(
    toDateInput(round.votingStartsAt)
  );
  const [votingEndsAt, setVotingEndsAt] = useState(
    toDateInput(round.votingEndsAt)
  );
  const [active, setActive] = useState(round.active);
  const [featured, setFeatured] = useState(round.featured);
  const [isTraitContest, setIsTraitContest] = useState(round.isTraitContest);
  const [status, setStatus] = useState<Round["status"]>(round.status);
  const [votingStrategy, setVotingStrategy] = useState<Round["votingStrategy"]>(
    round.votingStrategy
  );
  const [votesPerWallet, setVotesPerWallet] = useState(round.votesPerWallet);
  const [winnerCount, setWinnerCount] = useState(round.winnerCount);
  const [maxSubmissionsPerWallet, setMaxSubmissionsPerWallet] = useState(
    round.maxSubmissionsPerWallet
  );
  const [awardsText, setAwardsText] = useState(formatAwards(round.awards));
  const [minTitleLength, setMinTitleLength] = useState(round.minTitleLength);
  const [maxTitleLength, setMaxTitleLength] = useState(round.maxTitleLength);
  const [minDescriptionLength, setMinDescriptionLength] = useState(
    round.minDescriptionLength
  );
  const [maxDescriptionLength, setMaxDescriptionLength] = useState(
    round.maxDescriptionLength
  );
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const submit = async (action?: "publish" | "archive" | "remove") => {
    if (action === "remove" && !window.confirm("Remove this round?")) return;
    if (action === "archive" && !window.confirm("Archive this round?")) return;

    const roundPayload = getRoundPayloadFromForm({
      title,
      slug,
      description,
      content,
      image,
      submissionsOpenAt,
      votingStartsAt,
      votingEndsAt,
      currentDates: {
        startsAt: round.startsAt,
        submissionsOpenAt: round.submissionsOpenAt,
        votingStartsAt: round.votingStartsAt,
        votingEndsAt: round.votingEndsAt,
      },
      active,
      featured,
      isTraitContest,
      status,
      votingStrategy,
      votesPerWallet,
      winnerCount,
      maxSubmissionsPerWallet,
      minTitleLength,
      maxTitleLength,
      minDescriptionLength,
      maxDescriptionLength,
      awards: parseAwards(awardsText),
    });
    const validationError =
      action === "publish" || roundPayload.status === "published"
        ? validateRoundPublishForm(roundPayload)
        : undefined;

    if (validationError) {
      setMessage(validationError);
      return;
    }

    try {
      setIsSaving(true);
      setMessage(null);
      await sendAdminRequest(
        `/api/admin/rounds/${round.id}`,
        adminAuth,
        action === "remove" ? "DELETE" : "PATCH",
        action ? { action, round: roundPayload } : { round: roundPayload }
      );
      await mutate();
      setMessage(
        action === "publish"
          ? "Round published."
          : action === "archive"
            ? "Round archived."
            : action === "remove"
              ? "Round removed."
              : "Round saved."
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to save round."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <EditorCard
      title={round.title}
      status={round.status}
      message={message}
      surfaceClassName="yc-dark-yellow-form-surface"
      actions={
        <>
          <button
            type="button"
            onClick={() => submit()}
            disabled={isSaving}
            className={saveButtonClass}
          >
            Save changes
          </button>
          {round.status !== "published" && (
            <button
              type="button"
              onClick={() => submit("publish")}
              disabled={isSaving}
              className={secondaryButtonClass}
            >
              Publish
            </button>
          )}
          {round.status !== "archived" && (
            <button
              type="button"
              onClick={() => submit("archive")}
              disabled={isSaving}
              className={secondaryButtonClass}
            >
              Archive
            </button>
          )}
          <button
            type="button"
            onClick={() => submit("remove")}
            disabled={isSaving}
            className={dangerButtonClass}
          >
            Remove
          </button>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="Title" value={title} onChange={setTitle} />
        <FormField label="Slug" value={slug} onChange={setSlug} />
      </div>
      <FormField
        label="Description"
        value={description}
        onChange={setDescription}
        rows={3}
      />
      <FormField
        label="Content"
        value={content}
        onChange={setContent}
        rows={6}
      />
      <FormField label="Image URL" value={image} onChange={setImage} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <DateField
          label="Submissions open"
          value={submissionsOpenAt}
          onChange={setSubmissionsOpenAt}
        />
        <DateField
          label="Voting starts"
          value={votingStartsAt}
          onChange={setVotingStartsAt}
        />
        <DateField
          label="Voting ends"
          value={votingEndsAt}
          onChange={setVotingEndsAt}
        />
        <label className={labelClass}>
          Status
          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as Round["status"])
            }
            className={`${fieldClass} mt-2`}
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </label>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <label className={labelClass}>
          Voting type
          <select
            value={votingStrategy}
            onChange={(event) =>
              setVotingStrategy(event.target.value as Round["votingStrategy"])
            }
            className={`${fieldClass} mt-2`}
          >
            <option value="one_per_nft">
              1 vote per delegated Collective Noun vote
            </option>
            <option value="one_per_wallet">1 vote per wallet</option>
            <option value="fixed_per_wallet">Fixed votes per wallet</option>
          </select>
        </label>
        <NumberField
          label="Votes / wallet"
          value={votesPerWallet}
          onChange={setVotesPerWallet}
        />
        <NumberField
          label="Winner count"
          value={winnerCount}
          onChange={setWinnerCount}
        />
        <NumberField
          label="Max submissions / wallet"
          value={maxSubmissionsPerWallet}
          onChange={setMaxSubmissionsPerWallet}
        />
        <NumberField
          label="Min title"
          value={minTitleLength}
          onChange={setMinTitleLength}
        />
        <NumberField
          label="Max title"
          value={maxTitleLength}
          onChange={setMaxTitleLength}
        />
        <NumberField
          label="Min description"
          value={minDescriptionLength}
          onChange={setMinDescriptionLength}
        />
        <NumberField
          label="Max description"
          value={maxDescriptionLength}
          onChange={setMaxDescriptionLength}
        />
      </div>
      <FormField
        label="Prizes, one per line as Position | Title | Value | Description"
        value={awardsText}
        onChange={setAwardsText}
        rows={5}
      />
      <div className="flex flex-wrap gap-4">
        <CheckboxField label="Active" checked={active} onChange={setActive} />
        <CheckboxField
          label="Featured"
          checked={featured}
          onChange={setFeatured}
        />
        <CheckboxField
          label="Noundry trait round"
          checked={isTraitContest}
          onChange={setIsTraitContest}
        />
      </div>
    </EditorCard>
  );
};

const RoundSubmissionsManager = ({
  submissions,
  isLoading,
  error,
  onSelect,
}: {
  submissions: RoundSubmission[];
  isLoading: boolean;
  error?: string;
  onSelect: (submission: RoundSubmission) => void;
}) => (
  <EditorCard
    title="Submitted projects"
    status={`${submissions.length}`}
    message={error || null}
    showStatusInTitle={false}
    surfaceClassName="yc-dark-yellow-form-surface"
    actions={
      <div className="rounded-full bg-[#1d9bf0] px-3 py-1 font-heading text-sm text-white shadow-[0px_3px_0px_0px_#0f5f99]">
        {submissions.length} total
      </div>
    }
  >
    {isLoading ? (
      <p className="rounded-xl bg-white p-4 text-sm text-secondary">
        Loading submissions...
      </p>
    ) : submissions.length > 0 ? (
      <div className="grid gap-3">
        {submissions.map((submission) => (
          <button
            key={submission.id}
            type="button"
            onClick={() => onSelect(submission)}
            className="rounded-xl border border-skin-stroke bg-white p-4 text-left transition hover:-translate-y-0.5 hover:bg-[#fffbe0] hover:shadow-sm"
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <div className="break-words font-heading text-xl leading-none text-skin-base">
                  {submission.title}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-secondary">
                  <span
                    className={`rounded-full px-2 py-0.5 font-semibold ${
                      submission.submissionType === "trait"
                        ? "bg-[#dff3ff] text-[#0f5f99]"
                        : "bg-[#fff7bf] text-skin-base"
                    }`}
                  >
                    {submission.submissionType === "trait"
                      ? "Trait"
                      : "Project"}
                  </span>
                  <span>{submission.voteCount} votes</span>
                  <span className="break-all">{submission.walletAddress}</span>
                </div>
              </div>
              <StatusPill status={submission.status} />
            </div>
          </button>
        ))}
      </div>
    ) : (
      <p className="rounded-xl bg-white p-4 text-sm leading-snug text-secondary">
        No projects have been submitted to this round yet.
      </p>
    )}
  </EditorCard>
);

const RoundSubmissionModal = ({
  adminAuth,
  round,
  submission,
  mutateSubmissions,
  onClose,
}: {
  adminAuth: AdminAuth;
  round: Round;
  submission: RoundSubmission;
  mutateSubmissions: KeyedMutator<{ submissions: RoundSubmission[] }>;
  onClose: () => void;
}) => (
  <div
    className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/70 p-4 py-8"
    role="dialog"
    aria-modal="true"
    aria-label={`Edit ${submission.title}`}
    onClick={onClose}
  >
    <div
      className="w-full max-w-5xl"
      onClick={(event) => event.stopPropagation()}
    >
      <RoundSubmissionEditor
        key={submission.id}
        adminAuth={adminAuth}
        round={round}
        submission={submission}
        mutateSubmissions={mutateSubmissions}
        onClose={onClose}
      />
    </div>
  </div>
);

const RoundSubmissionEditor = ({
  adminAuth,
  round,
  submission,
  mutateSubmissions,
  onClose,
}: {
  adminAuth: AdminAuth;
  round: Round;
  submission: RoundSubmission;
  mutateSubmissions: KeyedMutator<{ submissions: RoundSubmission[] }>;
  onClose?: () => void;
}) => {
  const [title, setTitle] = useState(submission.title);
  const [description, setDescription] = useState(submission.description);
  const [image, setImage] = useState(submission.image);
  const [url, setUrl] = useState(submission.url);
  const [walletAddress, setWalletAddress] = useState(submission.walletAddress);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const submit = async (action?: "approve" | "reject" | "hide" | "remove") => {
    if (
      (action === "reject" || action === "hide" || action === "remove") &&
      !window.confirm(`${action} this submission?`)
    ) {
      return;
    }

    try {
      setIsSaving(true);
      setMessage(null);
      await sendAdminRequest(
        `/api/admin/rounds/${round.id}/submissions/${submission.id}`,
        adminAuth,
        action === "remove" ? "DELETE" : "PATCH",
        action
          ? {
              action,
              submission: { title, description, image, url, walletAddress },
            }
          : { submission: { title, description, image, url, walletAddress } }
      );
      await mutateSubmissions();
      if (action === "remove") {
        onClose?.();
        return;
      }
      setMessage(
        action === "approve"
          ? "Submission approved."
          : action === "reject"
            ? "Submission rejected."
            : action === "hide"
              ? "Submission hidden."
              : action === "remove"
                ? "Submission removed."
                : "Submission saved."
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to save submission."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <EditorCard
      title={submission.title}
      status={submission.status}
      message={message}
      surfaceClassName="yc-dark-yellow-form-surface"
      actions={
        <>
          <button
            type="button"
            onClick={() => submit()}
            disabled={isSaving}
            className={saveButtonClass}
          >
            Save changes
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className={secondaryButtonClass}
            >
              Close
            </button>
          )}
          {submission.status !== "approved" && (
            <button
              type="button"
              onClick={() => submit("approve")}
              disabled={isSaving}
              className={secondaryButtonClass}
            >
              Approve
            </button>
          )}
          <button
            type="button"
            onClick={() => submit("reject")}
            disabled={isSaving}
            className={secondaryButtonClass}
          >
            Reject
          </button>
          <button
            type="button"
            onClick={() => submit("hide")}
            disabled={isSaving}
            className={secondaryButtonClass}
          >
            Hide
          </button>
          <button
            type="button"
            onClick={() => submit("remove")}
            disabled={isSaving}
            className={dangerButtonClass}
          >
            Delete
          </button>
        </>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <div>
          <div className="overflow-hidden rounded-2xl border border-skin-stroke bg-[#fff7bf]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={submission.image}
              alt={submission.title}
              className="aspect-square w-full object-cover"
            />
          </div>
          <div className="mt-3 rounded-xl bg-[#fff7bf] p-3 text-sm text-secondary">
            <span className="font-heading text-lg text-skin-base">
              {submission.voteCount}
            </span>{" "}
            stored votes
          </div>
          <div className="mt-3 rounded-xl border border-skin-stroke bg-white p-3 text-sm text-secondary">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 font-semibold ${
                  submission.submissionType === "trait"
                    ? "bg-[#dff3ff] text-[#0f5f99]"
                    : "bg-[#fff7bf] text-skin-base"
                }`}
              >
                {submission.submissionType === "trait" ? "Trait" : "Project"}
              </span>
              {submission.traitType && <span>{submission.traitType}</span>}
            </div>
            {submission.traitId && (
              <div className="mt-2 break-all">
                Source trait: {submission.traitId}
              </div>
            )}
            {submission.source === "noundry" && submission.url && (
              <a
                href={submission.url}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex font-heading text-sm underline"
              >
                Open Noundry trait
              </a>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <FormField label="Title" value={title} onChange={setTitle} />
          <FormField
            label="Submitting wallet"
            value={walletAddress}
            onChange={setWalletAddress}
          />
          <FormField label="Image URL" value={image} onChange={setImage} />
          <FormField label="Project URL" value={url} onChange={setUrl} />
          <FormField
            label="Description"
            value={description}
            onChange={setDescription}
            rows={6}
          />
        </div>
      </div>
    </EditorCard>
  );
};

const RoundRequestEditor = ({
  adminAuth,
  request,
  mutateRounds,
  mutateRequests,
}: {
  adminAuth: AdminAuth;
  request: RoundRequest;
  mutateRounds: KeyedMutator<{ rounds: Round[] }>;
  mutateRequests: KeyedMutator<{ requests: RoundRequest[] }>;
}) => {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const submit = async (action: "approved" | "rejected" | "remove") => {
    if (
      (action === "rejected" || action === "remove") &&
      !window.confirm(`${action} this round request?`)
    ) {
      return;
    }

    try {
      setIsSaving(true);
      setMessage(null);
      const result = await sendAdminRequest(
        `/api/admin/rounds/requests/${request.id}`,
        adminAuth,
        action === "remove" ? "DELETE" : "PATCH",
        { action }
      );
      if (action === "approved") {
        await mutateRounds();
      }
      await mutateRequests();
      if (action === "approved") {
        const round = result.round as Round | undefined;
        if (round?.id) {
          void router.push(
            {
              pathname: "/admin/dashboard",
              query: {
                section: "rounds",
                roundMode: "draft",
                round: round.id,
              },
            },
            undefined,
            { shallow: true }
          );
        }
      }
      setMessage(
        action === "remove"
          ? "Request removed."
          : action === "approved"
            ? "Round moved to drafts."
            : `Request marked ${action}.`
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to update request."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <EditorCard
      title={request.title}
      status={request.status}
      message={message}
      surfaceClassName="yc-dark-yellow-form-surface"
      actions={
        <>
          <button
            type="button"
            onClick={() => submit("approved")}
            disabled={isSaving}
            className={blueButtonClass}
          >
            Approve request
          </button>
          <button
            type="button"
            onClick={() => submit("rejected")}
            disabled={isSaving}
            className={secondaryButtonClass}
          >
            Reject
          </button>
          <button
            type="button"
            onClick={() => submit("remove")}
            disabled={isSaving}
            className={dangerButtonClass}
          >
            Remove
          </button>
        </>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <div className="flex flex-col gap-3">
          <div className="overflow-hidden rounded-2xl border border-skin-stroke bg-[#fff7bf]">
            {request.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={request.image}
                alt={request.title}
                className="aspect-square w-full object-cover"
              />
            ) : (
              <div className="flex aspect-square items-center justify-center p-6 text-center font-heading text-2xl text-skin-base">
                {request.title}
              </div>
            )}
          </div>
          {request.url && (
            <a
              href={request.url}
              target="_blank"
              rel="noreferrer"
              className="break-all rounded-xl border border-skin-stroke bg-white px-3 py-2 font-heading text-sm text-skin-base underline"
            >
              Reference link
            </a>
          )}
        </div>
        <div className="flex flex-col gap-4">
          <ReadonlyField
            label="Requested by"
            value={request.requesterName || "Not provided"}
          />
          <ReadonlyField
            label="Email"
            value={request.requesterEmail || "Not provided"}
          />
          <ReadonlyField
            label="Wallet"
            value={request.walletAddress || "Not connected"}
          />
          <ReadonlyField
            label="Slug"
            value={`/rounds/${request.requestedSlug}`}
          />
          <ReadonlyField
            label="Round type"
            value={
              request.isTraitContest ? "Noundry trait round" : "Project round"
            }
          />
          <ReadonlyField
            label="Summary"
            value={request.description}
            multiline
          />
          <ReadonlyField
            label="Description"
            value={request.content}
            multiline
          />
          <ReadonlyField
            label="Voting type"
            value={formatVotingStrategy(
              request.votingStrategy,
              request.votesPerWallet
            )}
          />
          <ReadonlyField
            label="Winners"
            value={`${request.winnerCount} winner${
              request.winnerCount === 1 ? "" : "s"
            }`}
          />
          <ReadonlyField
            label="Max submissions / wallet"
            value={String(request.maxSubmissionsPerWallet)}
          />
          <ReadonlyField
            label="Round dates"
            value={[
              `Submissions open: ${new Date(
                request.submissionsOpenAt
              ).toLocaleString()}`,
              `Voting starts: ${new Date(
                request.votingStartsAt
              ).toLocaleString()}`,
              `Voting ends: ${new Date(request.votingEndsAt).toLocaleString()}`,
            ].join("\n")}
            multiline
          />
          {request.awards.length > 0 && (
            <ReadonlyField
              label="Prizes"
              value={formatAwards(request.awards as Round["awards"])}
              multiline
            />
          )}
          {request.timeline && (
            <ReadonlyField label="Timing" value={request.timeline} multiline />
          )}
        </div>
      </div>
    </EditorCard>
  );
};

const AdminList = ({
  title,
  surfaceClassName = "",
  titleAction,
  error,
  isLoading,
  header,
  children,
}: {
  title: string;
  surfaceClassName?: string;
  titleAction?: ReactNode;
  error?: string;
  isLoading: boolean;
  header?: ReactNode;
  children: ReactNode;
}) => (
  <div
    className={`${surfaceClassName} h-fit rounded-2xl border border-skin-stroke bg-white p-4 shadow-sm`}
  >
    <div className="flex items-center justify-between gap-3">
      <h2 className="font-heading text-2xl leading-none text-skin-base">
        {title}
      </h2>
      {titleAction}
    </div>
    {header}
    {isLoading && <p className="mt-4 text-secondary">Loading...</p>}
    {error && <p className="mt-4 text-skin-proposal-danger">{error}</p>}
    <div className="mt-4 flex max-h-[760px] flex-col gap-3 overflow-y-auto">
      {children}
    </div>
  </div>
);

const ProjectEditor = ({
  adminAuth,
  project,
  mutate,
}: {
  adminAuth: AdminAuth;
  project: CommunityProjectRecord;
  mutate: KeyedMutator<{ projects: CommunityProjectRecord[] }>;
}) => {
  const [title, setTitle] = useState(project.title);
  const [slug, setSlug] = useState(project.slug);
  const [description, setDescription] = useState(project.description);
  const [artist, setArtist] = useState(project.artist);
  const [category, setCategory] = useState(project.category);
  const [date, setDate] = useState(project.date);
  const [href, setHref] = useState(project.href);
  const [image, setImage] = useState(project.image);
  const [memberAddresses, setMemberAddresses] = useState<string[]>(
    project.memberAddresses || []
  );
  const [details, setDetails] = useState(toLines(project.details));
  const [galleryImages, setGalleryImages] = useState(
    toLines(project.galleryImages)
  );
  const [links, setLinks] = useState(formatLinks(project.links));
  const [editorMode, setEditorMode] = useState<ProjectEditorMode>("edit");
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { data: membersData, error: membersError } = useSWR(
    "/api/members",
    memberSummariesFetcher
  );
  const previewProject: CommunityProject = {
    title,
    slug,
    description,
    artist,
    category,
    date,
    href,
    image,
    memberAddresses,
    details: fromLines(details),
    galleryImages: fromLines(galleryImages),
    links: parseLinks(links),
  };
  const isQueuedProject = project.status === "pending";

  const submit = async (action?: "approve" | "remove") => {
    try {
      setIsSaving(true);
      setMessage(null);
      const projectPayload: Partial<CommunityProject> = {
        title,
        slug,
        description,
        artist,
        category,
        date,
        href,
        image,
        memberAddresses,
        details: fromLines(details),
        galleryImages: fromLines(galleryImages),
        links: parseLinks(links),
      };

      await sendAdminRequest(
        `/api/admin/community-projects/${project.id}`,
        adminAuth,
        action === "remove" ? "DELETE" : "PATCH",
        action
          ? { action, project: projectPayload }
          : { project: projectPayload }
      );
      await mutate();
      setMessage(
        action === "approve"
          ? "Project approved."
          : action === "remove"
            ? "Project removed."
            : "Project saved."
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unable to save project.";
      setMessage(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <EditorCard
      title={project.title}
      status={project.status}
      message={message}
      showStatusInTitle={false}
      headingAddon={
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="flex w-fit gap-1.5 rounded-xl border border-[rgb(var(--color-selector-stroke))] bg-[#f1f1f1] p-1 shadow-[0px_4px_0px_0px_rgb(var(--color-selector-stroke))]">
            {projectEditorModes.map((mode) => {
              const isActive = editorMode === mode.id;

              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setEditorMode(mode.id)}
                  className={`rounded-lg px-4 py-2 font-heading text-sm transition ${
                    isActive
                      ? "translate-y-[-1px] bg-accent text-skin-base shadow-[0px_3px_0px_0px_#b89400]"
                      : "text-secondary hover:bg-[#fff7bf] hover:text-skin-base"
                  }`}
                >
                  {mode.label}
                </button>
              );
            })}
          </div>
          <StatusPill status={project.status} />
        </div>
      }
      actions={
        <>
          <button
            type="button"
            onClick={() => submit()}
            disabled={isSaving}
            className={isQueuedProject ? blueButtonClass : saveButtonClass}
          >
            Save changes
          </button>
          {project.status !== "approved" && (
            <button
              type="button"
              onClick={() => submit("approve")}
              disabled={isSaving}
              className={
                isQueuedProject ? saveButtonClass : secondaryButtonClass
              }
            >
              Approve
            </button>
          )}
          <button
            type="button"
            onClick={() => submit("remove")}
            disabled={isSaving}
            className={dangerButtonClass}
          >
            Remove
          </button>
        </>
      }
    >
      {editorMode === "edit" ? (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Title" value={title} onChange={setTitle} />
            <FormField label="Slug" value={slug} onChange={setSlug} />
            <FormField label="Artist" value={artist} onChange={setArtist} />
            <FormField
              label="Category"
              value={category}
              onChange={setCategory}
            />
            <FormField label="Date" value={date} onChange={setDate} />
            <FormField label="Project URL" value={href} onChange={setHref} />
          </div>
          <FormField label="Image URL" value={image} onChange={setImage} />
          <ProjectMemberSelector
            members={membersData?.members || []}
            selectedAddresses={memberAddresses}
            onChange={setMemberAddresses}
            isLoading={!membersData && !membersError}
            error={
              membersError
                ? "Members could not be loaded. Existing linked addresses can still be saved or removed."
                : undefined
            }
          />
          <FormField
            label="Description"
            value={description}
            onChange={setDescription}
            rows={4}
          />
          <FormField
            label="Details, one per line"
            value={details}
            onChange={setDetails}
            rows={5}
          />
          <FormField
            label="Gallery images, one URL per line"
            value={galleryImages}
            onChange={setGalleryImages}
            rows={4}
          />
          <FormField
            label="Links, one per line as Title | URL"
            value={links}
            onChange={setLinks}
            rows={4}
          />
        </>
      ) : (
        <ProjectPreview project={previewProject} />
      )}
    </EditorCard>
  );
};

const ProjectPreview = ({ project }: { project: CommunityProject }) => {
  const imageUrl = normalizeSafeImageUrl(project.image, {
    allowInternal: true,
    allowDataImages: true,
  });
  const galleryImages = (project.galleryImages || [])
    .map((image) =>
      normalizeSafeImageUrl(image, {
        allowInternal: true,
        allowDataImages: true,
      })
    )
    .filter(Boolean);
  const sourceLinkProps = getSafeLinkProps(project.href, {
    allowInternal: true,
  });

  return (
    <div className="rounded-2xl border border-skin-stroke bg-[#ffcc00]/20 p-4">
      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={project.title}
          className="max-h-[420px] w-full rounded-2xl border border-skin-stroke bg-skin-muted object-cover shadow-sm"
        />
      )}

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
        <section className="flex flex-col gap-4 rounded-2xl border border-skin-stroke bg-white p-5 shadow-sm">
          <div className="caption font-semibold text-secondary">
            {project.category} / {project.date}
          </div>
          <h3 className="font-heading text-[34px] leading-none text-skin-base">
            {project.title || "Untitled project"}
          </h3>
          <p className="text-lg leading-snug text-skin-base">
            {project.description || "No description entered yet."}
          </p>
          {project.details.length > 0 && (
            <div className="flex flex-col gap-3 text-base leading-snug text-secondary">
              {project.details.map((detail, index) => (
                <p key={`${detail}-${index}`}>{detail}</p>
              ))}
            </div>
          )}
          {galleryImages.length > 0 && (
            <div className="grid grid-cols-2 gap-4 pt-2">
              {galleryImages.map((image, index) => (
                <div
                  key={`${image}-${index}`}
                  className="overflow-hidden rounded-2xl border border-skin-stroke bg-skin-muted shadow-sm"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image}
                    alt={`${project.title} gallery image ${index + 1}`}
                    className="aspect-square h-full w-full object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        <aside className="h-fit rounded-2xl border border-skin-stroke bg-skin-muted p-5 shadow-sm">
          <dl className="flex flex-col gap-4 text-base">
            <div>
              <dt className="font-heading text-xl">Category</dt>
              <dd className="mt-1 text-secondary">
                {project.category || "Uncategorized"}
              </dd>
            </div>
            <div>
              <dt className="font-heading text-xl">Artist</dt>
              <dd className="mt-1 text-secondary">
                {project.artist || "Unknown artist"}
              </dd>
            </div>
            {project.memberAddresses && project.memberAddresses.length > 0 && (
              <div>
                <dt className="font-heading text-xl">Project Members</dt>
                <dd className="mt-1 flex flex-col gap-1 text-secondary">
                  {project.memberAddresses.map((address) => (
                    <span key={address} className="break-all">
                      {address}
                    </span>
                  ))}
                </dd>
              </div>
            )}
          </dl>

          {sourceLinkProps && (
            <a
              {...sourceLinkProps}
              className="mt-6 flex w-full items-center justify-center rounded-[18px] bg-accent px-5 py-3 font-heading text-lg text-skin-base shadow-[0px_4.02px_0px_0px_#b89400] transition hover:-translate-y-0.5 hover:bg-[#ffd84d] hover:shadow-[0px_6px_0px_0px_#b89400] active:translate-y-1 active:shadow-none"
            >
              View source
            </a>
          )}

          {project.links && project.links.length > 0 && (
            <div className="mt-5 flex flex-col gap-3">
              {project.links.map((link) => {
                const linkProps = getSafeLinkProps(link.href, {
                  allowInternal: true,
                });

                return (
                  linkProps && (
                    <a
                      key={`${link.title}-${link.href}`}
                      {...linkProps}
                      className="font-heading text-base text-skin-base underline transition hover:opacity-70"
                    >
                      {link.title}
                    </a>
                  )
                );
              })}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

const GalleryCoinEditor = ({
  adminAuth,
  coin,
  galleryPublicEnabled,
  mutate,
}: {
  adminAuth: AdminAuth;
  coin: GalleryCoin;
  galleryPublicEnabled: boolean;
  mutate: KeyedMutator<{
    coins: GalleryCoin[];
    galleryPublicEnabled: boolean;
  }>;
}) => {
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const updateHidden = async (hidden: boolean) => {
    try {
      setIsSaving(true);
      setMessage(null);
      await sendAdminRequest(
        `/api/admin/gallery/${encodeURIComponent(coin.address)}`,
        adminAuth,
        "PATCH",
        { hidden }
      );
      await mutate();
      setMessage(hidden ? "Coin hidden from the Gallery." : "Coin restored.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to save coin."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <EditorCard
      title={coin.title}
      status={coin.hidden ? "hidden" : "visible"}
      message={message}
      surfaceClassName="yc-dark-yellow-form-surface"
      headingAddon={
        !galleryPublicEnabled ? (
          <p className="mt-3 rounded-xl border border-skin-stroke bg-[#fff7bf] p-3 text-sm leading-snug text-secondary">
            The Gallery is globally disabled, so this coin is hidden publicly
            even if its individual status is visible.
          </p>
        ) : undefined
      }
      actions={
        <>
          {!coin.hidden && (
            <Link
              href={`/coins/${coin.address}`}
              target="_blank"
              rel="noreferrer"
              className={secondaryButtonClass}
            >
              View coin
            </Link>
          )}
          <button
            type="button"
            onClick={() => updateHidden(!coin.hidden)}
            disabled={isSaving}
            className={coin.hidden ? primaryButtonClass : dangerButtonClass}
          >
            {coin.hidden ? "Show in Gallery" : "Hide from Gallery"}
          </button>
        </>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <div>
          <div className="overflow-hidden rounded-2xl border border-skin-stroke bg-[#fff7bf]">
            <div className="aspect-square w-full">
              <CoinMediaPreview
                mediaUrl={coin.mediaUrl}
                imageUrl={coin.imageUrl}
                title={coin.title}
                symbol={coin.symbol}
                className="h-full w-full object-cover"
                fallbackClassName="flex h-full w-full items-center justify-center font-heading text-4xl text-skin-base"
              />
            </div>
          </div>
          <p className="mt-3 text-sm leading-snug text-secondary">
            Hiding a coin removes it from the public Gallery, direct coin page,
            and owner profile coin section.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <ReadonlyField label="Coin name" value={coin.coinName} />
          <ReadonlyField label="Symbol" value={coin.symbol} />
          <ReadonlyField label="Owner" value={coin.ownerAddress} />
          <ReadonlyField
            label="Payout recipient"
            value={coin.payoutRecipient}
          />
          <ReadonlyField label="Contract" value={coin.address} />
          <ReadonlyField
            label="Created"
            value={
              coin.createdAt
                ? new Date(coin.createdAt).toLocaleString()
                : "Unknown"
            }
          />
          <div className="md:col-span-2">
            <ReadonlyField
              label="Description"
              value={coin.description}
              multiline
            />
          </div>
          <div className="md:col-span-2">
            <ReadonlyField label="Media URL" value={coin.mediaUrl} multiline />
          </div>
          {coin.imageUrl && (
            <div className="md:col-span-2">
              <ReadonlyField
                label="Image URL"
                value={coin.imageUrl}
                multiline
              />
            </div>
          )}
        </div>
      </div>
    </EditorCard>
  );
};

const NoundryEditor = ({
  adminAuth,
  submission,
  mutate,
}: {
  adminAuth: AdminAuth;
  submission: NoundrySubmission;
  mutate: KeyedMutator<{ submissions: NoundrySubmission[] }>;
}) => {
  const [title, setTitle] = useState(submission.title);
  const [artist, setArtist] = useState(submission.artist);
  const [traitType, setTraitType] = useState(submission.traitType);
  const [selectedTraits, setSelectedTraits] = useState(
    formatTraits(submission.selectedTraits)
  );
  const [previewTraits, setPreviewTraits] = useState(
    formatTraits(submission.previewTraits)
  );
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const submit = async (action?: "approve" | "remove") => {
    try {
      setIsSaving(true);
      setMessage(null);
      const submissionPayload = {
        title,
        artist,
        traitType,
        selectedTraits: parseTraits(selectedTraits),
        previewTraits: parseTraits(previewTraits),
      };

      await sendAdminRequest(
        `/api/admin/noundry-submissions/${submission.id}`,
        adminAuth,
        action === "remove" ? "DELETE" : "PATCH",
        action
          ? { action, submission: submissionPayload }
          : { submission: submissionPayload }
      );
      await mutate();
      setMessage(
        action === "approve"
          ? "Submission approved."
          : action === "remove"
            ? "Submission removed."
            : "Submission saved."
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unable to save submission.";
      setMessage(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <EditorCard
      title={submission.title}
      status={submission.status}
      message={message}
      showStatusInTitle={submission.status !== "approved"}
      actions={
        <>
          <button
            type="button"
            onClick={() => submit()}
            disabled={isSaving}
            className={saveButtonClass}
          >
            Save metadata
          </button>
          {submission.status !== "approved" && (
            <button
              type="button"
              onClick={() => submit("approve")}
              disabled={isSaving}
              className={secondaryButtonClass}
            >
              Approve
            </button>
          )}
          <button
            type="button"
            onClick={() => submit("remove")}
            disabled={isSaving}
            className={dangerButtonClass}
          >
            Remove
          </button>
        </>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <div>
          <div className="rounded-2xl border border-skin-stroke bg-[#fff7bf] p-4">
            <PixelGridPreview pixels={submission.pixels} />
          </div>
          <p className="mt-3 text-sm leading-snug text-secondary">
            Pixel artwork is preserved as submitted. Metadata edits only change
            gallery labels and preview composition.
          </p>
        </div>
        <div className="flex flex-col gap-4">
          <FormField label="Title" value={title} onChange={setTitle} />
          <FormField
            label="Artist wallet"
            value={artist}
            onChange={setArtist}
          />
          <FormField
            label="Trait type"
            value={traitType}
            onChange={setTraitType}
          />
          <FormField
            label="Selected traits as trait: value"
            value={selectedTraits}
            onChange={setSelectedTraits}
            rows={5}
          />
          <FormField
            label="Preview traits as trait: value"
            value={previewTraits}
            onChange={setPreviewTraits}
            rows={5}
          />
        </div>
      </div>
    </EditorCard>
  );
};

const EditorCard = ({
  title,
  status,
  message,
  headingAddon,
  showStatusInTitle = true,
  surfaceClassName = "",
  actions,
  children,
}: {
  title: string;
  status: string;
  message: string | null;
  headingAddon?: ReactNode;
  showStatusInTitle?: boolean;
  surfaceClassName?: string;
  actions: ReactNode;
  children: ReactNode;
}) => (
  <div
    className={`${surfaceClassName} rounded-2xl border border-skin-stroke bg-white p-5 shadow-sm`}
  >
    <div className="flex flex-col gap-4 border-b border-skin-stroke pb-5 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <h2 className="break-words font-heading text-3xl leading-none text-skin-base">
            {title}
          </h2>
          {showStatusInTitle && <StatusPill status={status} />}
        </div>
        {headingAddon}
        {message && <p className="mt-2 text-sm text-secondary">{message}</p>}
      </div>
      <div className="flex shrink-0 flex-wrap gap-3">{actions}</div>
    </div>
    <div className="mt-5 flex flex-col gap-4">{children}</div>
  </div>
);

const EmptyEditor = ({
  title,
  surfaceClassName = "",
}: {
  title: string;
  surfaceClassName?: string;
}) => (
  <div
    className={`${surfaceClassName} rounded-2xl border border-dashed border-skin-stroke bg-white p-8 text-center shadow-sm`}
  >
    <h2 className="font-heading text-3xl leading-none text-skin-base">
      {title}
    </h2>
  </div>
);

const FormField = ({
  label,
  value,
  onChange,
  rows,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) => (
  <label className={labelClass}>
    {label}
    {rows ? (
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className={`${fieldClass} mt-2 resize-y`}
      />
    ) : (
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${fieldClass} mt-2`}
      />
    )}
  </label>
);

const ReadonlyField = ({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) => (
  <div>
    <div className={labelClass}>{label}</div>
    <div
      className={`mt-2 break-words rounded-[18px] border border-skin-stroke bg-skin-muted px-4 py-3 text-base text-skin-base ${
        multiline ? "whitespace-pre-wrap" : ""
      }`}
    >
      {value}
    </div>
  </div>
);

const DateField = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) => (
  <label className={labelClass}>
    {label}
    <input
      type="datetime-local"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={`${fieldClass} mt-2`}
    />
  </label>
);

const NumberField = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) => (
  <label className={labelClass}>
    {label}
    <input
      type="number"
      min={1}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      className={`${fieldClass} mt-2`}
    />
  </label>
);

const CheckboxField = ({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) => (
  <label className="flex items-center gap-3 rounded-xl border border-skin-stroke bg-skin-muted px-4 py-3 font-heading text-base text-skin-base">
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      className="h-5 w-5 accent-[#ffcc00]"
    />
    {label}
  </label>
);

const PixelGridPreview = ({ pixels }: { pixels: string[] }) => (
  <div
    className="grid aspect-square w-full overflow-hidden rounded-xl bg-[#999]"
    style={{ gridTemplateColumns: "repeat(32, minmax(0, 1fr))" }}
  >
    {Array.from({ length: 32 * 32 }).map((_, index) => {
      const color = pixels[index] || "transparent";

      return (
        <div
          key={index}
          className="aspect-square"
          style={{
            backgroundColor: color === "transparent" ? "#9a9a9a" : color,
          }}
        />
      );
    })}
  </div>
);
