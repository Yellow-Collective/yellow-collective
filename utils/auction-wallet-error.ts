const getWalletErrorDetails = (error: unknown) => {
  const details: string[] = [];
  const codes: string[] = [];
  let current: any = error;
  for (let depth = 0; current && depth < 5; depth += 1) {
    const code = String(current.code ?? "");
    if (/^(?:-?\d{1,8}|[A-Z_]{2,50})$/.test(code)) codes.push(code);
    details.push(code, String(current.name ?? ""));
    details.push(String(current.reason ?? ""), String(current.message ?? ""));
    current = current.cause ?? current.error ?? current.data?.originalError;
  }
  return { description: details.join(" ").toLowerCase(), codes };
};

export const isAuctionWalletRejection = (error: unknown) => {
  const { description, codes } = getWalletErrorDetails(error);
  return (
    codes.includes("4001") ||
    codes.includes("ACTION_REJECTED") ||
    /userrejectedrequesterror|user rejected|user denied/.test(description)
  );
};

export const getAuctionWalletError = (
  error: unknown,
  phase: "connect" | "prepare" | "send" | "confirm"
): string => {
  if (!error) return "";
  if (phase === "confirm")
    return "Unable to confirm this bid yet. Check the transaction before placing another bid.";

  const { description, codes } = getWalletErrorDetails(error);
  const diagnostic = codes.length
    ? ` (Wallet code: ${codes[codes.length - 1]})`
    : "";
  if (description.includes("miniapp_submission_unknown")) {
    return (
      "Your wallet may have received this bid, but its result is unknown. Check your wallet activity before bidding again." +
      diagnostic
    );
  }
  if (description.includes("miniapp_account_changed"))
    return "Your wallet account changed. Reconnect the wallet you intend to bid with.";
  if (description.includes("miniapp_provider_unavailable"))
    return "Your Farcaster wallet is unavailable. Reconnect it and try again.";
  if (description.includes("miniapp_wrong_chain"))
    return "Switch your Farcaster wallet to Base and try again.";

  if (isAuctionWalletRejection(error)) {
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
    return (
      "Unable to prepare this bid. The wallet or RPC preparation request failed. Retry preparation or reconnect your wallet." +
      diagnostic
    );
  return (
    "Unable to send this bid. Check your wallet and try again." + diagnostic
  );
};
