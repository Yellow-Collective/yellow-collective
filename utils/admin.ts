import {
  GLOBAL_ADMIN_WALLET_ADDRESS,
  isGlobalAdminAddress,
} from "./admin-permissions";

export const ADMIN_WALLET_ADDRESSES = [
  GLOBAL_ADMIN_WALLET_ADDRESS,
] as const;

export const ADMIN_WALLET_ADDRESS = ADMIN_WALLET_ADDRESSES[0];

export const isAdminAddress = (address?: string | null) =>
  isGlobalAdminAddress(address);
