import { providers, utils } from "@/utils/ethers-compat";
import {
  getNounsDaoIndexerPool,
  getNounsDaoIndexerSchema,
} from "data/nouns-dao/indexer";

export type NounsDaoProposal = {
  proposalId: string;
  proposalNumber: number;
  proposer: string;
  title: string;
  description: string;
  timeCreated: string;
  voteStartBlock: number;
  voteEndBlock: number;
  proposalThreshold: string;
  quorumVotes: string;
  forVotes: string;
  againstVotes: string;
  abstainVotes: string;
  targets: string[];
  values: string[];
  signatures: string[];
  calldatas: string[];
  state: number;
  transactionHash: string;
};

const NOUNS_DAO_PROXY = "0x6f3E6272A167e8AcCb32072d08E0957F9c79223d";
const NOUNS_DAO_START_BLOCK = 12985451;
const CONFIRMATION_BLOCKS = 500;
const BLOCK_RANGE = 50000;
const MAX_PROPOSALS = 60;
const RPC_URLS = [
  process.env.NEXT_PUBLIC_MAINNET_RPC_URL,
  "https://ethereum.publicnode.com",
  "https://eth.llamarpc.com",
].filter((url, index, urls): url is string =>
  Boolean(url && urls.indexOf(url) === index)
);

const nounsDaoInterface = new utils.Interface([
  "event ProposalCreated(uint256 id,address proposer,address[] targets,uint256[] values,string[] signatures,bytes[] calldatas,uint256 startBlock,uint256 endBlock,string description)",
  "event ProposalCreatedWithRequirements(uint256 id,address proposer,address[] targets,uint256[] values,string[] signatures,bytes[] calldatas,uint256 startBlock,uint256 endBlock,uint256 proposalThreshold,uint256 quorumVotes,string description,uint8 clientId)",
  "function state(uint256 proposalId) view returns (uint8)",
  "function proposals(uint256 proposalId) view returns (uint256 id,address proposer,uint256 proposalThreshold,uint256 quorumVotes,uint256 eta,uint256 startBlock,uint256 endBlock,uint256 forVotes,uint256 againstVotes,uint256 abstainVotes,bool canceled,bool vetoed,bool executed)",
]);

type NounsDaoProposalRow = {
  id: number;
  proposer: string;
  title: string | null;
  description: string | null;
  status: string | null;
  targets: unknown;
  values: unknown;
  signatures: unknown;
  calldatas: unknown;
  start_block: string | number | null;
  end_block: string | number | null;
  start_timestamp: string | number | null;
  end_timestamp: string | number | null;
  created_timestamp: string | number | null;
  proposal_threshold: string | number | null;
  quorum_votes: string | number | null;
  for_votes: string | number | null;
  against_votes: string | number | null;
  abstain_votes: string | number | null;
  tx_hash: string | null;
};

const stripMarkdownTitle = (value: string) =>
  value
    .replace(/^#+\s*/, "")
    .replace(/\*\*/g, "")
    .replace(/^title:\s*/i, "")
    .trim();

const getProposalTitle = (description: string, id: string) => {
  const firstLine = description
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);

  return firstLine ? stripMarkdownTitle(firstLine) : `Nouns Proposal ${id}`;
};

export const getNounsDaoProposals = async () => {
  try {
    const proposals = await getNounsDaoProposalsFromIndexer();
    if (proposals.length > 0) return proposals;
  } catch (error) {
    console.warn("Unable to load Nouns DAO proposals from indexer", error);
  }

  let lastError: unknown;

  for (const rpcUrl of RPC_URLS) {
    try {
      return await getNounsDaoProposalsFromProvider(
        new providers.JsonRpcProvider(rpcUrl)
      );
    } catch (error) {
      lastError = error;
      console.warn(`Unable to load Nouns DAO proposals from ${rpcUrl}`, error);
    }
  }

  throw lastError;
};

export const getNounsDaoProposalByNumber = async (proposalNumber: number) => {
  try {
    const proposal =
      await getNounsDaoProposalByNumberFromIndexer(proposalNumber);
    if (proposal) return proposal;
  } catch (error) {
    console.warn(
      "Unable to load Nouns DAO proposal detail from indexer",
      error
    );
  }

  const proposals = await getNounsDaoProposals();
  return proposals.find(
    (proposal) => proposal.proposalNumber === proposalNumber
  );
};

const getNounsDaoProposalsFromIndexer = async () => {
  const pool = getNounsDaoIndexerPool();
  if (!pool) return [];

  const schema = getNounsDaoIndexerSchema();
  const { rows } = await pool.query<NounsDaoProposalRow>(
    `
      select
        id,
        proposer,
        title,
        description,
        status,
        targets,
        values,
        signatures,
        calldatas,
        start_block,
        end_block,
        start_timestamp,
        end_timestamp,
        created_timestamp,
        proposal_threshold,
        quorum_votes,
        for_votes,
        against_votes,
        abstain_votes,
        tx_hash
      from "${schema}"."proposals"
      order by id desc
      limit $1
    `,
    [MAX_PROPOSALS]
  );

  return rows.map(mapIndexerRowToProposal);
};

const getNounsDaoProposalByNumberFromIndexer = async (
  proposalNumber: number
) => {
  const pool = getNounsDaoIndexerPool();
  if (!pool) return undefined;

  const schema = getNounsDaoIndexerSchema();
  const { rows } = await pool.query<NounsDaoProposalRow>(
    `
      select
        id,
        proposer,
        title,
        description,
        status,
        targets,
        values,
        signatures,
        calldatas,
        start_block,
        end_block,
        start_timestamp,
        end_timestamp,
        created_timestamp,
        proposal_threshold,
        quorum_votes,
        for_votes,
        against_votes,
        abstain_votes,
        tx_hash
      from "${schema}"."proposals"
      where id = $1
      limit 1
    `,
    [proposalNumber]
  );

  return rows[0] ? mapIndexerRowToProposal(rows[0]) : undefined;
};

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item));
};

const toNumber = (value: string | number | null | undefined) =>
  Number(value || 0);

const toNumericString = (value: string | number | null | undefined) =>
  String(value || 0);

const mapIndexerStatusToState = (row: NounsDaoProposalRow) => {
  switch ((row.status || "").toUpperCase()) {
    case "CANCELLED":
      return 2;
    case "QUEUED":
      return 5;
    case "EXECUTED":
      return 7;
    case "VETOED":
      return 8;
    default:
      return getPendingProposalState(row);
  }
};

const getPendingProposalState = (row: NounsDaoProposalRow) => {
  const now = Math.floor(Date.now() / 1000);
  const startTimestamp = toNumber(row.start_timestamp);

  if (startTimestamp && now < startTimestamp) return 0;

  const endTimestamp = toNumber(row.end_timestamp);

  if (endTimestamp && now <= endTimestamp) return 1;

  const forVotes = toNumber(row.for_votes);
  const againstVotes = toNumber(row.against_votes);
  const quorumVotes = toNumber(row.quorum_votes);

  return forVotes > againstVotes && forVotes >= quorumVotes ? 4 : 3;
};

const mapIndexerRowToProposal = (
  row: NounsDaoProposalRow
): NounsDaoProposal => {
  const proposalId = String(row.id);
  const description = row.description || "";

  return {
    proposalId,
    proposalNumber: row.id,
    proposer: row.proposer,
    title: row.title || getProposalTitle(description, proposalId),
    description,
    timeCreated: toNumericString(row.created_timestamp || row.start_timestamp),
    voteStartBlock: toNumber(row.start_block),
    voteEndBlock: toNumber(row.end_block),
    proposalThreshold: toNumericString(row.proposal_threshold),
    quorumVotes: toNumericString(row.quorum_votes),
    forVotes: toNumericString(row.for_votes),
    againstVotes: toNumericString(row.against_votes),
    abstainVotes: toNumericString(row.abstain_votes),
    targets: toStringArray(row.targets),
    values: toStringArray(row.values),
    signatures: toStringArray(row.signatures),
    calldatas: toStringArray(row.calldatas),
    state: mapIndexerStatusToState(row),
    transactionHash: row.tx_hash || "",
  };
};

const getNounsDaoProposalsFromProvider = async (provider: any) => {
  const latestBlock = Math.max(
    NOUNS_DAO_START_BLOCK,
    (await provider.getBlockNumber()) - CONFIRMATION_BLOCKS
  );
  const proposalTopics = [
    nounsDaoInterface.getEventTopic("ProposalCreated"),
    nounsDaoInterface.getEventTopic("ProposalCreatedWithRequirements"),
  ];
  let toBlock = latestBlock;
  let logs: any[] = [];

  while (logs.length < MAX_PROPOSALS && toBlock > NOUNS_DAO_START_BLOCK) {
    const fromBlock = Math.max(NOUNS_DAO_START_BLOCK, toBlock - BLOCK_RANGE);
    const rangeLogs = await provider.getLogs({
      address: NOUNS_DAO_PROXY,
      fromBlock,
      toBlock,
      topics: [proposalTopics],
    });

    logs = [...rangeLogs, ...logs];
    toBlock = fromBlock - 1;
  }

  const recentLogs = logs.slice(-MAX_PROPOSALS).reverse();

  return Promise.all(
    recentLogs.map(async (log) => {
      const parsed = nounsDaoInterface.parseLog(log)!;
      const proposalId = parsed.args.id.toString();
      const [block, state, details] = await Promise.all([
        provider.getBlock(log.blockNumber),
        provider
          .call({
            to: NOUNS_DAO_PROXY,
            data: nounsDaoInterface.encodeFunctionData("state", [proposalId]),
          })
          .then((result: string) =>
            Number(nounsDaoInterface.decodeFunctionResult("state", result)[0])
          )
          .catch(() => 0),
        provider
          .call({
            to: NOUNS_DAO_PROXY,
            data: nounsDaoInterface.encodeFunctionData("proposals", [
              proposalId,
            ]),
          })
          .then((result: string) =>
            nounsDaoInterface.decodeFunctionResult("proposals", result)
          ),
      ]);
      const description = parsed.args.description as string;

      return {
        proposalId,
        proposalNumber: Number(proposalId),
        proposer: details.proposer,
        title: getProposalTitle(description, proposalId),
        description,
        timeCreated: String(block.timestamp),
        voteStartBlock: Number(details.startBlock.toString()),
        voteEndBlock: Number(parsed.args.endBlock.toString()),
        proposalThreshold: details.proposalThreshold.toString(),
        quorumVotes: details.quorumVotes.toString(),
        forVotes: details.forVotes.toString(),
        againstVotes: details.againstVotes.toString(),
        abstainVotes: details.abstainVotes.toString(),
        targets: parsed.args.targets,
        values: (parsed.args[3] as unknown[]).map((value: unknown) =>
          String(value)
        ),
        signatures: parsed.args.signatures,
        calldatas: parsed.args.calldatas,
        state,
        transactionHash: log.transactionHash,
      } satisfies NounsDaoProposal;
    })
  );
};
