import type { NextApiRequest, NextApiResponse } from "next";
import {
  hasWalletAdminPermission,
  isAdminWalletAddress,
} from "data/admin-access";
import type { AdminPermission } from "./admin-permissions";
import { getAdminSignedRequestAction } from "./admin-auth";
import { getAdminSessionAddress } from "./admin-session";
import { setNoStoreHeaders, verifySignedRequest } from "./signature-auth-server";

const ADMIN_QUERY_AUTH_KEYS = new Set([
  "adminAddress",
  "adminMessage",
  "adminSignature",
]);

const hasAdminAuthInQuery = (req: NextApiRequest) =>
  Object.keys(req.query).some((key) => ADMIN_QUERY_AUTH_KEYS.has(key));

export const requireAdminRequest = async (
  req: NextApiRequest,
  res: NextApiResponse,
  permission?: AdminPermission
) => {
  setNoStoreHeaders(res);

  if (hasAdminAuthInQuery(req)) {
    res
      .status(400)
      .json({ error: "Admin signed authorization is not accepted in URLs." });
    return undefined;
  }

  const sessionAddress = getAdminSessionAddress(req);
  if (sessionAddress) {
    if (!(await isAdminWalletAddress(sessionAddress))) {
      res.status(403).json({ error: "Admin wallet required." });
      return undefined;
    }

    if (
      permission &&
      !(await hasWalletAdminPermission(sessionAddress, permission))
    ) {
      res.status(403).json({ error: "Admin permission required." });
      return undefined;
    }

    return sessionAddress;
  }

  const adminAddress = await verifySignedRequest(req, res, {
    action: getAdminSignedRequestAction(req.method || ""),
  });

  if (!adminAddress) return undefined;

  if (!(await isAdminWalletAddress(adminAddress))) {
    res.status(403).json({ error: "Admin wallet required." });
    return undefined;
  }

  if (permission && !(await hasWalletAdminPermission(adminAddress, permission))) {
    res.status(403).json({ error: "Admin permission required." });
    return undefined;
  }

  return adminAddress;
};
