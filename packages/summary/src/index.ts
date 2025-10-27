import type { PluginSummary } from "@allurereport/plugin-api";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { generateSummaryStaticFiles } from "./generators.js";

/**
 * Generates summary HTML page and returns it's file-system path
 * @param output
 * @param summaries
 */
export const generateSummary = async (output: string, summaries: PluginSummary[]) => {
  if (!summaries.length) {
    return undefined;
  }

  const summaryHtml = await generateSummaryStaticFiles({ summaries });
  const summaryPath = resolve(output, "index.html");

  await writeFile(summaryPath, summaryHtml, "utf8");

  return summaryPath;
};

export default generateSummary;
