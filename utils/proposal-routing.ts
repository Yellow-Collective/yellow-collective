import type { Proposal } from "@/services/nouns-builder/governor";

export const getYellowProposalPath = (
  proposal: Pick<Proposal, "proposalNumber">
) => `/proposals/${proposal.proposalNumber}`;

export const findProposalByRouteParam = (
  proposals: Proposal[] | undefined,
  routeParam: string | string[] | undefined
) => {
  const identifier = Array.isArray(routeParam) ? routeParam[0] : routeParam;

  if (!proposals || !identifier) return undefined;

  if (/^\d+$/.test(identifier)) {
    const proposalNumber = Number(identifier);
    return proposals.find(
      (proposal) => proposal.proposalNumber === proposalNumber
    );
  }

  const normalizedIdentifier = identifier.toLowerCase();
  return proposals.find(
    (proposal) => proposal.proposalId.toLowerCase() === normalizedIdentifier
  );
};
