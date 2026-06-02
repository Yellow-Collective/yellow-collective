import { useEffect } from "react";
import { useAccount } from "wagmi";

type HeaderWalletStateProps = {
  onAddressChange: (address: string | undefined) => void;
};

const HeaderWalletState = ({ onAddressChange }: HeaderWalletStateProps) => {
  const { address } = useAccount();

  useEffect(() => {
    onAddressChange(address);
  }, [address, onAddressChange]);

  return null;
};

export default HeaderWalletState;
