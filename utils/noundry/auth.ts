export type NoundryAuthorAction = "update" | "delete";

export const getNoundryAuthorSignedRequestAction = (
  action: NoundryAuthorAction
) => `noundry:submission:${action}`;
