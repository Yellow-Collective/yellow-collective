import { publicApiRead } from "@/utils/public-api-read";
import { NextApiRequest, NextApiResponse } from "next";
import { theme } from "theme.config";

const handler = (_: NextApiRequest, res: NextApiResponse) => {
  res.send(theme);
};

export default publicApiRead(handler);
