const ethers6 = require("ethers6");
const { BigNumber } = require("@ethersproject/bignumber");
const utils = require("./lib/utils.js");

class CompatJsonRpcProvider extends ethers6.JsonRpcProvider {
  get pollingInterval() {
    return this.__compatPollingInterval ?? 4000;
  }

  set pollingInterval(value) {
    this.__compatPollingInterval = Number(value);
  }
}

class CompatFallbackProvider extends ethers6.FallbackProvider {
  constructor(providerConfigs, networkOrQuorum, options) {
    const configs = providerConfigs.map((config) =>
      config && config.provider
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

const providers = {
  FallbackProvider: CompatFallbackProvider,
  JsonRpcProvider: CompatJsonRpcProvider,
  JsonRpcSigner: ethers6.JsonRpcSigner,
  StaticJsonRpcProvider: CompatJsonRpcProvider,
};

const constants = {
  AddressZero: ethers6.ZeroAddress,
};

const compat = {
  ...ethers6,
  BigNumber,
  constants,
  Contract: ethers6.Contract,
  FallbackProvider: CompatFallbackProvider,
  JsonRpcProvider: CompatJsonRpcProvider,
  providers,
  utils,
};

compat.ethers = compat;

module.exports = compat;
