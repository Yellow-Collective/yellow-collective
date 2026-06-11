export type MiniAppSafeAreaInsets = {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
};

export type MiniAppContext = {
  client?: {
    safeAreaInsets?: MiniAppSafeAreaInsets;
    notificationDetails?: {
      token?: string;
      url?: string;
    };
  };
  added?: boolean;
  notificationDetails?: {
    token?: string;
    url?: string;
  };
  user?: {
    fid?: number;
    username?: string;
    displayName?: string;
    pfpUrl?: string;
  };
};

export type MiniAppSdk = {
  isInMiniApp: () => Promise<boolean>;
  context?: MiniAppContext | Promise<MiniAppContext>;
  wallet?: {
    ethProvider?: MiniAppEthereumProvider;
    getEthereumProvider?: () => Promise<MiniAppEthereumProvider | undefined>;
  };
  actions: {
    ready: () => Promise<void>;
    addMiniApp?: () => Promise<{
      added?: boolean;
      notificationDetails?: { token?: string; url?: string };
    }>;
    addFrame?: () => Promise<{
      added?: boolean;
      notificationDetails?: { token?: string; url?: string };
    }>;
    composeCast?: (options: {
      text?: string;
      embeds?: string[];
      channelKey?: string;
    }) => Promise<unknown>;
    openUrl?: (url: string) => Promise<void>;
  };
  on?: (event: string, listener: (...args: any[]) => void) => void;
  removeListener?: (event: string, listener: (...args: any[]) => void) => void;
};

export type MiniAppEthereumProvider = {
  request: (args: { method: string; params?: unknown[] | Record<string, unknown> }) => Promise<unknown>;
  on?: (event: string, listener: (...args: any[]) => void) => void;
  removeListener?: (event: string, listener: (...args: any[]) => void) => void;
};

let sdkPromise: Promise<MiniAppSdk | null> | null = null;
let miniAppCheckPromise: Promise<boolean> | null = null;

export const loadMiniAppSdk = async () => {
  if (typeof window === "undefined") return null;

  if (!sdkPromise) {
    sdkPromise = (async () => {
      try {
        const module = await import("@farcaster/miniapp-sdk");

        return module.sdk || module.default || null;
      } catch (error) {
        console.warn("Unable to load Farcaster Mini App SDK", error);
        return null;
      }
    })();
  }

  return sdkPromise;
};

export const isInMiniApp = async () => {
  if (!miniAppCheckPromise) {
    miniAppCheckPromise = (async () => {
      const sdk = await loadMiniAppSdk();
      if (!sdk) return false;

      try {
        return await sdk.isInMiniApp();
      } catch (error) {
        console.warn("Unable to detect Farcaster Mini App context", error);
        return false;
      }
    })();
  }

  return miniAppCheckPromise;
};

export const getMiniAppContext = async () => {
  const sdk = await loadMiniAppSdk();
  if (!sdk?.context) return null;

  try {
    return await Promise.resolve(sdk.context);
  } catch (error) {
    console.warn("Unable to read Farcaster Mini App context", error);
    return null;
  }
};

export const getMiniAppEthereumProvider = async () => {
  const sdk = await loadMiniAppSdk();
  if (!sdk?.wallet) return undefined;

  try {
    return sdk.wallet.getEthereumProvider
      ? await sdk.wallet.getEthereumProvider()
      : sdk.wallet.ethProvider;
  } catch (error) {
    console.warn("Unable to read Farcaster Mini App wallet provider", error);
    return undefined;
  }
};

export const addMiniAppWithNotifications = async () => {
  const sdk = await loadMiniAppSdk();
  if (!sdk?.actions) {
    throw new Error("Farcaster Mini App SDK is unavailable.");
  }

  try {
    if (sdk.actions.addMiniApp) return await sdk.actions.addMiniApp();
    if (sdk.actions.addFrame) return await sdk.actions.addFrame();
    throw new Error("This Farcaster client does not support Mini App installs.");
  } catch (error) {
    console.warn("Unable to add Farcaster Mini App", error);
    throw error instanceof Error
      ? error
      : new Error("Unable to add Farcaster Mini App.");
  }
};
