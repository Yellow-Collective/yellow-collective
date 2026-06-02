import { BigNumber } from "@ethersproject/bignumber";
import * as ethersV6 from "ethers6";
import {
  AbiCoder,
  Contract,
  FallbackProvider,
  Interface,
  JsonRpcProvider,
  JsonRpcSigner,
  ZeroAddress,
  formatEther as formatEtherV6,
  formatUnits as formatUnitsV6,
  getAddress,
  isAddress,
  keccak256,
  parseEther,
  parseUnits,
  toUtf8String,
  verifyTypedData,
  zeroPadValue,
} from "ethers6";
import type { BigNumberish, Signer } from "ethers6";

const defaultAbiCoder = AbiCoder.defaultAbiCoder();
const normalizeBigNumberish = (value: unknown) =>
  BigNumber.isBigNumber(value) ? value.toString() : (value as BigNumberish);

class CompatJsonRpcProvider extends JsonRpcProvider {
  get pollingInterval() {
    return (this as any).__compatPollingInterval ?? 4000;
  }

  set pollingInterval(value: number) {
    (this as any).__compatPollingInterval = Number(value);
  }
}

class CompatFallbackProvider extends FallbackProvider {
  constructor(providerConfigs: any[], networkOrQuorum?: any, options?: any) {
    const configs = providerConfigs.map((config) =>
      config?.provider
        ? {
            ...config,
            priority: config.priority || 1,
            stallTimeout: config.stallTimeout || 400,
            weight: config.weight || 1,
          }
        : config
    );

    if (typeof networkOrQuorum === "number" && options === undefined) {
      super(configs, undefined, { quorum: networkOrQuorum });
      return;
    }

    super(configs, networkOrQuorum, options);
  }

  get pollingInterval() {
    return (this as any).__compatPollingInterval ?? 4000;
  }

  set pollingInterval(value: number) {
    (this as any).__compatPollingInterval = Number(value);
  }
}

(Interface.prototype as unknown as { getEventTopic?: (name: string) => string })
  .getEventTopic = function getEventTopic(this: Interface, name: string) {
  const event = this.getEvent(name);
  if (!event) throw new Error(`Unknown event: ${name}`);
  return event.topicHash;
};

export const formatEther = (value: unknown) =>
  formatEtherV6(normalizeBigNumberish(value));

export const formatUnits = (value: unknown, unit?: string | number) =>
  formatUnitsV6(normalizeBigNumberish(value), unit);

export const utils: any = {
  defaultAbiCoder,
  formatEther,
  formatUnits,
  getAddress,
  hexZeroPad: zeroPadValue,
  Interface,
  isAddress,
  keccak256,
  parseEther,
  parseUnits,
  toUtf8String,
  verifyTypedData,
};

export const constants = {
  AddressZero: ZeroAddress,
};

export const providers: any = {
  FallbackProvider: CompatFallbackProvider,
  JsonRpcProvider: CompatJsonRpcProvider,
  JsonRpcSigner,
  StaticJsonRpcProvider: CompatJsonRpcProvider,
};

export const ethers = {
  ...ethersV6,
  BigNumber,
  constants,
  Contract,
  providers,
  utils,
};

export {
  BigNumber,
  CompatFallbackProvider as FallbackProvider,
  Contract,
  Interface,
  CompatJsonRpcProvider as JsonRpcProvider,
  JsonRpcSigner,
  ZeroAddress,
  type BigNumberish,
  type Signer,
  getAddress,
  isAddress,
  keccak256,
  parseEther,
  parseUnits,
  toUtf8String,
  verifyTypedData,
  zeroPadValue,
};
