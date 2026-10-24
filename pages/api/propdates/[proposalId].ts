import type { NextApiRequest, NextApiResponse } from "next";
import { SUBGRAPH_ENDPOINT } from "constants/urls";
import { GraphQLClient, gql } from "graphql-request";
import { isHex } from "viem";
import { fetchPublicText } from "@/utils/public-text-fetch";

type ProposalUpdateRow = {
  id: string;
  transactionHash: string;
  timestamp: string | number;
  messageType: string | number;
  message: string;
  creator: string;
  originalMessageId: string;
};

const propdatesQuery = gql`
  query propdates($proposalId: String!, $first: Int!, $skip: Int!) {
    proposalUpdates(
      where: { proposal: $proposalId, deleted: false }
      orderBy: timestamp
      orderDirection: desc
      first: $first
      skip: $skip
    ) {
      id
      transactionHash
      timestamp
      messageType
      message
      creator
      originalMessageId
    }
  }
`;

const MESSAGE_TYPE = {
  INLINE_TEXT: 0,
  INLINE_JSON: 1,
  URL_TEXT: 2,
  URL_JSON: 3,
};

const parsePropdateMessage = async (
  messageType: number,
  message: string
): Promise<{ content: string; milestoneId?: number }> => {
  try {
    if (messageType === MESSAGE_TYPE.INLINE_JSON) {
      return JSON.parse(message);
    }

    if (
      messageType === MESSAGE_TYPE.URL_TEXT ||
      messageType === MESSAGE_TYPE.URL_JSON
    ) {
      const text = await fetchPublicText(message);
      return messageType === MESSAGE_TYPE.URL_JSON
        ? JSON.parse(text)
        : { content: text };
    }

    return { content: message };
  } catch (error) {
    console.warn("Unable to parse propdate message");
    return { content: message };
  }
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  const proposalId = String(req.query.proposalId || "").toLowerCase();

  if (!proposalId || !isHex(proposalId)) {
    return res.status(400).json({ error: "Invalid proposal id." });
  }

  try {
    const client = new GraphQLClient(SUBGRAPH_ENDPOINT);
    const { proposalUpdates } = await client.request<{
      proposalUpdates?: ProposalUpdateRow[];
    }>(propdatesQuery, { proposalId, first: 1000, skip: 0 });

    const propdates = await Promise.all(
      (proposalUpdates || []).map(async (update) => {
        const parsed = await parsePropdateMessage(
          Number(update.messageType),
          update.message
        );

        return {
          id: update.id,
          creator: update.creator,
          proposalId,
          originalMessageId: update.originalMessageId,
          message: parsed.content || update.message,
          txid: update.transactionHash,
          timeCreated: Number(update.timestamp),
        };
      })
    );

    return res.status(200).json(propdates);
  } catch (error) {
    console.warn("Unable to load propdates", error);
    return res.status(200).json([]);
  }
}
