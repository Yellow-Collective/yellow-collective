import { getAddress, isAddress } from "viem";

export const GLOBAL_ADMIN_WALLET_ADDRESS =
  "0xdcf37d8Aa17142f053AAA7dc56025aB00D897a19";

export const LEGACY_ADMIN_WALLET_ADDRESSES = [
  "0x70abdCd7A5A8Ff9cDef1ccA9eA15a5d315780986",
] as const;

export const ADMIN_PERMISSION_DEFINITIONS = [
  { id: "community", label: "Community Projects" },
  { id: "noundry", label: "Noundry Gallery" },
  { id: "gallery", label: "Gallery" },
  { id: "rounds", label: "Rounds" },
  { id: "nouns", label: "Nouns + Metagov" },
  { id: "testing", label: "Testing content" },
] as const;

export type AdminPermission =
  (typeof ADMIN_PERMISSION_DEFINITIONS)[number]["id"];

export type AdminAccessRecord = {
  walletAddress: string;
  permissions: AdminPermission[];
};

const ADMIN_PERMISSION_IDS = ADMIN_PERMISSION_DEFINITIONS.map(
  (permission) => permission.id
);
const ADMIN_PERMISSION_ID_SET = new Set<string>(ADMIN_PERMISSION_IDS);

const normalizeAddressPrefix = (address: string) =>
  address.startsWith("0X") ? `0x${address.slice(2)}` : address;

export const normalizeAdminWalletAddress = (address?: string | null) => {
  if (!address) return null;

  const normalizedInput = normalizeAddressPrefix(address.trim());
  if (!isAddress(normalizedInput)) return null;

  return getAddress(normalizedInput);
};

export const isGlobalAdminAddress = (address?: string | null) => {
  const normalizedAddress = normalizeAdminWalletAddress(address);
  return normalizedAddress === GLOBAL_ADMIN_WALLET_ADDRESS;
};

export const isAdminPermission = (
  permission: unknown
): permission is AdminPermission =>
  typeof permission === "string" && ADMIN_PERMISSION_ID_SET.has(permission);

export const normalizeAdminPermissions = (
  permissions: unknown
): AdminPermission[] => {
  const permissionSet = new Set<AdminPermission>();

  if (Array.isArray(permissions)) {
    permissions.forEach((permission) => {
      if (isAdminPermission(permission)) permissionSet.add(permission);
    });
  }

  return ADMIN_PERMISSION_IDS.filter((permission) =>
    permissionSet.has(permission)
  );
};

export const getAllAdminPermissions = (): AdminPermission[] => [
  ...ADMIN_PERMISSION_IDS,
];

export const sanitizeAdminAccessRecords = (
  records: unknown
): AdminAccessRecord[] => {
  if (!Array.isArray(records)) return [];

  const recordMap = new Map<string, Set<AdminPermission>>();

  records.forEach((record) => {
    if (!record || typeof record !== "object") return;

    const walletAddress = normalizeAdminWalletAddress(
      (record as { walletAddress?: unknown }).walletAddress as string
    );
    if (!walletAddress || isGlobalAdminAddress(walletAddress)) return;

    const permissions = normalizeAdminPermissions(
      (record as { permissions?: unknown }).permissions
    );
    const existingPermissions =
      recordMap.get(walletAddress) || new Set<AdminPermission>();

    permissions.forEach((permission) => existingPermissions.add(permission));
    recordMap.set(walletAddress, existingPermissions);
  });

  return Array.from(recordMap.entries()).map(
    ([walletAddress, permissionSet]) => ({
      walletAddress,
      permissions: ADMIN_PERMISSION_IDS.filter((permission) =>
        permissionSet.has(permission)
      ),
    })
  );
};

export const getAdminPermissions = ({
  walletAddress,
  admins,
}: {
  walletAddress?: string | null;
  admins: AdminAccessRecord[];
}) => {
  const normalizedAddress = normalizeAdminWalletAddress(walletAddress);
  if (!normalizedAddress) return [];
  if (isGlobalAdminAddress(normalizedAddress)) return getAllAdminPermissions();

  const admin = sanitizeAdminAccessRecords(admins).find(
    (record) => record.walletAddress === normalizedAddress
  );

  return admin?.permissions || [];
};

export const hasAdminPermission = (
  {
    walletAddress,
    admins,
  }: {
    walletAddress?: string | null;
    admins: AdminAccessRecord[];
  },
  permission: AdminPermission
) => getAdminPermissions({ walletAddress, admins }).includes(permission);

export const isDesignatedAdminAddress = ({
  walletAddress,
  admins,
}: {
  walletAddress?: string | null;
  admins: AdminAccessRecord[];
}) => {
  const normalizedAddress = normalizeAdminWalletAddress(walletAddress);
  if (!normalizedAddress) return false;
  if (isGlobalAdminAddress(normalizedAddress)) return true;

  return sanitizeAdminAccessRecords(admins).some(
    (record) => record.walletAddress === normalizedAddress
  );
};

export const getDefaultAdminAccessRecords = (): AdminAccessRecord[] =>
  sanitizeAdminAccessRecords(
    LEGACY_ADMIN_WALLET_ADDRESSES.map((walletAddress) => ({
      walletAddress,
      permissions: getAllAdminPermissions(),
    }))
  );
