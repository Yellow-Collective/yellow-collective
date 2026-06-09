import { BigNumber } from "@ethersproject/bignumber";
import * as ethers6 from "ethers6";

const normalizeBigNumberish = (value) =>
  BigNumber.isBigNumber(value) ? value.toString() : value;

export class FunctionFragment {
  static from(value) {
    return ethers6.FunctionFragment.from(value);
  }
}

export const FormatTypes = {
  full: "full",
  json: "json",
  minimal: "minimal",
  sighash: "sighash",
};

export const defaultAbiCoder = ethers6.AbiCoder.defaultAbiCoder();
export const Interface = ethers6.Interface;
export const arrayify = ethers6.getBytes;
export const formatEther = (value) =>
  ethers6.formatEther(normalizeBigNumberish(value));
export const formatUnits = (value, unit) =>
  ethers6.formatUnits(normalizeBigNumberish(value), unit);
export const getAddress = ethers6.getAddress;
export const hexValue = ethers6.toBeHex;
export const hexZeroPad = ethers6.zeroPadValue;
export const isAddress = ethers6.isAddress;
export const keccak256 = ethers6.keccak256;
export const parseBytes32String = ethers6.decodeBytes32String;
export const parseEther = ethers6.parseEther;
export const parseUnits = ethers6.parseUnits;
export const toUtf8String = ethers6.toUtf8String;
export const verifyTypedData = ethers6.verifyTypedData;

export default {
  ...ethers6,
  defaultAbiCoder,
  FormatTypes,
  FunctionFragment,
  Interface,
  arrayify,
  formatEther,
  formatUnits,
  getAddress,
  hexValue,
  hexZeroPad,
  isAddress,
  keccak256,
  parseBytes32String,
  parseEther,
  parseUnits,
  toUtf8String,
  verifyTypedData,
};
