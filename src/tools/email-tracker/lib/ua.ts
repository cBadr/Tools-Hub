import { UAParser } from "ua-parser-js";

export function parseUserAgent(userAgentStr: string) {
  const parser = new UAParser(userAgentStr);
  return parser.getResult();
}
