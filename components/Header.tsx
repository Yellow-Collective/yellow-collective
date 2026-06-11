import { useThemeMode } from "@/hooks/useThemeMode";
import { isAdminAddress } from "@/utils/admin";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/solid";
import {
  ChevronDownIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";
import Button from "./Button";
import ThemeToggle from "./ThemeToggle";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";

type NavItem = {
  label: string;
  href: string;
  children?: NavItem[];
};

const homeItems: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "Admin Dashboard", href: "/admin/dashboard" },
];

const daoItems = [
  { label: "About", href: "/about" },
  { label: "Members", href: "/members" },
  { label: "Proposals", href: "/proposals" },
  { label: "Treasury", href: "/treasury" },
  { label: "Contracts", href: "/contracts" },
];

const baseArtItems = [
  { label: "Gallery", href: "/art" },
  { label: "Projects", href: "/projects" },
  { label: "Playground", href: "/playground" },
  { label: "Probe", href: "/probe" },
  {
    label: "Noundry",
    href: "/noundry",
    children: [
      { label: "Studio", href: "/noundry" },
      { label: "Gallery", href: "/noundry?tab=gallery" },
    ],
  },
];

const roundsNavItem = { label: "Rounds", href: "/rounds" };

const fetcher = async (url: string) => {
  const response = await fetch(url);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Unable to load data.");
  }

  return data;
};

const TreasuryPill = dynamic(() => import("./HeaderTreasuryPill"), {
  ssr: false,
});
const HeaderWalletState = dynamic(() => import("./HeaderWalletState"), {
  ssr: false,
});
const CustomConnectButton = dynamic(() => import("./CustomConnectButton"), {
  ssr: false,
});

export default function Header() {
  const { isDarkMode } = useThemeMode();
  const [isMounted, setIsMounted] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | undefined>();
  const { data: roundsSettings } = useSWR<{
    roundsPublicEnabled: boolean;
  }>("/api/rounds/settings", fetcher);
  const { data: gallerySettings } = useSWR<{
    galleryPublicEnabled: boolean;
  }>("/api/gallery/settings", fetcher);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const isAdmin = isMounted && isAdminAddress(walletAddress);
  const artItems = useMemo(() => {
    const visibleBaseArtItems =
      isAdmin || gallerySettings?.galleryPublicEnabled
        ? baseArtItems
        : baseArtItems.slice(1);

    if (isAdmin || roundsSettings?.roundsPublicEnabled) {
      const projectsIndex = visibleBaseArtItems.findIndex(
        (item) => item.href === "/projects"
      );

      if (projectsIndex >= 0) {
        return [
          ...visibleBaseArtItems.slice(0, projectsIndex + 1),
          roundsNavItem,
          ...visibleBaseArtItems.slice(projectsIndex + 1),
        ];
      }

      return [roundsNavItem, ...visibleBaseArtItems];
    }

    return visibleBaseArtItems;
  }, [
    gallerySettings?.galleryPublicEnabled,
    isAdmin,
    roundsSettings?.roundsPublicEnabled,
  ]);

  return (
    <header className="relative z-50 w-full">
      {isMounted ? (
        <HeaderWalletState onAddressChange={setWalletAddress} />
      ) : null}
      <div className="flex h-[80px] w-full items-center justify-between gap-2 px-4 py-2 md:px-10">
        <div className="flex flex-row items-center justify-start gap-4 md:gap-8">
          <Link href="/" aria-label="Yellow Collective home">
            <Image
              src={isDarkMode ? "/noggles-darkmode.png" : "/noggles.svg"}
              width={80}
              height={30}
              alt="Yellow"
              className="h-[30px] w-[80px]"
            />
          </Link>
          <div className="hidden lg:block">
            {isMounted ? (
              <TreasuryPill />
            ) : (
              <Button
                variant="outline"
                size="tight"
                className="yc-treasury-pill"
              >
                <h6>&Xi; 0</h6>
              </Button>
            )}
          </div>
        </div>

        <div className="hidden flex-1 items-center justify-end gap-2 px-4 lg:flex">
          {isAdmin ? (
            <NavDropdown label="Home" items={homeItems} />
          ) : (
            <Link
              href="/"
              className="rounded-[18px] px-4 py-[13px] font-bold text-primary transition ease-in-out hover:bg-[#181818]/10"
            >
              <h6>Home</h6>
            </Link>
          )}
          <NavDropdown label="Art" items={artItems} />

          <NavDropdown label="DAO" items={daoItems} />
        </div>

        <div className="hidden shrink-0 items-center gap-2 lg:flex">
          {isMounted ? (
            <CustomConnectButton className="!h-10 rounded-xl border border-skin-stroke bg-skin-backdrop px-6 text-skin-base transition ease-in-out hover:-translate-y-0.5 hover:shadow-[0px_6px_0px_0px_rgb(var(--color-shadow-neutral-hover))]" />
          ) : null}
          <ThemeToggle className="!h-10 !w-10" />
        </div>

        <button
          type="button"
          aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={isMobileMenuOpen}
          onClick={() => setIsMobileMenuOpen((isOpen) => !isOpen)}
          className="yc-dark-yellow-button flex h-11 w-11 items-center justify-center rounded-full border border-skin-stroke bg-white text-[#212529] shadow-[0px_4.02px_0px_0px_rgb(var(--color-shadow-neutral))] transition active:translate-y-1 active:shadow-none lg:hidden"
        >
          {isMobileMenuOpen ? (
            <XMarkIcon className="h-5 w-5" />
          ) : (
            <Bars3Icon className="h-5 w-5" />
          )}
        </button>
      </div>

      {isMobileMenuOpen && (
        <div
          className="absolute left-4 right-4 top-[72px] z-50 flex flex-col gap-2 overflow-y-auto rounded-2xl border border-skin-stroke bg-primary p-3 shadow-[0px_4.02px_0px_0px_rgb(var(--color-shadow-neutral))] lg:hidden"
          style={{
            maxHeight:
              "calc(100dvh - 88px - env(safe-area-inset-bottom) - var(--miniapp-safe-area-bottom))",
          }}
        >
          {isAdmin ? (
            <MobileNavGroup
              label="Home"
              items={homeItems}
              onClick={() => setIsMobileMenuOpen(false)}
            />
          ) : (
            <Link
              href="/"
              onClick={() => setIsMobileMenuOpen(false)}
              className="header-dropdown-item rounded-xl px-4 py-3 font-bold text-primary transition hover:bg-[#fff7bf]"
            >
              Home
            </Link>
          )}
          <MobileNavGroup
            label="Art"
            items={artItems}
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="border-t border-skin-stroke pt-2">
            <div className="px-4 pb-1 font-heading text-sm text-secondary">
              DAO
            </div>
            {daoItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className="header-dropdown-item block rounded-xl px-4 py-3 font-bold text-primary transition hover:bg-[#fff7bf]"
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-2 border-t border-skin-stroke pt-3">
            <div className="min-w-0 flex-1">
              {isMounted ? (
                <CustomConnectButton
                  className="h-11 w-full overflow-hidden rounded-xl border border-skin-stroke bg-skin-backdrop px-6 text-skin-base transition ease-in-out"
                  menuPlacement="top"
                />
              ) : null}
            </div>
            <ThemeToggle className="h-11 w-11" />
          </div>
        </div>
      )}
    </header>
  );
}

const NavDropdown = ({ label, items }: { label: string; items: NavItem[] }) => (
  <div className="group relative">
    <button
      type="button"
      className="header-nav-trigger flex items-center gap-1 rounded-[18px] px-4 py-[13px] font-bold text-primary transition ease-in-out hover:bg-[#181818]/10"
    >
      <h6>{label}</h6>
      <ChevronDownIcon className="h-4 w-4 stroke-[3]" />
    </button>

    <div className="invisible absolute right-0 top-full z-50 flex w-48 translate-y-2 flex-col rounded-2xl border border-skin-stroke bg-skin-muted p-2 opacity-0 shadow-lg transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
      {items.map((item) => (
        <NavDropdownItem key={item.href} item={item} />
      ))}
    </div>
  </div>
);

const NavDropdownItem = ({ item }: { item: NavItem }) => {
  if (!item.children?.length) {
    return (
      <Link
        href={item.href}
        className="header-dropdown-item rounded-xl px-4 py-3 font-bold text-primary transition hover:bg-[#fff7bf]"
      >
        <h6>{item.label}</h6>
      </Link>
    );
  }

  return (
    <div className="header-submenu-parent relative">
      <Link
        href={item.href}
        className="header-dropdown-item flex items-center justify-between gap-3 rounded-xl px-4 py-3 font-bold text-primary transition hover:bg-[#fff7bf]"
      >
        <h6>{item.label}</h6>
        <ChevronRightIcon className="h-4 w-4 shrink-0 stroke-[3]" />
      </Link>

      <div className="header-submenu-panel absolute left-[calc(100%-2px)] top-0 z-50 flex w-44 flex-col rounded-2xl border border-skin-stroke bg-skin-muted p-2 shadow-lg">
        {item.children.map((child) => (
          <Link
            key={child.href}
            href={child.href}
            className="header-dropdown-item rounded-xl px-4 py-3 font-bold text-primary transition hover:bg-[#fff7bf]"
          >
            <h6>{child.label}</h6>
          </Link>
        ))}
      </div>
    </div>
  );
};

const MobileNavGroup = ({
  label,
  items,
  onClick,
}: {
  label: string;
  items: NavItem[];
  onClick: () => void;
}) => (
  <div className="border-t border-skin-stroke pt-2">
    <div className="px-4 pb-1 font-heading text-sm text-secondary">{label}</div>
    {items.map((item) =>
      item.children?.length ? (
        <div key={item.href} className="py-1">
          <div className="px-4 py-2 font-heading text-sm text-secondary">
            {item.label}
          </div>
          {item.children.map((child) => (
            <Link
              key={child.href}
              href={child.href}
              onClick={onClick}
              className="header-dropdown-item block rounded-xl px-7 py-3 font-bold text-primary transition hover:bg-[#fff7bf]"
            >
              {child.label}
            </Link>
          ))}
        </div>
      ) : (
        <Link
          key={item.href}
          href={item.href}
          onClick={onClick}
          className="header-dropdown-item block rounded-xl px-4 py-3 font-bold text-primary transition hover:bg-[#fff7bf]"
        >
          {item.label}
        </Link>
      )
    )}
  </div>
);
