import { shortenAddress } from "@/utils/shortenAddress";
import { ethers } from "@/utils/ethers-compat";
import { Address } from "wagmi";
import Jazzicon, { jsNumberForAddress } from "react-jazzicon";
import { getAddress, zeroAddress } from "viem";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import useEnsName from "@/hooks/fetch/useEnsName";
import useEnsAvatar from "@/hooks/fetch/useEnsAvatar";
import { getProfilePath } from "@/utils/profile/identity";

interface WalletInfoProps {
  address?: Address;
  hideAvatar?: boolean;
  hideAddress?: boolean;
  disableEns?: boolean;
  link?: boolean;
  size: "sm" | "lg";
}

export default function WalletInfo({
  address,
  hideAvatar,
  hideAddress,
  disableEns,
  link = true,
  size,
}: WalletInfoProps) {
  const { data: ensNameResp } = useEnsName(address);
  const { data: ensAvatarResp } = useEnsAvatar(address);
  const [ensImgError, setEnsImgError] = useState<boolean>(false);

  useEffect(() => {
    setEnsImgError(false);
  }, [address]);

  const name = useMemo(() => {
    if (!disableEns && ensNameResp?.ensName) {
      return ensNameResp.ensName;
    } else {
      return shortenAddress(
        address ? getAddress(address) : ethers.constants.AddressZero,
        4
      );
    }
  }, [address, disableEns, ensNameResp]);

  const content = (
    <div className="flex flex-row gap-2 items-center">
      {!hideAvatar &&
        (!disableEns && ensAvatarResp?.ensAvatar && !ensImgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={ensAvatarResp.ensAvatar}
            alt="avatar"
            height={size == "sm" ? 24 : 44}
            width={size == "sm" ? 24 : 44}
            className="rounded-full"
            onError={() => setEnsImgError(true)}
          />
        ) : (
          <Jazzicon
            diameter={size == "sm" ? 24 : 44}
            seed={jsNumberForAddress(address ?? zeroAddress)}
          />
        ))}
      {!hideAddress && (size == "sm" ? <h6>{name}</h6> : <h3>{name}</h3>)}
    </div>
  );

  if (!link || !address) return content;

  return (
    <Link
      href={getProfilePath({
        address,
        ensName: !disableEns ? ensNameResp?.ensName : undefined,
      })}
      className="transition hover:opacity-80"
    >
      {content}
    </Link>
  );
}
