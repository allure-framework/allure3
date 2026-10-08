import { randomBytes } from "node:crypto";

export { md5 } from "@allurereport/plugin-api";

export const shortHash = () => randomBytes(8).toString("hex");
