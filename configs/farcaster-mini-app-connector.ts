import {
  AddChainError,
  ChainNotConfiguredError,
  Connector,
  ConnectorNotFoundError,
  ProviderRpcError,
  ResourceUnavailableError,
  SwitchChainError,
  UserRejectedRequestError,
  getClient,
  normalizeChainId,
} from "@wagmi/core";
import type { Address, Chain } from "wagmi";
import { getAddress, numberToHex } from "viem";
import {
  getMiniAppEthereumProvider,
  isInMiniApp,
  type MiniAppEthereumProvider,
} from "@/utils/farcasterMiniApp";

type FarcasterMiniAppConnectorOptions = {
  shimDisconnect?: boolean;
};

type FarcasterMiniAppProvider = MiniAppEthereumProvider;

export const FARCASTER_MINI_APP_CONNECTOR_ID = "farcasterMiniApp";

export class FarcasterMiniAppConnector extends Connector<
  FarcasterMiniAppProvider | undefined,
  FarcasterMiniAppConnectorOptions,
  any
> {
  readonly id = FARCASTER_MINI_APP_CONNECTOR_ID;
  readonly name = "Farcaster";
  readonly ready = typeof window !== "undefined";

  protected shimDisconnectKey = `${this.id}.shimDisconnect`;
  private provider?: FarcasterMiniAppProvider;

  constructor({
    chains,
    options,
  }: {
    chains?: Chain[];
    options?: FarcasterMiniAppConnectorOptions;
  } = {}) {
    super({
      chains,
      options: {
        shimDisconnect: true,
        ...options,
      },
    });
  }

  async connect({ chainId }: { chainId?: number } = {}) {
    try {
      const provider = await this.getProvider();
      if (!provider) throw new ConnectorNotFoundError();

      this.bindProviderEvents(provider);
      this.emit("message", { type: "connecting" });

      const accounts = (await provider.request({
        method: "eth_requestAccounts",
      })) as string[];
      const account = getAddress(accounts[0]) as Address;

      let id = await this.getChainId();
      let unsupported = this.isChainUnsupported(id);

      if (chainId && id !== chainId) {
        const chain = await this.switchChain(chainId);
        id = chain.id;
        unsupported = this.isChainUnsupported(id);
      }

      if (this.options.shimDisconnect) {
        getClient().storage?.setItem(this.shimDisconnectKey, true);
      }

      return {
        account,
        chain: { id, unsupported },
        provider,
      };
    } catch (error: any) {
      if (this.isUserRejectedRequestError(error)) {
        throw new UserRejectedRequestError(error);
      }

      if (error?.code === -32002) {
        throw new ResourceUnavailableError(error);
      }

      throw error;
    }
  }

  async disconnect() {
    const provider = await this.getProvider();
    provider?.removeListener?.("accountsChanged", this.onAccountsChanged);
    provider?.removeListener?.("chainChanged", this.onChainChanged);
    provider?.removeListener?.("disconnect", this.onDisconnect);

    if (this.options.shimDisconnect) {
      getClient().storage?.removeItem(this.shimDisconnectKey);
    }
  }

  async getAccount() {
    const provider = await this.getProvider();
    if (!provider) throw new ConnectorNotFoundError();

    const accounts = (await provider.request({
      method: "eth_accounts",
    })) as string[];

    if (!accounts[0]) throw new ConnectorNotFoundError();

    return getAddress(accounts[0]) as Address;
  }

  async getChainId() {
    const provider = await this.getProvider();
    if (!provider) throw new ConnectorNotFoundError();

    const chainId = await provider.request({ method: "eth_chainId" });
    return normalizeChainId(chainId as string | number);
  }

  async getProvider() {
    if (this.provider) return this.provider;

    const provider = await getMiniAppEthereumProvider();
    if (provider) this.provider = provider;

    return this.provider;
  }

  async getSigner({ chainId }: { chainId?: number } = {}) {
    const [provider, account] = await Promise.all([
      this.getProvider(),
      this.getAccount(),
    ]);
    if (!provider) throw new ConnectorNotFoundError();

    const { BrowserProvider } = require("ethers");
    return new BrowserProvider(provider as any, chainId).getSigner(account);
  }

  async isAuthorized() {
    try {
      if (this.options.shimDisconnect && !getClient().storage?.getItem(this.shimDisconnectKey)) {
        return false;
      }

      const inMiniApp = await isInMiniApp();
      if (!inMiniApp) return false;

      const account = await this.getAccount();
      return Boolean(account);
    } catch {
      return false;
    }
  }

  async switchChain(chainId: number) {
    const provider = await this.getProvider();
    if (!provider) throw new ConnectorNotFoundError();

    const id = numberToHex(chainId);

    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: id }],
      });

      return this.chains.find((chain) => chain.id === chainId) ?? {
        id: chainId,
        name: `Chain ${id}`,
        network: `${id}`,
        nativeCurrency: { name: "Ether", decimals: 18, symbol: "ETH" },
        rpcUrls: { default: { http: [""] }, public: { http: [""] } },
      };
    } catch (error: any) {
      const chain = this.chains.find((configuredChain) => configuredChain.id === chainId);
      if (!chain) throw new ChainNotConfiguredError({ chainId, connectorId: this.id });

      if (error?.code === 4902 || error?.data?.originalError?.code === 4902) {
        try {
          await provider.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: id,
                chainName: chain.name,
                nativeCurrency: chain.nativeCurrency,
                rpcUrls: [chain.rpcUrls.public?.http[0] ?? ""],
                blockExplorerUrls: this.getBlockExplorerUrls(chain),
              },
            ],
          });

          const currentChainId = await this.getChainId();
          if (currentChainId !== chainId) {
            throw new ProviderRpcError("User rejected switch after adding network.", {
              code: 4001,
            });
          }

          return chain;
        } catch (addError: any) {
          if (this.isUserRejectedRequestError(addError)) {
            throw new UserRejectedRequestError(addError);
          }

          throw new AddChainError();
        }
      }

      if (this.isUserRejectedRequestError(error)) {
        throw new UserRejectedRequestError(error);
      }

      throw new SwitchChainError(error);
    }
  }

  protected onAccountsChanged = (accounts: string[]) => {
    if (accounts.length === 0) {
      this.emit("disconnect");
    } else {
      this.emit("change", {
        account: getAddress(accounts[0]) as Address,
      });
    }
  };

  protected onChainChanged = (chainId: number | string) => {
    const id = normalizeChainId(chainId);
    this.emit("change", {
      chain: {
        id,
        unsupported: this.isChainUnsupported(id),
      },
    });
  };

  protected onDisconnect = async () => {
    this.emit("disconnect");

    if (this.options.shimDisconnect) {
      getClient().storage?.removeItem(this.shimDisconnectKey);
    }
  };

  private bindProviderEvents(provider: FarcasterMiniAppProvider) {
    provider.on?.("accountsChanged", this.onAccountsChanged);
    provider.on?.("chainChanged", this.onChainChanged);
    provider.on?.("disconnect", this.onDisconnect);
  }

  private isUserRejectedRequestError(error: any) {
    return error?.code === 4001;
  }
}
