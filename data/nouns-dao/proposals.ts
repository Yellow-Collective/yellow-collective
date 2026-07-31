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
const DEFAULT_NOUNS_GRAPHQL_ENDPOINT =
  "https://api.goldsky.com/api/public/project_clnbcoajmebxn33wdbt98f439/subgraphs/nouns-mainnet/1.0.0/gn";
const GOLDSKY_TIMEOUT_MS = 8000;
const CONFIRMATION_BLOCKS = 500;
const BLOCK_RANGE = 50000;
const PROPOSAL_EVENT_LOOKBACK_BLOCKS = 100000;
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

type GoldskyProposal = {
  id: string;
  proposer?: string | { id?: string };
  title?: string | null;
  description?: string | null;
  createdTimestamp?: string | number | null;
  startBlock?: string | number | null;
  endBlock?: string | number | null;
  proposalThreshold?: string | number | null;
  quorumVotes?: string | number | null;
  forVotes?: string | number | null;
  againstVotes?: string | number | null;
  abstainVotes?: string | number | null;
  targets?: unknown;
  values?: unknown;
  signatures?: unknown;
  calldatas?: unknown;
  status?: string | null;
};

type ProposalDetailSources = {
  fromIndexer: (
    proposalNumber: number
  ) => Promise<NounsDaoProposal | undefined>;
  fromGoldsky: (
    proposalNumber: number
  ) => Promise<NounsDaoProposal | undefined>;
  fromRpc: (proposalNumber: number) => Promise<NounsDaoProposal | undefined>;
};

const GET_GOLDSKY_PROPOSAL_BY_ID = `
  query GetProposal($id: ID!) {
    proposal(id: $id) {
      id
      title
      description
      proposer {
        id
      }
      createdTimestamp
      startBlock
      endBlock
      proposalThreshold
      quorumVotes
      forVotes
      againstVotes
      abstainVotes
      targets
      values
      signatures
      calldatas
      status
    }
  }
`;

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
  return resolveNounsDaoProposalByNumber(proposalNumber, {
    fromIndexer: getNounsDaoProposalByNumberFromIndexer,
    fromGoldsky: getNounsDaoProposalByNumberFromGoldsky,
    fromRpc: getNounsDaoProposalByNumberFromRpc,
  });
};

export const resolveNounsDaoProposalByNumber = async (
  proposalNumber: number,
  sources: ProposalDetailSources
) => {
  const orderedSources = [
    ["indexer", sources.fromIndexer],
    ["Goldsky", sources.fromGoldsky],
    ["RPC", sources.fromRpc],
  ] as const;

  for (const [label, loadProposal] of orderedSources) {
    try {
      const proposal = await loadProposal(proposalNumber);
      if (proposal) return proposal;
    } catch (error) {
      console.warn(
        `Unable to load Nouns DAO proposal detail from ${label}`,
        error
      );
    }
  }

  return undefined;
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

const mapGoldskyStatusToState = (status: string | null | undefined) => {
  switch ((status || "").toUpperCase()) {
    case "PENDING":
      return 0;
    case "ACTIVE":
      return 1;
    case "CANCELLED":
    case "CANCELED":
      return 2;
    case "DEFEATED":
      return 3;
    case "SUCCEEDED":
      return 4;
    case "QUEUED":
      return 5;
    case "EXPIRED":
      return 6;
    case "EXECUTED":
      return 7;
    case "VETOED":
      return 8;
    default:
      return 0;
  }
};

export const mapGoldskyProposalToNounsDaoProposal = (
  proposal: GoldskyProposal
): NounsDaoProposal => {
  const proposalId = String(proposal.id);
  const description = proposal.description || "";

  return {
    proposalId,
    proposalNumber: Number(proposalId),
    proposer:
      typeof proposal.proposer === "string"
        ? proposal.proposer
        : proposal.proposer?.id || "",
    title: proposal.title || getProposalTitle(description, proposalId),
    description,
    timeCreated: toNumericString(proposal.createdTimestamp),
    voteStartBlock: toNumber(proposal.startBlock),
    voteEndBlock: toNumber(proposal.endBlock),
    proposalThreshold: toNumericString(proposal.proposalThreshold),
    quorumVotes: toNumericString(proposal.quorumVotes),
    forVotes: toNumericString(proposal.forVotes),
    againstVotes: toNumericString(proposal.againstVotes),
    abstainVotes: toNumericString(proposal.abstainVotes),
    targets: toStringArray(proposal.targets),
    values: toStringArray(proposal.values),
    signatures: toStringArray(proposal.signatures),
    calldatas: toStringArray(proposal.calldatas),
    state: mapGoldskyStatusToState(proposal.status),
    transactionHash: "",
  };
};

const getNounsDaoProposalByNumberFromGoldsky = async (
  proposalNumber: number
) => {
  const endpoint =
    process.env.NOUNS_GRAPHQL_ENDPOINT || DEFAULT_NOUNS_GRAPHQL_ENDPOINT;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query: GET_GOLDSKY_PROPOSAL_BY_ID,
      variables: { id: String(proposalNumber) },
    }),
    signal: AbortSignal.timeout(GOLDSKY_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Goldsky returned HTTP ${response.status}`);
  }

  const payload = (await response.json()) as {
    data?: { proposal?: GoldskyProposal | null };
    errors?: { message?: string }[];
  };

  if (payload.errors?.length) {
    throw new Error(
      payload.errors.map((error) => error.message || "Unknown error").join("; ")
    );
  }

  return payload.data?.proposal
    ? mapGoldskyProposalToNounsDaoProposal(payload.data.proposal)
    : undefined;
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

const getNounsDaoProposalByNumberFromRpc = async (proposalNumber: number) => {
  let lastError: unknown;

  for (const rpcUrl of RPC_URLS) {
    try {
      const proposal = await getNounsDaoProposalByNumberFromProvider(
        new providers.JsonRpcProvider(rpcUrl),
        proposalNumber
      );
      if (proposal) return proposal;
    } catch (error) {
      lastError = error;
      console.warn(
        `Unable to load Nouns DAO proposal ${proposalNumber} from ${rpcUrl}`,
        error
      );
    }
  }

  if (lastError) throw lastError;
  return undefined;
};

const getNounsDaoProposalByNumberFromProvider = async (
  provider: any,
  proposalNumber: number
) => {
  const encodedProposalId = String(proposalNumber);
  const details = await provider
    .call({
      to: NOUNS_DAO_PROXY,
      data: nounsDaoInterface.encodeFunctionData("proposals", [
        encodedProposalId,
      ]),
    })
    .then((result: string) =>
      nounsDaoInterface.decodeFunctionResult("proposals", result)
    );

  if (Number(details.id.toString()) !== proposalNumber) return undefined;

  const startBlock = Number(details.startBlock.toString());
  const proposalLog = await findProposalCreatedLog(
    provider,
    encodedProposalId,
    startBlock
  );
  if (!proposalLog) return undefined;

  const parsed = nounsDaoInterface.parseLog(proposalLog)!;
  const [block, state] = await Promise.all([
    provider.getBlock(proposalLog.blockNumber),
    provider
      .call({
        to: NOUNS_DAO_PROXY,
        data: nounsDaoInterface.encodeFunctionData("state", [
          encodedProposalId,
        ]),
      })
      .then((result: string) =>
        Number(nounsDaoInterface.decodeFunctionResult("state", result)[0])
      ),
  ]);
  const description = parsed.args.description as string;

  return {
    proposalId: encodedProposalId,
    proposalNumber,
    proposer: details.proposer,
    title: getProposalTitle(description, encodedProposalId),
    description,
    timeCreated: String(block.timestamp),
    voteStartBlock: startBlock,
    voteEndBlock: Number(details.endBlock.toString()),
    proposalThreshold: details.proposalThreshold.toString(),
    quorumVotes: details.quorumVotes.toString(),
    forVotes: details.forVotes.toString(),
    againstVotes: details.againstVotes.toString(),
    abstainVotes: details.abstainVotes.toString(),
    targets: parsed.args.targets,
    values: (parsed.args[3] as unknown[]).map(String),
    signatures: parsed.args.signatures,
    calldatas: parsed.args.calldatas,
    state,
    transactionHash: proposalLog.transactionHash,
  } satisfies NounsDaoProposal;
};

const findProposalCreatedLog = async (
  provider: any,
  proposalId: string,
  startBlock: number
) => {
  const proposalTopics = [
    nounsDaoInterface.getEventTopic("ProposalCreated"),
    nounsDaoInterface.getEventTopic("ProposalCreatedWithRequirements"),
  ];
  const earliestBlock = Math.max(
    NOUNS_DAO_START_BLOCK,
    startBlock - PROPOSAL_EVENT_LOOKBACK_BLOCKS
  );
  let toBlock = startBlock;

  while (toBlock >= earliestBlock) {
    const fromBlock = Math.max(earliestBlock, toBlock - BLOCK_RANGE + 1);
    const logs = await provider.getLogs({
      address: NOUNS_DAO_PROXY,
      fromBlock,
      toBlock,
      topics: [proposalTopics],
    });
    const matchingLog = logs.find((log: any) => {
      try {
        return (
          nounsDaoInterface.parseLog(log)?.args.id.toString() === proposalId
        );
      } catch {
        return false;
      }
    });

    if (matchingLog) return matchingLog;
    toBlock = fromBlock - 1;
  }

  return undefined;
};
