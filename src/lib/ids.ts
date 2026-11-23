import { randomBytes } from "node:crypto";

export function nid(prefix = ""): string {
  const id = randomBytes(8).toString("hex");
  return prefix ? `${prefix}_${id}` : id;
}
