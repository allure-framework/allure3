import { resolve } from "node:path";
import { argv } from "node:process";

import { createReportStaticArchive } from "../packages/plugin-api/dist/packStaticAssets.js";

const [source, target] = argv.slice(2);

if (!source || !target) {
  throw new Error("Usage: pack-report-static <source-directory> <target-archive>");
}

await createReportStaticArchive(resolve(source), resolve(target));
