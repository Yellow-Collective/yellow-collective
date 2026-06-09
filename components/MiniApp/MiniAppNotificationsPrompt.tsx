import {
  addMiniAppWithNotifications,
  getMiniAppContext,
  isInMiniApp,
  loadMiniAppSdk,
} from "@/utils/farcasterMiniApp";
import type { MiniAppContext } from "@/utils/farcasterMiniApp";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

const MINIAPP_NOTIFICATIONS_PROMPT_STORAGE_PREFIX =
  "yellow-miniapp-notifications-prompt:";

const getPromptStorageKey = (fid?: number) =>
  `${MINIAPP_NOTIFICATIONS_PROMPT_STORAGE_PREFIX}${fid || "anonymous"}`;

const hasPromptResponded = (fid?: number) => {
  if (typeof window === "undefined") return false;

  try {
    return Boolean(window.localStorage.getItem(getPromptStorageKey(fid)));
  } catch {
    return false;
  }
};

const markPromptResponded = (fid?: number) => {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(getPromptStorageKey(fid), new Date().toISOString());
  } catch {
    // Ignore storage failures; the prompt should still work without persistence.
  }
};

const getNotificationDetails = (context?: MiniAppContext | null) =>
  context?.notificationDetails || context?.client?.notificationDetails;

const saveMiniAppUser = async ({
  notificationsEnabled,
  walletAddress,
}: {
  notificationsEnabled?: boolean;
  walletAddress?: string;
}) => {
  const context = await getMiniAppContext();
  const fid = context?.user?.fid;
  if (!fid) return;

  await fetch("/api/miniapp/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      fid,
      username: context.user?.username,
      displayName: context.user?.displayName,
      pfpUrl: context.user?.pfpUrl,
      walletAddress,
      notificationsEnabled,
    }),
  }).catch((error) => {
    console.warn("Unable to save Mini App user context", error);
  });
};

export default function MiniAppNotificationsPrompt() {
  const { address } = useAccount();
  const [visible, setVisible] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [message, setMessage] = useState("");
  const [promptFid, setPromptFid] = useState<number | undefined>();

  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      const inMiniApp = await isInMiniApp();
      if (!inMiniApp || cancelled) return;

      const context = await getMiniAppContext();
      const contextFid = context?.user?.fid;
      const notificationDetails = getNotificationDetails(context);
      setPromptFid(contextFid);
      await saveMiniAppUser({
        notificationsEnabled: notificationDetails ? true : undefined,
        walletAddress: address,
      });

      if (
        !cancelled &&
        !context?.added &&
        !notificationDetails &&
        !hasPromptResponded(context?.user?.fid)
      ) {
        setVisible(true);
      }

      const sdk = await loadMiniAppSdk();
      sdk?.on?.("notificationsEnabled", () => {
        markPromptResponded(context?.user?.fid);
        void saveMiniAppUser({
          notificationsEnabled: true,
          walletAddress: address,
        });
        setVisible(false);
      });
      sdk?.on?.("notificationsDisabled", () => {
        markPromptResponded(context?.user?.fid);
        void saveMiniAppUser({
          notificationsEnabled: false,
          walletAddress: address,
        });
      });
      sdk?.on?.("miniappRemoved", () => {
        markPromptResponded(context?.user?.fid);
        void saveMiniAppUser({
          notificationsEnabled: false,
          walletAddress: address,
        });
      });
    };

    initialize();

    return () => {
      cancelled = true;
    };
  }, [address]);

  if (!visible) return null;

  const enableNotifications = async () => {
    try {
      setIsAdding(true);
      setMessage("");
      markPromptResponded(promptFid);
      const result = await addMiniAppWithNotifications();
      const notificationDetails = result?.notificationDetails;
      const notificationsEnabled = Boolean(notificationDetails);
      await saveMiniAppUser({
        notificationsEnabled: notificationDetails ? true : undefined,
        walletAddress: address,
      });
      setMessage(
        notificationsEnabled
          ? "Notifications enabled."
          : "Mini App added. Enable notifications in Farcaster settings."
      );
      if (result?.added || notificationsEnabled) setVisible(false);
    } catch (error) {
      markPromptResponded(promptFid);
      setMessage(
        error instanceof Error ? error.message : "Unable to enable notifications."
      );
    } finally {
      setIsAdding(false);
    }
  };

  const dismissPrompt = () => {
    markPromptResponded(promptFid);
    setVisible(false);
  };

  return (
    <div className="fixed inset-x-4 bottom-[calc(16px+var(--miniapp-safe-area-bottom))] z-50 mx-auto max-w-sm rounded-2xl border border-skin-stroke bg-white p-4 shadow-[0px_6px_0px_0px_rgb(var(--color-shadow-neutral))]">
      <div className="flex flex-col gap-3">
        <div>
          <h2 className="font-heading text-xl leading-none text-skin-base">
            Enable Yellow alerts
          </h2>
          <p className="mt-2 text-sm leading-snug text-secondary">
            Get notified when rounds, auctions, and proposal votes need attention.
          </p>
          {message && (
            <p className="mt-2 text-sm font-semibold text-secondary">
              {message}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={enableNotifications}
            disabled={isAdding}
            className="flex-1 rounded-[18px] bg-accent px-4 py-3 font-heading text-base text-skin-base shadow-[0px_4px_0px_0px_#b89400] disabled:opacity-50"
          >
            {isAdding ? "Adding..." : "Enable"}
          </button>
          <button
            type="button"
            onClick={dismissPrompt}
            className="rounded-[18px] border border-skin-stroke bg-white px-4 py-3 font-heading text-base text-skin-base"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
}
