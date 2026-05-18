import { randomBytes, createHash } from "node:crypto";

export const shortHash = () => randomBytes(8).toString("hex");

export const md5 = (data: string) => createHash("md5").update(data).digest("hex");
