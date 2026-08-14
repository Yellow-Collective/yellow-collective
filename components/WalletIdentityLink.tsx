import useEnsName from "@/hooks/fetch/useEnsName";
import {
  getProfilePath,
  shortenWalletAddress,
} from "@/utils/profile/identity";
import Link from "next/link";
import type { ReactNode } from "react";
import { Address, getAddress, isAddress } from "viem";

type WalletIdentityLinkProps = {
  address: string;
  ensName?: string | null;
  profileName?: string | null;
  className?: string;
  children?: ReactNode;
  fallback?: "short" | "full";
  link?: boolean;
};

export default function WalletIdentityLink({
  address,
  ensName,
  profileName,
  className,
  children,
  fallback = "short",
  link = true,
}: WalletIdentityLinkProps) {
  const normalizedAddress = isAddress(address) ? getAddress(address) : undefined;
  const { data } = useEnsName(normalizedAddress as Address | undefined);

  if (!normalizedAddress) {
    return <span className={className}>{children || address}</span>;
  }

  const resolvedEnsName = ensName || data?.ensName;
  const fallbackLabel =
    fallback === "full" ? normalizedAddress : shortenWalletAddress(normalizedAddress);
  const label = children || resolvedEnsName || profileName || fallbackLabel;

  if (!link) return <span className={className}>{label}</span>;

  return (
    <Link
      href={getProfilePath({ address: normalizedAddress, ensName: resolvedEnsName })}
      className={className}
    >
      {label}
    </Link>
  );
}
