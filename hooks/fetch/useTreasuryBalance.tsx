import useSWR from "swr";

export const useTreasuryBalance = ({
  treasuryContract,
}: {
  treasuryContract?: string;
}) => {
  return useSWR<string>(
    treasuryContract ? `/api/treasury/${treasuryContract}` : undefined
  );
};
