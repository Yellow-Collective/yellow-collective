export type HeaderHomeNavItem = {
  label: string;
  href: string;
};

export const getHomeNavigationItems = (
  isConnected: boolean,
  isAdmin: boolean
): HeaderHomeNavItem[] => {
  return [
    { label: "Home", href: "/" },
    { label: "Dashboard", href: "/dashboard" },
    ...(isConnected && isAdmin
      ? [{ label: "Admin Dashboard", href: "/admin/dashboard" }]
      : []),
  ];
};
