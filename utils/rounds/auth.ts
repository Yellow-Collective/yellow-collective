export type RoundAction = "submission-read" | "edit" | "request" | "submit" | "submit-trait" | "vote" | "video-reserve" | "video-finalize" | "video-cancel";

export const getRoundSignedRequestAction = (action: RoundAction) =>
  `round:${action}`;
