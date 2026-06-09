import {
  addMiniAppWithNotifications,
  getMiniAppContext,
  isInMiniApp,
  loadMiniAppSdk,
} from "@/utils/farcasterMiniApp";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

const saveMiniAppUser = async ({
  notificationsEnabled,
  walletAddress,
}: {
  notificationsEnabled: boolean;
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

  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      const inMiniApp = await isInMiniApp();
      if (!inMiniApp || cancelled) return;

      const context = await getMiniAppContext();
      await saveMiniAppUser({
        notificationsEnabled: Boolean(context?.notificationDetails),
        walletAddress: address,
      });

      if (!cancelled && !context?.added && !context?.notificationDetails) {
        setVisible(true);
      }

      const sdk = await loadMiniAppSdk();
      sdk?.on?.("notificationsEnabled", () => {
        void saveMiniAppUser({
          notificationsEnabled: true,
          walletAddress: address,
        });
        setVisible(false);
      });
      sdk?.on?.("notificationsDisabled", () => {
        void saveMiniAppUser({
          notificationsEnabled: false,
          walletAddress: address,
        });
      });
      sdk?.on?.("miniappRemoved", () => {
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
      const result = await addMiniAppWithNotifications();
      const notificationsEnabled = Boolean(result?.notificationDetails);
      await saveMiniAppUser({ notificationsEnabled, walletAddress: address });
      setMessage(
        notificationsEnabled
          ? "Notifications enabled."
          : "Mini App added. Enable notifications in Farcaster settings."
      );
      if (result?.added || notificationsEnabled) setVisible(false);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to enable notifications."
      );
    } finally {
      setIsAdding(false);
    }
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
            onClick={() => setVisible(false)}
            className="rounded-[18px] border border-skin-stroke bg-white px-4 py-3 font-heading text-base text-skin-base"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
}
