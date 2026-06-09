import dotenv from "dotenv";
import { getAddress } from "ethers";

dotenv.config();

const stripPrivateKeyPrefix = (value: string) =>
  value.startsWith("0x") ? value.slice(2) : value;

const numberFromEnv = (key: string, fallback: number) => {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const config = {
  ethereumRpcUrl: process.env.ETHEREUM_RPC_URL || "https://eth.llamarpc.com",
  chainId: 1,
  botPrivateKey: stripPrivateKeyPrefix(process.env.BOT_PRIVATE_KEY || ""),
  safeAddress: process.env.SAFE_ADDRESS || "",
  safeApiKey: process.env.SAFE_API_KEY || "",
  nounsGraphqlEndpoint:
    process.env.NOUNS_GRAPHQL_ENDPOINT ||
    "https://api.goldsky.com/api/public/project_clnbcoajmebxn33wdbt98f439/subgraphs/nouns-mainnet/1.0.0/gn",
  nounsDaoAddress:
    process.env.NOUNS_DAO_ADDRESS ||
    "0x6f3E6272A167e8AcCb32072d08E0957F9c79223d",
  nounsTokenAddress:
    process.env.NOUNS_TOKEN_ADDRESS ||
    "0x9C8fF314C9Bc7F6e59A9d9225Fb22946427eDC03",
  snapshotGraphql:
    process.env.SNAPSHOT_GRAPHQL_URL || "https://hub.snapshot.org/graphql",
  snapshotSequencer:
    process.env.SNAPSHOT_SEQUENCER_URL || "https://seq.snapshot.org",
  snapshotSpaceId: process.env.SNAPSHOT_SPACE_ID || "",
  clientId: numberFromEnv("CLIENT_ID", 0),
  votingDurationDays: numberFromEnv("VOTING_DURATION_DAYS", 5),
  noVotesAction: (process.env.NO_VOTES_ACTION || "abstain").toLowerCase() as
    | "abstain"
    | "skip",
  minProposalId: numberFromEnv("MIN_PROPOSAL_ID", 0),
  lookbackDays: numberFromEnv("LOOKBACK_DAYS", 7),
  proposalLinkTemplate:
    process.env.PROPOSAL_LINK_TEMPLATE || "https://nouns.game/proposals/{id}",
  siteProposalLinkTemplate:
    process.env.SITE_PROPOSAL_LINK_TEMPLATE ||
    "https://yellowcollective.art/proposals/nouns/{id}",
  proposalPollMinutes: numberFromEnv("PROPOSAL_POLL_MINUTES", 1),
  votePollMinutes: numberFromEnv("VOTE_POLL_MINUTES", 5),
  dataDir: process.env.DATA_DIR || "data",
  maxGasPriceGwei: numberFromEnv("MAX_GAS_PRICE_GWEI", 100),
  maxRetries: numberFromEnv("MAX_RETRIES", 3),
  gasBufferPercent: numberFromEnv("GAS_BUFFER_PERCENT", 30),
  dryRun: process.env.DRY_RUN === "true",
  port: numberFromEnv("PORT", 3000),
  neynarApiKey: process.env.NEYNAR_API_KEY || "",
  notificationsDryRun: process.env.NOTIFICATIONS_DRY_RUN === "true",
  notificationsTargetOrigin:
    process.env.NOTIFICATIONS_TARGET_ORIGIN ||
    "https://yellowcollective.art",
  notificationsSettingsUrl: process.env.NOTIFICATIONS_SETTINGS_URL || "",
  notificationsCronSecret: process.env.NOTIFICATIONS_CRON_SECRET || "",
};

export const snapshotVotingDuration = () =>
  config.votingDurationDays * 24 * 60 * 60;

export const validateConfig = () => {
  if (!config.botPrivateKey) {
    throw new Error("Missing BOT_PRIVATE_KEY.");
  }

  if (!/^[a-fA-F0-9]{64}$/.test(config.botPrivateKey)) {
    throw new Error("BOT_PRIVATE_KEY must be 32 bytes of hex.");
  }

  if (!config.safeAddress) {
    throw new Error("Missing SAFE_ADDRESS.");
  }

  if (!config.snapshotSpaceId) {
    throw new Error("Missing SNAPSHOT_SPACE_ID.");
  }

  if (config.safeAddress) getAddress(config.safeAddress);
  getAddress(config.nounsDaoAddress);
  getAddress(config.nounsTokenAddress);

  if (
    getAddress(config.nounsTokenAddress) === getAddress(config.nounsDaoAddress)
  ) {
    throw new Error(
      "NOUNS_TOKEN_ADDRESS cannot equal NOUNS_DAO_ADDRESS. Use the Nouns token contract 0x9C8fF314C9Bc7F6e59A9d9225Fb22946427eDC03."
    );
  }
};
