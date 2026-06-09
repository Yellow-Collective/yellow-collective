import { BigNumber } from "@ethersproject/bignumber";
import {
  Contract,
  FallbackProvider,
  Interface,
  JsonRpcProvider,
  JsonRpcSigner,
  ZeroAddress,
  getAddress,
  isAddress,
  keccak256,
  parseEther,
  parseUnits,
  toUtf8String,
  verifyTypedData,
  zeroPadValue,
} from "ethers6";
import * as utils from "./lib/utils.mjs";

class CompatJsonRpcProvider extends JsonRpcProvider {
  get pollingInterval() {
    return this.__compatPollingInterval ?? 4000;
  }

  set pollingInterval(value) {
    this.__compatPollingInterval = Number(value);
  }
}

class CompatFallbackProvider extends FallbackProvider {
  constructor(providerConfigs, networkOrQuorum, options) {
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
    return this.__compatPollingInterval ?? 4000;
  }

  set pollingInterval(value) {
    this.__compatPollingInterval = Number(value);
  }
}

export const providers = {
  FallbackProvider: CompatFallbackProvider,
  JsonRpcProvider: CompatJsonRpcProvider,
  JsonRpcSigner,
  StaticJsonRpcProvider: CompatJsonRpcProvider,
};

export const constants = {
  AddressZero: ZeroAddress,
};

export { BigNumber };
export {
  Contract,
  CompatFallbackProvider as FallbackProvider,
  Interface,
  CompatJsonRpcProvider as JsonRpcProvider,
  JsonRpcSigner,
  ZeroAddress,
  getAddress,
  isAddress,
  keccak256,
  parseEther,
  parseUnits,
  toUtf8String,
  verifyTypedData,
  zeroPadValue,
};

const compat = {
  BigNumber,
  constants,
  Contract,
  providers,
  utils,
};

compat.ethers = compat;

export const ethers = compat;
export default compat;
