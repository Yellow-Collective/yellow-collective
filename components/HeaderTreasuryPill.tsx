import { useNounsBalance } from "@/hooks/fetch/useNounsBalance";
import { formatNumber } from "@/utils/formatNumber";
import { BigNumber, ethers } from "@/utils/ethers-compat";
import { BASED_AND_YELLOW_MULTISIG, TOKEN_CONTRACT } from "constants/addresses";
import { ETHERSCAN_BASEURL } from "constants/urls";
import { useDAOAddresses, useTreasuryBalance } from "hooks";
import Link from "next/link";
import { useMemo } from "react";
import Button from "./Button";

const HeaderTreasuryPill = () => {
  const { data: addresses } = useDAOAddresses({
    tokenContract: TOKEN_CONTRACT,
  });
  const { data: treasury } = useTreasuryBalance({
    treasuryContract: addresses?.treasury,
  });
  const { data: treasuryNounsBalance } = useNounsBalance({
    user: addresses?.treasury,
  });
  const { data: multisigNounsBalance } = useNounsBalance({
    user: BASED_AND_YELLOW_MULTISIG,
  });

  const nounsBalance = BigNumber.from(treasuryNounsBalance ?? 0).add(
    BigNumber.from(multisigNounsBalance ?? 0)
  );
  const balanceLabel = useMemo(() => {
    const parts = [
      treasury ? formatNumber(ethers.utils.formatEther(treasury), 2) : "0",
    ];

    if (nounsBalance.gt(0)) {
      parts.push(
        `${nounsBalance.toString()} ${nounsBalance.gt(1) ? "Nouns" : "Noun"}`
      );
    }

    return parts.join(" + ");
  }, [nounsBalance, treasury]);
  const treasuryHref = `${ETHERSCAN_BASEURL}/tokenholdings?a=${addresses?.treasury}`;

  return (
    <Button variant="outline" size="tight" className="yc-treasury-pill">
      <Link
        href={treasuryHref}
        rel="noreferer noopener noreferrer"
        target="_blank"
      >
        <h6>&Xi; {balanceLabel}</h6>
      </Link>
    </Button>
  );
};

export default HeaderTreasuryPill;
