import type { NextApiRequest, NextApiResponse } from "next";
import { getCollectiveNounVotingPower } from "@/utils/rounds/getCollectiveNounVotingPower";
import { ethers } from "ethers";
import { getSnapshotProposalForNouns } from "data/snapshot";
import { SNAPSHOT_SEQUENCER_URL, SNAPSHOT_SPACE_ID } from "constants/metagov";

const snapshotVoteTypes = {
  Vote: [
    { name: "from", type: "string" },
    { name: "space", type: "string" },
    { name: "timestamp", type: "uint64" },
    { name: "proposal", type: "string" },
    { name: "choice", type: "uint32" },
    { name: "reason", type: "string" },
    { name: "app", type: "string" },
    { name: "metadata", type: "string" },
  ],
};

type SnapshotVoteEnvelope = {
  address?: string;
  sig?: string;
  data?: {
    domain?: {
      name?: string;
      version?: string;
    };
    types?: typeof snapshotVoteTypes;
    message?: {
      from?: string;
      space?: string;
      timestamp?: number;
      proposal?: string;
      choice?: number;
      reason?: string;
      app?: string;
      metadata?: string;
    };
  };
};

const isAddress = (value: unknown) =>
  typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const envelope = req.body as SnapshotVoteEnvelope;
  const message = envelope.data?.message;

  if (
    !envelope.sig ||
    !isAddress(envelope.address) ||
    !message?.proposal ||
    !isAddress(message.from) ||
    message.space !== SNAPSHOT_SPACE_ID ||
    ![1, 2, 3].includes(Number(message.choice))
  ) {
    return res.status(400).json({ error: "Invalid Snapshot vote payload." });
  }

  const voterAddress = envelope.address as string;
  const messageFrom = message.from as string;
  const recoveredAddress = ethers.utils.verifyTypedData(
    { name: "snapshot", version: "0.1.4" },
    snapshotVoteTypes,
    {
      from: messageFrom,
      space: message.space,
      timestamp: Number(message.timestamp),
      proposal: message.proposal,
      choice: Number(message.choice),
      reason: message.reason || "",
      app: message.app || "",
      metadata: message.metadata || "{}",
    },
    envelope.sig
  );

  if (
    recoveredAddress.toLowerCase() !== voterAddress.toLowerCase() ||
    recoveredAddress.toLowerCase() !== messageFrom.toLowerCase()
  ) {
    return res.status(400).json({ error: "Invalid vote signature." });
  }

  const proposalNumber = Number(req.query.proposalNumber);
  if (!Number.isInteger(proposalNumber) || proposalNumber <= 0) {
    return res.status(400).json({ error: "Invalid Nouns proposal number." });
  }

  try {
    const snapshotProposal = await getSnapshotProposalForNouns(proposalNumber);

    if (!snapshotProposal || snapshotProposal.id !== message.proposal) {
      return res
        .status(400)
        .json({
          error: "Snapshot proposal does not match this Nouns proposal.",
        });
    }

    if (snapshotProposal.state !== "active") {
      return res
        .status(400)
        .json({ error: "Snapshot proposal is not active." });
    }

    const collectiveNounBalance = await getCollectiveNounVotingPower(
      recoveredAddress,
      Number(snapshotProposal.snapshot)
    );

    if (collectiveNounBalance <= 0) {
      return res.status(403).json({
        error: "Only Collective Noun holders can submit Snapshot votes.",
      });
    }

    const snapshotResponse = await fetch(SNAPSHOT_SEQUENCER_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(envelope),
    });
    const payload = await snapshotResponse.json().catch(() => null);

    if (!snapshotResponse.ok) {
      return res.status(snapshotResponse.status).json(
        payload || {
          error: "Snapshot rejected the vote.",
        }
      );
    }

    return res.status(200).json(payload);
  } catch (error) {
    console.error("Unable to submit Snapshot vote", error);
    return res.status(500).json({ error: "Unable to submit Snapshot vote." });
  }
}
