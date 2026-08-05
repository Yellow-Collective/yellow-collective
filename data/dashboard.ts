import { YELLOW_COLLECTIVE_CONTRACTS } from "data/contracts";
import { getProposals } from "data/nouns-builder/governor";
import { getNounsDaoProposals } from "data/nouns-dao/proposals";
import { getNounsMetagovEnabled } from "data/nouns-metagov";
import { listPublicRounds } from "data/rounds";
import { getSnapshotProposals } from "data/snapshot";
import {
  buildDashboardPayload,
  type DashboardNounsSource,
  type DashboardPayload,
} from "@/utils/dashboard";

const providerError = (message: string) => ({ error: message });

const loadNounsSource = async (): Promise<DashboardNounsSource> => {
  const enabled = await getNounsMetagovEnabled();
  if (!enabled) return { enabled, snapshots: [], proposals: [] };

  const [snapshots, proposals] = await Promise.all([
    getSnapshotProposals(),
    getNounsDaoProposals(),
  ]);

  return {
    enabled,
    snapshots,
    proposals: proposals.map(({ proposalNumber, title }) => ({
      proposalNumber,
      title,
    })),
  };
};

export const getDashboardPayload = async (): Promise<DashboardPayload> => {
  const [rounds, yellowProposals, nouns] = await Promise.allSettled([
    listPublicRounds(),
    getProposals({ address: YELLOW_COLLECTIVE_CONTRACTS.governor.address }),
    loadNounsSource(),
  ]);

  if (rounds.status === "rejected") {
    console.error("Unable to load dashboard rounds", rounds.reason);
  }
  if (yellowProposals.status === "rejected") {
    console.error(
      "Unable to load dashboard Yellow proposals",
      yellowProposals.reason
    );
  }
  if (nouns.status === "rejected") {
    console.error("Unable to load dashboard Nouns votes", nouns.reason);
  }

  return buildDashboardPayload({
    rounds:
      rounds.status === "fulfilled"
        ? { data: rounds.value }
        : providerError("Rounds are unavailable right now."),
    yellowProposals:
      yellowProposals.status === "fulfilled"
        ? { data: yellowProposals.value }
        : providerError("Yellow proposals are unavailable right now."),
    nouns:
      nouns.status === "fulfilled"
        ? { data: nouns.value }
        : providerError("Nouns votes are unavailable right now."),
  });
};
