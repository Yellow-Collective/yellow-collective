import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const loadProposalModule = () => {
  const source = readFileSync(
    resolve(process.cwd(), "data/nouns-dao/proposals.ts"),
    "utf8"
  );
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  });
  const module = { exports: {} };

  const localRequire = (specifier) => {
    if (specifier === "@/utils/ethers-compat") {
      return {
        providers: { JsonRpcProvider: class JsonRpcProvider {} },
        utils: {
          Interface: class Interface {
            getEventTopic() {
              return "0xtopic";
            }
          },
        },
      };
    }

    if (specifier === "data/nouns-dao/indexer") {
      return {
        getNounsDaoIndexerPool: () => null,
        getNounsDaoIndexerSchema: () => "ponder_live_camp",
      };
    }

    return require(specifier);
  };

  vm.runInNewContext(transpiled.outputText, {
    AbortSignal,
    console: { ...console, warn: () => {} },
    fetch,
    module,
    process,
    require: localRequire,
    exports: module.exports,
  });

  return module.exports;
};

const proposals = loadProposalModule();

test("maps a complete Goldsky proposal to the NounsDaoProposal contract", () => {
  const proposal = proposals.mapGoldskyProposalToNounsDaoProposal({
    id: "742",
    proposer: { id: "0x1234" },
    title: "Fund public goods",
    description: "# Fund public goods\n\nProposal body",
    createdTimestamp: "1710000000",
    startBlock: "19500000",
    endBlock: "19550000",
    proposalThreshold: "2",
    quorumVotes: "100",
    forVotes: "120",
    againstVotes: "10",
    abstainVotes: "5",
    targets: ["0xabcd"],
    values: ["1000000000000000000"],
    signatures: ["transfer(address,uint256)"],
    calldatas: ["0xdeadbeef"],
    status: "SUCCEEDED",
  });

  assert.deepEqual(
    { ...proposal },
    {
      proposalId: "742",
      proposalNumber: 742,
      proposer: "0x1234",
      title: "Fund public goods",
      description: "# Fund public goods\n\nProposal body",
      timeCreated: "1710000000",
      voteStartBlock: 19500000,
      voteEndBlock: 19550000,
      proposalThreshold: "2",
      quorumVotes: "100",
      forVotes: "120",
      againstVotes: "10",
      abstainVotes: "5",
      targets: ["0xabcd"],
      values: ["1000000000000000000"],
      signatures: ["transfer(address,uint256)"],
      calldatas: ["0xdeadbeef"],
      state: 4,
      transactionHash: "",
    }
  );
});

test("falls through indexer and Goldsky misses to targeted RPC", async () => {
  const calls = [];
  const rpcProposal = { proposalNumber: 743 };

  const proposal = await proposals.resolveNounsDaoProposalByNumber(743, {
    fromIndexer: async () => {
      calls.push("indexer");
      return undefined;
    },
    fromGoldsky: async () => {
      calls.push("goldsky");
      return undefined;
    },
    fromRpc: async () => {
      calls.push("rpc");
      return rpcProposal;
    },
  });

  assert.deepEqual(calls, ["indexer", "goldsky", "rpc"]);
  assert.equal(proposal, rpcProposal);
});

test("continues to Goldsky when PostgreSQL detail lookup rejects", async () => {
  const goldskyProposal = { proposalNumber: 744 };

  const proposal = await proposals.resolveNounsDaoProposalByNumber(744, {
    fromIndexer: async () => {
      throw new Error("database unavailable");
    },
    fromGoldsky: async () => goldskyProposal,
    fromRpc: async () => {
      throw new Error("RPC should not be reached");
    },
  });

  assert.equal(proposal, goldskyProposal);
});
