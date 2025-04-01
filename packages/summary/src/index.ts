import type { PluginSummary } from "@allurereport/plugin-api";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { generateSummaryStaticFiles } from "./generators.js";

export const generateSummary = async (output: string, summaries: PluginSummary[]) => {
  if (!summaries.length) {
    return;
  }

  const summaryHtml = await generateSummaryStaticFiles({ summaries });

  await writeFile(resolve(output, "index.html"), summaryHtml, "utf8");
};

export default generateSummary;
