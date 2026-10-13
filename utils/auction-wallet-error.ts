export const getAuctionWalletError = (
  error: unknown,
  phase: "connect" | "prepare" | "send" | "confirm"
): string => {
  if (!error) return "";
  if (phase === "confirm")
    return "Unable to confirm this bid yet. Check the transaction before placing another bid.";

  const details: string[] = [];
  let current: any = error;
  for (let depth = 0; current && depth < 5; depth += 1) {
    details.push(String(current.code ?? ""), String(current.name ?? ""));
    details.push(String(current.reason ?? ""), String(current.message ?? ""));
    current = current.cause ?? current.error ?? current.data?.originalError;
  }
  const description = details.join(" ").toLowerCase();

  if (
    /4001|action_rejected|userrejected|user rejected|user denied/.test(
      description
    )
  ) {
    return phase === "connect"
      ? "Wallet connection was cancelled. Try connecting again."
      : "Bid approval was cancelled. Your bid was not sent. Try again when ready.";
  }
  if (/insufficient funds|insufficient_funds/.test(description)) {
    return "Not enough ETH on Base for this bid and its network fee.";
  }
  if (
    /chainmismatch|chainnotconfigured|wrong network|network changed/.test(
      description
    )
  ) {
    return "Switch your wallet to Base to place a bid.";
  }
  if (phase === "connect")
    return "Unable to connect your Farcaster wallet. Try connecting again.";
  if (phase === "prepare")
    return "Unable to prepare this bid. Check your Base balance, network and the latest minimum bid, then try again.";
  return "Unable to send this bid. Check your wallet and try again.";
};
