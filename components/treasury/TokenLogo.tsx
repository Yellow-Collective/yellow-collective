import { useMemo, useState } from "react";
import { getAddress } from "viem";

type TokenLogoProps = {
  address: string;
  symbol: string;
  name: string;
  logoUrl?: string;
};

const isAddressLike = (value: string) => /^0x[a-fA-F0-9]{40}$/.test(value);

export default function TokenLogo({
  address,
  symbol,
  name,
  logoUrl,
}: TokenLogoProps) {
  const [hasImageError, setHasImageError] = useState(false);
  const checksumAddress = useMemo(() => {
    if (!isAddressLike(address)) return "";

    try {
      return getAddress(address);
    } catch {
      return "";
    }
  }, [address]);

  if (logoUrl && !hasImageError) {
    return (
      <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-skin-stroke bg-white">
        <img
          src={logoUrl}
          alt={`${name} logo`}
          className="h-full w-full object-cover"
          onError={() => setHasImageError(true)}
        />
      </span>
    );
  }

  return (
    <span
      title={checksumAddress || name}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-skin-stroke bg-accent font-heading text-lg leading-none text-[#212529]"
    >
      {symbol.charAt(0).toUpperCase()}
    </span>
  );
}
