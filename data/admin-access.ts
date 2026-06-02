import {
  GLOBAL_ADMIN_WALLET_ADDRESS,
  ADMIN_PERMISSION_DEFINITIONS,
  getAdminPermissions,
  getDefaultAdminAccessRecords,
  hasAdminPermission,
  isDesignatedAdminAddress,
  isGlobalAdminAddress,
  sanitizeAdminAccessRecords,
  type AdminAccessRecord,
  type AdminPermission,
} from "@/utils/admin-permissions";
import { getTextSiteSetting, setTextSiteSetting } from "./site-settings";

const ADMIN_ACCESS_SETTING_KEY = "admin_access_v1";

export type AdminAccessResponseRecord = AdminAccessRecord & {
  isGlobal: boolean;
};

export type AdminAccessState = {
  admins: AdminAccessRecord[];
};

const parseAdminAccessState = (value: string | null): AdminAccessState => {
  if (!value) return { admins: getDefaultAdminAccessRecords() };

  try {
    const parsed = JSON.parse(value) as Partial<AdminAccessState>;
    return { admins: sanitizeAdminAccessRecords(parsed.admins || []) };
  } catch {
    return { admins: getDefaultAdminAccessRecords() };
  }
};

export const getAdminAccessState = async (): Promise<AdminAccessState> => {
  const value = await getTextSiteSetting(ADMIN_ACCESS_SETTING_KEY, null);
  return parseAdminAccessState(value);
};

export const setAdminAccessState = async (
  records: unknown
): Promise<AdminAccessState> => {
  const state = { admins: sanitizeAdminAccessRecords(records) };
  await setTextSiteSetting(ADMIN_ACCESS_SETTING_KEY, JSON.stringify(state));
  return state;
};

export const getAdminAccessResponse = async () => {
  const state = await getAdminAccessState();
  const globalAdmin: AdminAccessResponseRecord = {
    walletAddress: GLOBAL_ADMIN_WALLET_ADDRESS,
    permissions: ADMIN_PERMISSION_DEFINITIONS.map(
      (permission) => permission.id
    ),
    isGlobal: true,
  };
  const admins: AdminAccessResponseRecord[] = [
    globalAdmin,
    ...state.admins.map((admin) => ({ ...admin, isGlobal: false })),
  ];

  return {
    admins,
    permissionDefinitions: ADMIN_PERMISSION_DEFINITIONS,
  };
};

export const isAdminWalletAddress = async (walletAddress?: string | null) => {
  const state = await getAdminAccessState();
  return isDesignatedAdminAddress({ walletAddress, admins: state.admins });
};

export const getWalletAdminPermissions = async (
  walletAddress?: string | null
) => {
  const state = await getAdminAccessState();
  return getAdminPermissions({ walletAddress, admins: state.admins });
};

export const hasWalletAdminPermission = async (
  walletAddress: string | null | undefined,
  permission: AdminPermission
) => {
  const state = await getAdminAccessState();
  return hasAdminPermission({ walletAddress, admins: state.admins }, permission);
};

export const isGlobalAdminWalletAddress = (walletAddress?: string | null) =>
  isGlobalAdminAddress(walletAddress);
