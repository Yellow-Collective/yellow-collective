const ethers6 = require("ethers6");
const { BigNumber } = require("@ethersproject/bignumber");

const normalizeBigNumberish = (value) =>
  BigNumber.isBigNumber(value) ? value.toString() : value;

class FunctionFragment {
  static from(value) {
    return ethers6.FunctionFragment.from(value);
  }
}

const FormatTypes = {
  full: "full",
  json: "json",
  minimal: "minimal",
  sighash: "sighash",
};

const defaultAbiCoder = ethers6.AbiCoder.defaultAbiCoder();

module.exports = {
  ...ethers6,
  defaultAbiCoder,
  FormatTypes,
  FunctionFragment,
  Interface: ethers6.Interface,
  arrayify: ethers6.getBytes,
  formatEther: (value) => ethers6.formatEther(normalizeBigNumberish(value)),
  formatUnits: (value, unit) =>
    ethers6.formatUnits(normalizeBigNumberish(value), unit),
  getAddress: ethers6.getAddress,
  hexValue: ethers6.toBeHex,
  hexZeroPad: ethers6.zeroPadValue,
  isAddress: ethers6.isAddress,
  keccak256: ethers6.keccak256,
  parseBytes32String: ethers6.decodeBytes32String,
  parseEther: ethers6.parseEther,
  parseUnits: ethers6.parseUnits,
  toUtf8String: ethers6.toUtf8String,
  verifyTypedData: ethers6.verifyTypedData,
};
