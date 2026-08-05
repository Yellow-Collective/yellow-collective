export type HeaderHomeNavItem = {
  label: string;
  href: string;
};

export const getHomeNavigationItems = (
  isConnected: boolean,
  isAdmin: boolean
): HeaderHomeNavItem[] | null => {
  if (!isConnected) return null;

  return [
    { label: "Home", href: "/" },
    { label: "Dashboard", href: "/dashboard" },
    ...(isAdmin
      ? [{ label: "Admin Dashboard", href: "/admin/dashboard" }]
      : []),
  ];
};
