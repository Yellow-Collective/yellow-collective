import Layout from "@/components/Layout";
import CoinMediaPreview from "@/components/coins/CoinMediaPreview";
import ProjectMemberSelector from "@/components/community/ProjectMemberSelector";
import { isAdminAddress } from "@/utils/admin";
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
import type {
  Round,
  RoundSubmission,
  RoundInput,
  RoundRequest,
} from "data/rounds";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import useSWR, { type Fetcher, type KeyedMutator } from "swr";
import { useAccount, useSignMessage } from "wagmi";

type AdminSection = "community" | "noundry" | "gallery" | "rounds" | "nouns";
type CommunityListMode = "queue" | "existing";
type ProjectEditorMode = "edit" | "preview";
type RoundListMode = "draft" | "published" | "archived";

type AdminAuth = Required<Pick<{ adminAddress?: string }, "adminAddress">>;

type AdminRequestBody = Record<string, unknown>;
type AdminSWRKey = readonly [string, AdminAuth];

const adminSections: { id: AdminSection; label: string }[] = [
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
];

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

  return data as { adminAddress: string };
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

const roundSubmissionsFetcher = createAdminFetcher<{
  submissions: RoundSubmission[];
}>();

const roundRequestsFetcher = createAdminFetcher<{
  requests: RoundRequest[];
}>();

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
      : "1 vote per Collective Noun";

const getQueryValue = (value: string | string[] | undefined) =>
  typeof value === "string" ? value : value?.[0];

export default function AdminDashboardPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { signMessageAsync, isLoading: isSigning } = useSignMessage();
  const [adminAuth, setAdminAuth] = useState<AdminAuth | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(false);
  const isAdmin = isAdminAddress(address);
  const activeSection: AdminSection =
    router.query.section === "noundry"
      ? "noundry"
      : router.query.section === "gallery"
        ? "gallery"
        : router.query.section === "rounds"
          ? "rounds"
          : router.query.section === "nouns"
            ? "nouns"
            : "community";

  const communityKey = adminAuth
    ? (["/api/admin/community-projects", adminAuth] as const)
    : null;
  const noundryKey = adminAuth
    ? (["/api/admin/noundry-submissions", adminAuth] as const)
    : null;
  const galleryKey = adminAuth
    ? (["/api/admin/gallery", adminAuth] as const)
    : null;
  const roundsKey = adminAuth
    ? (["/api/admin/rounds", adminAuth] as const)
    : null;
  const roundsSettingsKey = adminAuth
    ? (["/api/admin/rounds/settings", adminAuth] as const)
    : null;
  const testingSettingsKey = adminAuth
    ? (["/api/admin/testing/settings", adminAuth] as const)
    : null;
  const nounsSettingsKey = adminAuth
    ? (["/api/admin/nouns/settings", adminAuth] as const)
    : null;
  const roundRequestsKey = adminAuth
    ? (["/api/admin/rounds/requests", adminAuth] as const)
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
    data: roundRequestsData,
    error: roundRequestsError,
    mutate: mutateRoundRequests,
  } = useSWR<{ requests: RoundRequest[] }, Error, AdminSWRKey | null>(
    roundRequestsKey,
    roundRequestsFetcher
  );

  useEffect(() => {
    if (!isAdmin) setAdminAuth(null);
  }, [isAdmin, address]);

  useEffect(() => {
    if (!isAdmin || !address || adminAuth) return;

    let isMounted = true;
    setIsCheckingSession(true);
    void fetch("/api/admin/session", {
      cache: "no-store",
      credentials: "same-origin",
    })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as { adminAddress?: string };
      })
      .then((data) => {
        if (
          isMounted &&
          data?.adminAddress &&
          data.adminAddress.toLowerCase() === address.toLowerCase()
        ) {
          setAdminAuth({ adminAddress: data.adminAddress });
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (isMounted) setIsCheckingSession(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isAdmin, address, adminAuth]);

  const authorize = async () => {
    if (!address) return;

    try {
      setAuthError(null);
      const session = await createAdminSession(address, signMessageAsync);
      setAdminAuth({ adminAddress: session.adminAddress || address });
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
            {isAdmin && (
              <button
                type="button"
                onClick={authorize}
                disabled={isSigning}
                className={dangerButtonClass}
              >
                {adminAuth
                  ? "Admin access active"
                  : isSigning
                    ? "Signing..."
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
        {isConnected && !isAdmin && (
          <AdminNotice title="Admin wallet required">
            This dashboard is only available to the configured admin wallet.
          </AdminNotice>
        )}
        {isAdmin && authError && (
          <AdminNotice title="Signature failed">{authError}</AdminNotice>
        )}
        {isAdmin && !adminAuth && !isCheckingSession && (
          <AdminNotice title="Signature required">
            Unlock admin requests once to manage community projects, Noundry,
            rounds, and Nouns metagov access.
          </AdminNotice>
        )}

        {isAdmin && (
          <section className="flex flex-col gap-6">
            <div className="flex flex-nowrap justify-center gap-1 overflow-x-auto border-b border-skin-stroke sm:gap-3">
              {adminSections.map((section) => {
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
            {adminAuth && (
              <>
                <TestingSettingsPanel
                  adminAuth={adminAuth}
                  dummyContentEnabled={
                    testingSettingsData?.dummyContentEnabled || false
                  }
                  error={testingSettingsError?.message}
                  isLoading={!testingSettingsData && !testingSettingsError}
                  mutate={mutateTestingSettings}
                />
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

const StatusPill = ({ status }: { status: string }) => {
  const color =
    status === "approved" || status === "published" || status === "visible"
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
            <option value="one_per_nft">1 vote per Collective Noun</option>
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
