import { randomBytes } from "node:crypto";

export const shortHash = () => randomBytes(8).toString("hex");
