import {
  getNounsDaoIndexerPool,
  getNounsDaoIndexerSchema,
} from "data/nouns-dao/indexer";
import { providers, utils } from "@/utils/ethers-compat";

export type NounsDaoProposalVote = {
  voter: string;
  support: number;
  weight: string;
  reason: string;
  timestamp: number | null;
  blockNumber: number | null;
};

type ColumnRow = {
  table_name: string;
  column_name: string;
  data_type: string;
};

type VoteColumn = {
  name: string;
  dataType: string;
};

type VoteTableConfig = {
  tableName: string;
  proposalColumn: string;
  voterColumn: string;
  supportColumn: string;
  weightColumn?: string;
  reasonColumn?: string;
  timestampColumn?: VoteColumn;
  blockNumberColumn?: VoteColumn;
};

const VOTE_TABLE_CANDIDATES = [
  "proposal_votes",
  "proposal_vote",
  "vote_casts",
  "vote_cast",
  "votes",
];

const PROPOSAL_COLUMN_CANDIDATES = [
  "proposal_id",
  "proposalId",
  "proposal_number",
  "proposal",
  "id",
];

const VOTER_COLUMN_CANDIDATES = ["voter", "address", "account", "delegate"];
const SUPPORT_COLUMN_CANDIDATES = ["support", "choice", "vote"];
const WEIGHT_COLUMN_CANDIDATES = ["weight", "votes", "amount"];
const REASON_COLUMN_CANDIDATES = ["reason", "comment", "comments", "message"];
const TIMESTAMP_COLUMN_CANDIDATES = [
  "timestamp",
  "created_timestamp",
  "block_timestamp",
  "blockTimestamp",
  "createdAt",
  "created_at",
  "timeCreated",
];
const BLOCK_NUMBER_COLUMN_CANDIDATES = [
  "block_number",
  "blockNumber",
  "block",
];
const NOUNS_DAO_PROXY = "0x6f3E6272A167e8AcCb32072d08E0957F9c79223d";
const BLOCK_RANGE = 50000;
const MAX_RPC_VOTES = 1000;
const RPC_URLS = [
  process.env.NEXT_PUBLIC_MAINNET_RPC_URL,
  "https://ethereum.publicnode.com",
  "https://eth.llamarpc.com",
].filter((url, index, urls): url is string =>
  Boolean(url && urls.indexOf(url) === index)
);

const nounsDaoVoteInterface = new utils.Interface([
  "function proposals(uint256 proposalId) view returns (uint256 id,address proposer,uint256 proposalThreshold,uint256 quorumVotes,uint256 eta,uint256 startBlock,uint256 endBlock,uint256 forVotes,uint256 againstVotes,uint256 abstainVotes,bool canceled,bool vetoed,bool executed)",
  "event VoteCast(address indexed voter,uint256 proposalId,uint8 support,uint256 votes,string reason)",
  "event VoteCastWithClientId(address indexed voter,uint256 proposalId,uint8 support,uint256 votes,string reason,uint32 clientId)",
  "event VoteCastWithParams(address indexed voter,uint256 proposalId,uint8 support,uint256 votes,string reason,bytes params)",
]);
const VOTE_EVENT_NAMES = [
  "VoteCast",
  "VoteCastWithClientId",
  "VoteCastWithParams",
] as const;

const quoteIdent = (value: string) => `"${value.replace(/"/g, '""')}"`;

const findColumn = (columns: string[], candidates: string[]) =>
  candidates.find((candidate) => columns.includes(candidate));

const findColumnMetadata = (
  columns: ColumnRow[],
  candidates: string[]
): VoteColumn | undefined => {
  const name = findColumn(
    columns.map((column) => column.column_name),
    candidates
  );
  const column = columns.find((item) => item.column_name === name);
  return column
    ? { name: column.column_name, dataType: column.data_type }
    : undefined;
};

const getNumericColumnExpression = (column?: VoteColumn) => {
  if (!column) return undefined;

  const quotedColumn = quoteIdent(column.name);
  const dataType = column.dataType.toLowerCase();

  if (dataType.includes("timestamp") || dataType.includes("date")) {
    return `extract(epoch from ${quotedColumn})`;
  }

  if (
    dataType.includes("char") ||
    dataType.includes("text") ||
    dataType.includes("json")
  ) {
    return `nullif(regexp_replace(${quotedColumn}::text, '[^0-9]', '', 'g'), '')::numeric`;
  }

  return `${quotedColumn}::numeric`;
};

const normalizeSupport = (value: unknown) => {
  if (typeof value === "number") return value;

  const numericValue = Number(value);
  if (Number.isFinite(numericValue)) return numericValue;

  switch (String(value || "").toLowerCase()) {
    case "against":
      return 0;
    case "for":
      return 1;
    case "abstain":
      return 2;
    default:
      return 0;
  }
};

const getVoteTableConfig = async () => {
  const pool = getNounsDaoIndexerPool();
  if (!pool) return undefined;

  const schema = getNounsDaoIndexerSchema();
  const { rows } = await pool.query<ColumnRow>(
    `
      select table_name, column_name, data_type
      from information_schema.columns
      where table_schema = $1
        and table_name = any($2)
    `,
    [schema, VOTE_TABLE_CANDIDATES]
  );

  const tableColumns = rows.reduce<Record<string, ColumnRow[]>>((acc, row) => {
    acc[row.table_name] = acc[row.table_name] || [];
    acc[row.table_name].push(row);
    return acc;
  }, {});

  for (const tableName of VOTE_TABLE_CANDIDATES) {
    const columns = tableColumns[tableName];
    if (!columns) continue;
    const columnNames = columns.map((column) => column.column_name);

    const proposalColumn = findColumn(columnNames, PROPOSAL_COLUMN_CANDIDATES);
    const voterColumn = findColumn(columnNames, VOTER_COLUMN_CANDIDATES);
    const supportColumn = findColumn(columnNames, SUPPORT_COLUMN_CANDIDATES);

    if (!proposalColumn || !voterColumn || !supportColumn) continue;

    return {
      tableName,
      proposalColumn,
      voterColumn,
      supportColumn,
      weightColumn: findColumn(columnNames, WEIGHT_COLUMN_CANDIDATES),
      reasonColumn: findColumn(columnNames, REASON_COLUMN_CANDIDATES),
      timestampColumn: findColumnMetadata(columns, TIMESTAMP_COLUMN_CANDIDATES),
      blockNumberColumn: findColumnMetadata(
        columns,
        BLOCK_NUMBER_COLUMN_CANDIDATES
      ),
    } satisfies VoteTableConfig;
  }

  return undefined;
};

const getNounsDaoProposalVotesFromIndexer = async (
  proposalNumber: number
): Promise<NounsDaoProposalVote[]> => {
  const pool = getNounsDaoIndexerPool();
  if (!pool || !Number.isFinite(proposalNumber)) return [];

  const schema = getNounsDaoIndexerSchema();
  const config = await getVoteTableConfig();
  if (!config) return [];

  const table = `${quoteIdent(schema)}.${quoteIdent(config.tableName)}`;
  const proposalColumn = quoteIdent(config.proposalColumn);
  const voterColumn = quoteIdent(config.voterColumn);
  const supportColumn = quoteIdent(config.supportColumn);
  const weightColumn = config.weightColumn
    ? quoteIdent(config.weightColumn)
    : undefined;
  const reasonColumn = config.reasonColumn
    ? quoteIdent(config.reasonColumn)
    : undefined;
  const timestampExpression = getNumericColumnExpression(config.timestampColumn);
  const blockNumberExpression = getNumericColumnExpression(
    config.blockNumberColumn
  );
  const orderColumn = timestampExpression || blockNumberExpression;

  const { rows } = await pool.query<Record<string, unknown>>(
    `
      select
        ${voterColumn} as voter,
        ${supportColumn} as support,
        ${weightColumn ? `${weightColumn} as weight` : "0 as weight"},
        ${reasonColumn ? `${reasonColumn} as reason` : "'' as reason"},
        ${timestampExpression ? `${timestampExpression} as timestamp` : "null as timestamp"},
        ${blockNumberExpression ? `${blockNumberExpression} as "blockNumber"` : "null as \"blockNumber\""}
      from ${table}
      where ${proposalColumn}::text = $1
      order by ${orderColumn ? `${orderColumn} desc nulls last` : weightColumn ? `${weightColumn}::numeric desc nulls last` : voterColumn}
      limit 1000
    `,
    [String(proposalNumber)]
  );

  return rows.map((row) => ({
    voter: String(row.voter || ""),
    support: normalizeSupport(row.support),
    weight: String(row.weight || 0),
    reason: String(row.reason || ""),
    timestamp:
      row.timestamp === null || row.timestamp === undefined
        ? null
        : Number(row.timestamp),
    blockNumber:
      row.blockNumber === null || row.blockNumber === undefined
        ? null
        : Number(row.blockNumber),
  }));
};

const getRpcProviders = () =>
  RPC_URLS.map((rpcUrl) => new providers.JsonRpcProvider(rpcUrl));

const getProposalVoteRange = async (provider: any, proposalNumber: number) => {
  const result = await provider.call({
    to: NOUNS_DAO_PROXY,
    data: nounsDaoVoteInterface.encodeFunctionData("proposals", [
      proposalNumber,
    ]),
  });
  const details = nounsDaoVoteInterface.decodeFunctionResult(
    "proposals",
    result
  );

  return {
    startBlock: Number(details.startBlock.toString()),
    endBlock: Number(details.endBlock.toString()),
  };
};

const getVoteLogsForTopic = async (
  provider: any,
  topic: string,
  fromBlock: number,
  toBlock: number
) => {
  const logs: any[] = [];

  for (let from = fromBlock; from <= toBlock; from += BLOCK_RANGE + 1) {
    const to = Math.min(from + BLOCK_RANGE, toBlock);
    const rangeLogs = await provider.getLogs({
      address: NOUNS_DAO_PROXY,
      fromBlock: from,
      toBlock: to,
      topics: [topic],
    });

    logs.push(...rangeLogs);
  }

  return logs;
};

const getBlockTimestamps = async (
  provider: any,
  logs: any[]
) => {
  const blockTimestamps = new Map<number, number>();
  const blockNumbers = Array.from(
    new Set(logs.map((log) => log.blockNumber))
  );

  await Promise.all(
    blockNumbers.map(async (blockNumber) => {
      const block = await provider.getBlock(blockNumber);
      if (block) blockTimestamps.set(blockNumber, block.timestamp);
    })
  );

  return blockTimestamps;
};

const getNounsDaoProposalVotesFromRpcProvider = async (
  proposalNumber: number,
  provider: any
): Promise<NounsDaoProposalVote[]> => {
  const [voteRange, latestBlock] = await Promise.all([
    getProposalVoteRange(provider, proposalNumber),
    provider.getBlockNumber(),
  ]);

  if (!voteRange.startBlock || voteRange.startBlock > latestBlock) return [];

  const fromBlock = voteRange.startBlock;
  const toBlock = Math.min(voteRange.endBlock || latestBlock, latestBlock);
  const topics = VOTE_EVENT_NAMES.map((eventName) =>
    nounsDaoVoteInterface.getEventTopic(eventName)
  );
  const logs = (
    await Promise.all(
      topics.map((topic) =>
        getVoteLogsForTopic(provider, topic, fromBlock, toBlock)
      )
    )
  )
    .flat()
    .sort(
      (a, b) =>
        b.blockNumber - a.blockNumber || (b.logIndex || 0) - (a.logIndex || 0)
    );
  const matchingLogs = logs
    .filter((log) => {
      try {
        const parsed = nounsDaoVoteInterface.parseLog(log)!;
        return parsed.args.proposalId.toString() === String(proposalNumber);
      } catch {
        return false;
      }
    })
    .slice(0, MAX_RPC_VOTES);
  const blockTimestamps = await getBlockTimestamps(provider, matchingLogs);

  return matchingLogs.map((log) => {
    const parsed = nounsDaoVoteInterface.parseLog(log)!;

    return {
      voter: String(parsed.args.voter || ""),
      support: Number(parsed.args.support || 0),
      weight: parsed.args.votes?.toString() || "0",
      reason: String(parsed.args.reason || ""),
      timestamp: blockTimestamps.get(log.blockNumber) || null,
      blockNumber: log.blockNumber,
    };
  });
};

const getNounsDaoProposalVotesFromRpc = async (
  proposalNumber: number
): Promise<NounsDaoProposalVote[]> => {
  if (!Number.isFinite(proposalNumber)) return [];

  for (const provider of getRpcProviders()) {
    try {
      return await getNounsDaoProposalVotesFromRpcProvider(
        proposalNumber,
        provider
      );
    } catch (error) {
      console.warn("Unable to load Nouns DAO proposal votes from RPC", error);
    }
  }

  return [];
};

export const getNounsDaoProposalVotes = async (
  proposalNumber: number
): Promise<NounsDaoProposalVote[]> => {
  try {
    const indexerVotes =
      await getNounsDaoProposalVotesFromIndexer(proposalNumber);
    if (indexerVotes.length > 0) return indexerVotes;
  } catch (error) {
    console.warn("Unable to load Nouns DAO proposal votes from indexer", error);
  }

  return getNounsDaoProposalVotesFromRpc(proposalNumber);
};
